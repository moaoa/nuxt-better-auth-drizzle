# Phone Number Checker - SEO Implementation Plan

## SEO Strategy

### Primary Keywords
- **Primary**: "phone number checker" (2,400 monthly searches, medium competition)
- **Secondary**: "validate phone number", "phone number validator", "check phone number", "phone number lookup"
- **Long-tail**: "free phone number checker online", "phone number checker tool", "validate phone number before calling"

### Search Intent Analysis
- **Intent**: Informational + Transactional
- **User Goal**: Validate phone numbers before making calls, verify number format, check carrier/line type
- **Content Type**: Free utility tool with instant results

### Competitor Analysis
- Top competitors: Twilio Lookup API docs, NumLookup, PhoneValidator
- **Gap**: Most require API keys or paid plans; we offer instant free tool
- **Opportunity**: Better UX, faster results, no signup required

### Content Outline
1. Hero section with primary keyword in H1
2. How It Works (3-step process)
3. Features list (5-7 key features)
4. Tool interface (form + results)
5. Use cases section
6. FAQ section (8-10 questions)
7. Related tools section

## Technical Implementation

### Recommended npm Packages
```json
{
  "libphonenumber-js": "^1.12.34", // Already installed - phone parsing
  "zod": "^3.25.76" // Already installed - validation
}
```

### API Integration
- **Primary**: PhoneVerify.online (free tier: 100 requests/day)
- **Fallback**: Client-side validation using `libphonenumber-js` if API fails
- **Rate Limiting**: Cache results for 24 hours per number

### File Structure
```
app/pages/tools/phone-number-checker.vue
server/api/tools/phone-number-checker.post.ts
app/components/tools/PhoneNumberCheckerForm.vue
app/components/tools/PhoneNumberCheckerResults.vue
```

### Server Endpoint
**File**: `server/api/tools/phone-number-checker.post.ts`
- Accepts: `{ phoneNumber: string, country?: string }`
- Returns: `{ valid: boolean, country: string, carrier?: string, lineType?: string, e164: string, nationalFormat: string }`
- Caching: Redis cache with 24h TTL
- Rate limiting: 10 requests per IP per minute

### Client-Side Logic
- Real-time validation as user types
- Country auto-detection from IP (optional)
- Format phone number display (E.164, national, international)
- Error handling with user-friendly messages

## Structured Data (JSON-LD)

### WebApplication Schema
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Phone Number Checker - Free Online Tool",
  "applicationCategory": "UtilityApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": "Free phone number checker tool to validate phone numbers, check carrier, line type, and format",
  "url": "https://yourdomain.com/tools/phone-number-checker",
  "browserRequirements": "Requires JavaScript",
  "softwareVersion": "1.0"
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
      "name": "How does the phone number checker work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our phone number checker validates phone numbers using international standards, checks carrier information, and identifies line types (mobile, landline, VoIP)."
      }
    },
    {
      "@type": "Question",
      "name": "Is the phone number checker free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, our phone number checker is completely free to use with no signup required. You can check unlimited phone numbers."
      }
    }
    // ... 6-8 more FAQs
  ]
}
```

### HowTo Schema
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Check a Phone Number",
  "description": "Step-by-step guide to validate phone numbers",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Enter Phone Number",
      "text": "Enter the phone number you want to check in the input field"
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Select Country (Optional)",
      "text": "Optionally select the country if auto-detection doesn't work"
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Click Check",
      "text": "Click the 'Check Number' button to validate and get results"
    }
  ]
}
```

## Performance Optimization

### Code Splitting
- Lazy load results component: `defineAsyncComponent(() => import('~/components/tools/PhoneNumberCheckerResults.vue'))`
- Lazy load API call only on form submit

### Image Optimization
- Use `@nuxt/image` for any tool screenshots
- WebP format, lazy loading
- Alt text: "Phone Number Checker Tool Screenshot"

### API Caching
- Client-side: Cache results in localStorage (24h)
- Server-side: Redis cache with phone number as key
- Cache headers: `Cache-Control: public, max-age=86400`

### Bundle Size
- Tree-shake `libphonenumber-js` to import only needed functions
- Estimated bundle increase: ~15KB gzipped

## Internal Linking Strategy

### Related Tools to Link
1. **Phone Number Formatter** - "Format your validated numbers with our phone number formatter"
2. **International Dialing Codes** - "Need country codes? Check our international dialing codes lookup"
3. **Business Phone Number Lookup** - "Verify business numbers with our business phone lookup tool"

### Anchor Text Strategy
- Use natural, descriptive anchor text
- Include primary keyword variations
- Place links contextually within content

### Link Placement
- After results section (contextual)
- In "Related Tools" component at bottom
- In FAQ answers where relevant

## Lead Generation

### CTA Placement
1. **Above Results**: "Call this number instantly using [YourAppName]"
2. **After Results**: "Start making calls with [YourAppName] - Free trial"
3. **Bottom Banner**: Persistent CTA banner

### Email Capture Timing
- **Trigger**: After 3 successful checks
- **Message**: "Get unlimited checks + call features - Sign up free"
- **Soft Gate**: Optional, doesn't block tool usage

### Value Proposition
- "Never waste time on invalid numbers again"
- "Validate before you call - save time and money"
- "Professional-grade validation, free forever"

## Meta Tags Configuration

```typescript
useSeoMeta({
  title: 'Phone Number Checker - Free Online Tool | YourAppName',
  description: 'Free phone number checker tool. Validate phone numbers, check carrier, line type (mobile/landline/VoIP), and get international format instantly. No signup required.',
  ogTitle: 'Phone Number Checker - Free Online Tool',
  ogDescription: 'Validate phone numbers instantly. Check carrier, line type, and format. Free tool, no signup required.',
  ogImage: '/og-images/phone-number-checker.jpg',
  ogUrl: 'https://yourdomain.com/tools/phone-number-checker',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Free Phone Number Checker Tool',
  twitterDescription: 'Validate phone numbers, check carrier and line type instantly. Free tool.',
  keywords: 'phone number checker, validate phone number, phone number validator, check phone number, phone number lookup, free phone checker',
  author: 'YourAppName',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  canonical: 'https://yourdomain.com/tools/phone-number-checker'
})
```

## Content Sections

### Hero Section
```html
<h1>Free Phone Number Checker Tool</h1>
<p>Validate phone numbers instantly. Check carrier, line type (mobile/landline/VoIP), and get international E.164 format. No signup required - free forever.</p>
```

### How It Works
1. Enter the phone number you want to validate
2. Optionally select the country for better accuracy
3. Click "Check Number" to get instant results

### Features
- ✅ Instant validation (no API keys needed)
- ✅ Carrier information lookup
- ✅ Line type detection (mobile, landline, VoIP)
- ✅ International format (E.164) conversion
- ✅ National format display
- ✅ Country code detection
- ✅ 100% free, no signup required

### Use Cases
- Sales teams validating leads before calling
- Support teams verifying customer numbers
- Developers testing phone number formats
- Marketers cleaning contact lists

### FAQ Questions
1. How does the phone number checker work?
2. Is the phone number checker free?
3. What information does the checker provide?
4. Can I check international phone numbers?
5. How accurate is the carrier information?
6. Do I need to sign up to use the tool?
7. Is there a limit on how many numbers I can check?
8. Can I use this tool for commercial purposes?

## Implementation Checklist

- [ ] Create page component with SEO meta tags
- [ ] Implement structured data (JSON-LD)
- [ ] Build form component with validation
- [ ] Create results display component
- [ ] Set up server API endpoint with caching
- [ ] Integrate PhoneVerify.online API
- [ ] Add fallback client-side validation
- [ ] Implement rate limiting
- [ ] Add internal linking to related tools
- [ ] Create FAQ section with schema
- [ ] Add CTA components
- [ ] Implement email capture (soft gate)
- [ ] Optimize images and assets
- [ ] Test Core Web Vitals
- [ ] Submit sitemap to search engines
