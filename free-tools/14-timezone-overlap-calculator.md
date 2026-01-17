# Timezone Overlap Calculator - SEO Implementation Plan

## SEO Strategy

### Primary Keywords
- **Primary**: "timezone overlap calculator" (1,900 monthly searches, medium competition)
- **Secondary**: "timezone overlap", "time zone overlap finder", "timezone overlap tool", "find timezone overlap"
- **Long-tail**: "calculate timezone overlap", "find overlapping timezones", "timezone overlap between countries"

### Search Intent Analysis
- **Intent**: Informational
- **User Goal**: Find overlapping hours between timezones, plan meetings/calls across timezones
- **Content Type**: Timezone calculator tool (similar to Best Time to Call)

### Competitor Analysis
- Top competitors: WorldTimeBuddy, TimeAndDate, EveryTimeZone
- **Gap**: Most show timezones but don't focus on overlap calculation
- **Opportunity**: Visual overlap display, working hours focus, meeting planning

### Content Outline
1. Hero section
2. Timezone selector
3. Overlap visualization
4. Working hours overlap
5. Meeting time recommendations
6. Tips for global teams
7. FAQ section

## Technical Implementation

### Recommended npm Packages
```json
{
  "date-fns-tz": "^2.0.0", // Timezone handling
  "luxon": "^3.4.0" // Alternative timezone library
}
```

### API Integration
- **Primary**: WorldTimeAPI (same as Best Time to Call tool)
- **Fallback**: Client-side timezone calculations

### File Structure
```
app/pages/tools/timezone-overlap-calculator.vue
server/api/tools/timezone-overlap.post.ts
app/components/tools/TimezoneSelector.vue
app/components/tools/OverlapVisualization.vue
```

### Server Endpoint
**File**: `server/api/tools/timezone-overlap.post.ts`
- Reuse same endpoint as "Best Time to Call" tool
- Returns: Overlap hours, working hours overlap, recommendations

### Client-Side Logic
- Select multiple timezones (2+)
- Calculate overlap periods
- Visual timeline display
- Working hours overlap (9 AM - 5 PM)
- Meeting time recommendations
- Export overlap schedule

## Structured Data (JSON-LD)

### WebApplication Schema
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Timezone Overlap Calculator - Free Tool",
  "applicationCategory": "UtilityApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": "Calculate timezone overlaps for multiple locations. Find shared working hours, optimal meeting times, and coordinate global teams. Free tool.",
  "url": "https://yourdomain.com/tools/timezone-overlap-calculator"
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
      "name": "How do I calculate timezone overlap?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Select two or more locations/timezones. Our calculator will show you the overlapping hours, current times in each location, and recommend optimal meeting times based on working hours."
      }
    }
    // ... 7-9 more FAQs
  ]
}
```

## Performance Optimization

### Code Splitting
- Lazy load timezone library
- Lazy load visualization component
- Estimated bundle: ~25KB gzipped

## Internal Linking Strategy

### Related Tools to Link
1. **Best Time to Call Internationally** - "Find best calling times"
2. **International Call Cost Calculator** - "Calculate costs for calls"
3. **Phone Number Formatter** - "Format numbers before calling"

## Lead Generation

### CTA Placement
1. **After Overlap Calculation**: "Coordinate global calls with [YourAppName]"
2. **Meeting Section**: "Schedule calls automatically - Free trial"
3. **Bottom Banner**: "Global calling solution"

### Email Capture Timing
- **Trigger**: After calculating 3+ overlaps
- **Message**: "Get automated scheduling + free trial"

### Value Proposition
- "Automate global call scheduling"
- "Never miss optimal calling times"
- "Coordinate teams worldwide"

## Meta Tags Configuration

```typescript
useSeoMeta({
  title: 'Timezone Overlap Calculator - Free Tool | YourAppName',
  description: 'Calculate timezone overlaps for multiple locations. Find shared working hours, optimal meeting times, and coordinate global teams. Free tool.',
  ogTitle: 'Timezone Overlap Calculator - Free Tool',
  ogDescription: 'Calculate timezone overlaps and find optimal meeting times. Free tool.',
  ogImage: '/og-images/timezone-overlap-calculator.jpg',
  keywords: 'timezone overlap calculator, timezone overlap, time zone overlap finder, timezone overlap tool',
  canonical: 'https://yourdomain.com/tools/timezone-overlap-calculator'
})
```

## Content Sections

### Hero Section
```html
<h1>Timezone Overlap Calculator</h1>
<p>Calculate timezone overlaps for multiple locations. Find shared working hours, optimal meeting times, and coordinate global teams. Free tool - no signup required.</p>
```

### Features
- ✅ Multiple timezone support (2+)
- ✅ Visual overlap display
- ✅ Working hours overlap
- ✅ Meeting time recommendations
- ✅ Current time display
- ✅ Export overlap schedule

### Use Cases
- Global team coordination
- Meeting scheduling
- International call planning
- Remote team management

### FAQ Questions
1. How do I calculate timezone overlap?
2. Can I calculate overlap for more than 2 timezones?
3. What are working hours overlap?
4. How do I use this for meeting planning?
5. Does it account for daylight saving time?
6. Can I save my timezone combinations?
7. Is the tool free to use?
8. Can I export the overlap schedule?

## Implementation Checklist

- [ ] Create page component with SEO meta tags
- [ ] Implement structured data (JSON-LD)
- [ ] Build timezone selector (multiple)
- [ ] Create overlap visualization
- [ ] Integrate WorldTimeAPI
- [ ] Implement overlap calculation
- [ ] Add meeting recommendations
- [ ] Create FAQ section
- [ ] Implement internal linking
- [ ] Add CTA components
- [ ] Optimize for performance
- [ ] Test with multiple timezones
