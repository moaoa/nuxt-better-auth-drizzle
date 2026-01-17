# Business Phone Number Lookup - SEO Implementation Plan

## SEO Strategy

### Primary Keywords
- **Primary**: "business phone number lookup" (1,000 monthly searches, medium competition)
- **Secondary**: "verify business phone number", "business phone lookup", "company phone number lookup", "business number validator"
- **Long-tail**: "lookup business phone number", "verify company phone number", "business phone number checker"

### Search Intent Analysis
- **Intent**: Informational + Transactional
- **User Goal**: Verify business contact numbers, lookup company phone numbers, validate business listings
- **Content Type**: Lookup/validation tool

### Competitor Analysis
- Top competitors: Whitepages, YellowPages, business directories
- **Gap**: Most require paid subscriptions; we offer free lookup
- **Opportunity**: Free tool, instant results, carrier/line type info

### Content Outline
1. Hero section
2. Lookup interface
3. Results display
4. Business verification info
5. Use cases
6. FAQ section

## Technical Implementation

### Recommended npm Packages
```json
{
  "libphonenumber-js": "^1.12.34" // Already installed
}
```

### API Integration
- **Primary**: PhoneVerify.online (same as Phone Number Checker)
- **Fallback**: Client-side validation
- **Enhancement**: Could integrate business directory APIs (optional, paid)

### File Structure
```
app/pages/tools/business-phone-number-lookup.vue
server/api/tools/business-phone-lookup.post.ts
app/components/tools/BusinessLookupForm.vue
app/components/tools/BusinessLookupResults.vue
```

### Server Endpoint
**File**: `server/api/tools/business-phone-lookup.post.ts`
- Similar to phone number checker endpoint
- Returns: validity, carrier, line type, format

### Client-Side Logic
- Real-time validation
- Business-specific messaging
- Carrier information
- Line type detection
- Format display

## Structured Data (JSON-LD)

### WebApplication Schema
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Business Phone Number Lookup - Free Tool",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": "Verify and lookup business phone numbers. Check validity, carrier, and line type. Free business phone lookup tool.",
  "url": "https://yourdomain.com/tools/business-phone-number-lookup"
}
```

### FAQPage Schema
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I lookup a business phone number?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Enter the business phone number in our lookup tool. We'll verify the number, check the carrier, identify the line type, and provide formatting information."
      }
    }
    // ... 7-9 more FAQs
  ]
}
```

## Performance Optimization

### Code Splitting
- Reuse phone checker components
- Minimal bundle impact

## Internal Linking Strategy

### Related Tools to Link
1. **Phone Number Checker** - "General phone number validation"
2. **Phone Number Formatter** - "Format business numbers"
3. **International Dialing Codes** - "Find country codes"

## Lead Generation

### CTA Placement
1. **After Lookup**: "Call verified businesses using [YourAppName]"
2. **Results Section**: "Professional calling for businesses - Free trial"
3. **Bottom Banner**: "Business calling solution"

### Email Capture Timing
- **Trigger**: After 3+ lookups
- **Message**: "Get business calling solution + free trial"

### Value Proposition
- "Call verified businesses"
- "Professional business calling"
- "Verified contact database"

## Meta Tags Configuration

```typescript
useSeoMeta({
  title: 'Business Phone Number Lookup - Free Tool | YourAppName',
  description: 'Verify and lookup business phone numbers. Check validity, carrier, and line type. Free business phone lookup tool.',
  ogTitle: 'Business Phone Number Lookup - Free Tool',
  ogDescription: 'Verify business phone numbers instantly. Free lookup tool.',
  ogImage: '/og-images/business-phone-number-lookup.jpg',
  keywords: 'business phone number lookup, verify business phone number, business phone lookup, company phone number lookup',
  canonical: 'https://yourdomain.com/tools/business-phone-number-lookup'
})
```

## Content Sections

### Hero Section
```html
<h1>Business Phone Number Lookup</h1>
<p>Verify and lookup business phone numbers instantly. Check validity, carrier, line type, and format. Free business phone lookup tool - no signup required.</p>
```

### Features
- ✅ Instant business number verification
- ✅ Carrier information
- ✅ Line type detection
- ✅ Format display
- ✅ Free to use

### Use Cases
- Sales teams verifying business contacts
- Marketing teams cleaning business databases
- Customer support verifying business numbers
- Lead generation and prospecting

### FAQ Questions
1. How do I lookup a business phone number?
2. What information does the lookup provide?
3. Is the lookup free to use?
4. Can I lookup multiple numbers?
5. How accurate is the carrier information?
6. Can I use this for commercial purposes?
7. Do you store the phone numbers?
8. Is there a rate limit?

## Implementation Checklist

- [ ] Create page component with SEO meta tags
- [ ] Implement structured data (JSON-LD)
- [ ] Build lookup form component
- [ ] Create results display
- [ ] Set up server endpoint
- [ ] Integrate phone validation API
- [ ] Add FAQ section
- [ ] Implement internal linking
- [ ] Add CTA components
- [ ] Optimize for performance
