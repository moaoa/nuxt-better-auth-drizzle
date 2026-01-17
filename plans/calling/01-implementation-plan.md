# Credits-Based Web Calling App Implementation Plan

## Architecture Overview

This plan implements a financial-grade calling system where:
- All call initiation happens server-side (never from frontend)
- Billing is webhook-driven and idempotent
- Credits are deducted post-call completion
- Calls are force-ended when credits expire
- All operations are transactional

## Database Schema (Drizzle)

### New Tables to Add

**Location**: `db/schema.ts`

1. **wallets** - User credit balances
   - `id` (serial, primary key)
   - `userId` (text, foreign key to user.id, unique)
   - `balanceCredits` (integer, default 0, not null)
   - `updatedAt` (timestamp)

2. **creditTransactions** - Audit trail for all credit movements
   - `id` (serial, primary key)
   - `walletId` (integer, foreign key to wallets.id)
   - `type` (text enum: 'purchase' | 'call_charge' | 'refund')
   - `creditsAmount` (integer, positive for purchase/refund, negative for charges)
   - `referenceType` (text, nullable: 'call' | 'purchase' | null)
   - `referenceId` (text, nullable: callId or purchaseId)
   - `createdAt` (timestamp)

3. **calls** - Call records
   - `id` (serial, primary key)
   - `userId` (text, foreign key to user.id)
   - `twilioCallSid` (text, unique, not null) - Idempotency key
   - `fromNumber` (text, E.164 format)
   - `toNumber` (text, E.164 format)
   - `status` (text enum: 'initiated' | 'ringing' | 'answered' | 'completed' | 'failed' | 'busy' | 'no-answer')
   - `answeredAt` (timestamp, nullable)
   - `endedAt` (timestamp, nullable)
   - `durationSeconds` (integer, nullable)
   - `maxAllowedSeconds` (integer, not null) - Pre-authorized max duration
   - `billedAt` (timestamp, nullable) - Idempotency flag for billing
   - `createdAt` (timestamp)

4. **callCostBreakdowns** - Detailed billing records
   - `id` (serial, primary key)
   - `callId` (integer, foreign key to calls.id)
   - `ratePerMinUsd` (decimal/numeric)
   - `billedMinutes` (integer) - Rounded up per minute
   - `creditsCharged` (integer)
   - `pricingSnapshot` (jsonb) - Full pricing details at time of call
   - `createdAt` (timestamp)

5. **twilioVoiceRates** - Rate lookup table (optional, can be fetched from Twilio API)
   - `id` (serial, primary key)
   - `countryCode` (text, ISO 3166-1 alpha-2)
   - `callType` (text: 'mobile' | 'landline' | 'toll-free')
   - `ratePerMinUsd` (decimal/numeric)
   - `effectiveFrom` (timestamp)

### Relations
- wallets.userId → user.id (one-to-one)
- creditTransactions.walletId → wallets.id (many-to-one)
- calls.userId → user.id (many-to-one)
- callCostBreakdowns.callId → calls.id (one-to-one)

## Credit System

**Location**: `server/utils/credits.ts`

- **Credit Model**: 1 credit = $0.01 USD
- **Conversion**: USD → credits: multiply by 100, round up per minute
- **Validation**: Never allow negative balance
- **Functions**:
  - `usdToCredits(usd: number): number` - Convert USD to credits
  - `creditsToUsd(credits: number): number` - Convert credits to USD
  - `calculateCallCredits(ratePerMinUsd: number, durationSeconds: number): number` - Round up per minute

## API Endpoints (Nuxt Server Routes)

### Wallet & Credits

**Location**: `server/api/wallet/index.get.ts`
- GET `/api/wallet`
- Returns: `{ balanceCredits: number, balanceUsd: number }`
- Auth: Required (use `requireUserSession`)

**Location**: `server/api/credits/purchase.post.ts`
- POST `/api/credits/purchase`
- Body: `{ amountUsd: number }` (placeholder, no Stripe yet)
- Creates credit transaction, updates wallet
- Returns: `{ transactionId: number, newBalance: number }`
- Auth: Required

### Call Management

**Location**: `server/api/calls/start.post.ts`
- POST `/api/calls/start`
- Body: `{ toNumber: string }` (E.164 format)
- Flow:
  1. Authenticate user
  2. Validate phone number (E.164 regex)
  3. Get user wallet, check balance ≥ 1 minute worth
  4. Determine destination country from phone number
  5. Fetch worst-case rate (mobile rate if available)
  6. Calculate `maxAllowedSeconds` based on balance
  7. Create call record with status 'initiated'
  8. Call Twilio REST API to initiate call
  9. Update call with `twilioCallSid`
  10. Schedule forced hangup job (BullMQ delayed job)
  11. Return success
- Auth: Required

**Location**: `server/api/calls/history.get.ts`
- GET `/api/calls/history`
- Query params: `?page=1&limit=20`
- Returns paginated call history for user
- Auth: Required

### Twilio Webhooks

**Location**: `server/api/twilio/voice.post.ts`
- POST `/api/twilio/voice`
- Validates Twilio signature
- Returns TwiML: `<Response><Dial>{{ destinationNumber }}</Dial></Response>`
- No auth (Twilio webhook)

**Location**: `server/api/twilio/call-status.post.ts`
- POST `/api/twilio/call-status`
- Validates Twilio signature
- Handles webhook events: 'ringing', 'answered', 'completed', 'failed', etc.
- **Critical Logic**:
  - Use `CallSid` as idempotency key (UNIQUE constraint)
  - Wrap all logic in DB transaction
  - On 'answered': Save `answeredAt`, schedule forced hangup job
  - On 'completed': 
    - Check if `billedAt` exists → exit (idempotency)
    - Calculate duration, credits
    - Deduct credits (transactional)
    - Insert credit transaction
    - Save billing snapshot
    - Mark `billedAt`
- No auth (Twilio webhook)

## Twilio Integration

**Location**: `server/utils/twilio.ts`

- Initialize Twilio client with Account SID and Auth Token
- Functions:
  - `initiateCall(from: string, to: string, webhookUrl: string): Promise<Call>`
  - `endCall(callSid: string): Promise<void>`
  - `getVoiceRate(countryCode: string, callType?: string): Promise<number>` - Fetch from Twilio Pricing API or local table
  - `validateWebhookSignature(url: string, params: Record<string, string>, signature: string): boolean`

## Forced Hangup System

**Location**: `server/queues/calls/queue.ts` and `server/queues/calls/workers/hangup-worker.ts`

- Use BullMQ delayed jobs
- Job scheduled at: `answeredAt + maxAllowedSeconds`
- Worker checks:
  - Call still active (status not 'completed')
  - Calls Twilio API to end call
  - Updates call status to 'completed' with forced flag

**Location**: `server/plugins/bullmq.ts`
- Register hangup worker

## Environment Variables

**Location**: `config/env.schema.ts` (add to existing schema)

```typescript
TWILIO_ACCOUNT_SID: z.string().min(1)
TWILIO_AUTH_TOKEN: z.string().min(1)
TWILIO_PHONE_NUMBER: z.string().min(1) // E.164 format
TWILIO_WEBHOOK_SECRET: z.string().min(1) // For signature validation
CREDIT_USD_RATE: z.string().transform(Number).default("0.01") // 1 credit = $0.01
```

**Location**: `nuxt.config.ts` (add to runtimeConfig)
- Add Twilio config to server-side runtimeConfig

## Frontend Pages

**Location**: `app/pages/app/dialer.vue`
- Phone number input (E.164 validation)
- Show estimated cost per minute
- Show remaining minutes based on balance
- Disable call button if insufficient credits
- Call status display (ringing, answered, duration)

**Location**: `app/pages/app/wallet.vue`
- Display current balance (credits + USD)
- Purchase credits form (placeholder)
- Credit transaction history

**Location**: `app/pages/app/calls.vue`
- Call history table
- Pagination
- Filter by status, date range
- Show duration, cost per call

## Security & Validation

- All Twilio webhooks: Validate `X-Twilio-Signature` header
- Rate limiting on `/api/calls/start` (prevent abuse)
- Phone number validation: E.164 format regex
- User ownership validation: Users can only see their own calls/wallet
- Never trust frontend for pricing or balance calculations

## Testing Checklist

- Webhook retries don't double-charge (idempotency test)
- Forced hangup works when credits expire
- Calls blocked when balance < 1 minute worth
- Failed calls (no answer, busy) cost 0 credits
- Short calls (< 1 min) bill for 1 minute minimum
- Concurrent webhook handling (race conditions)

## Implementation Order

1. Database schema + migrations
2. Credit utility functions
3. Twilio integration module
4. Wallet API endpoints
5. Call initiation endpoint
6. Twilio webhook handlers
7. Forced hangup queue + worker
8. Frontend pages
9. Testing & validation







