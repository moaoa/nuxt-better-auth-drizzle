# Cold Call Opening Lines - SEO Implementation Plan

## SEO Strategy

### Primary Keywords
- **Primary**: "cold call opening lines" (1,600 monthly searches, medium competition)
- **Secondary**: "cold call script", "cold call opener", "sales opening lines", "cold calling script"
- **Long-tail**: "best cold call opening lines", "cold call opening statement", "effective cold call opener"

### Search Intent Analysis
- **Intent**: Informational
- **User Goal**: Get ideas for cold call openings, improve cold calling success
- **Content Type**: Content resource with examples

### Competitor Analysis
- Top competitors: Sales blogs, LinkedIn articles, sales training sites
- **Gap**: Most are blog posts; we provide interactive tool with examples
- **Opportunity**: Industry-specific examples, interactive display, copy functionality

### Content Outline
1. Hero section
2. Industry selector
3. Opening lines display
4. Tips and best practices
5. Examples by industry
6. FAQ section

## Technical Implementation

### Recommended npm Packages
```json
{
  // No additional packages needed
}
```

### API Integration
- **Static content**: Pre-written opening lines by industry
- **No API needed**: Client-side tool

### File Structure
```
app/pages/tools/cold-call-opening-lines.vue
app/components/tools/OpeningLinesDisplay.vue
data/cold-call-openers.json
```

### Server Endpoint
**Not required** - Static content tool

### Client-Side Logic
- Industry selector
- Display opening lines by industry
- Copy to clipboard
- Filter by industry
- Tips section
- Best practices guide

## Structured Data (JSON-LD)

### WebApplication Schema
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Cold Call Opening Lines - Free Resource | YourAppName",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": "Discover high-performing cold call opening lines by industry. Get proven openers, tips, and best practices. Free resource for sales teams.",
  "url": "https://yourdomain.com/tools/cold-call-opening-lines"
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
      "name": "What makes a good cold call opening line?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A good cold call opening line should be brief, value-focused, and create curiosity. It should establish credibility quickly and give the prospect a reason to continue the conversation."
      }
    }
    // ... 7-9 more FAQs
  ]
}
```

## Performance Optimization

### Code Splitting
- Lazy load opening lines data
- Minimal bundle impact

## Internal Linking Strategy

### Related Tools to Link
1. **Sales Call Script Generator** - "Generate full call scripts"
2. **Phone Number Checker** - "Validate numbers before calling"
3. **Best Time to Call** - "Find optimal calling times"

## Lead Generation

### CTA Placement
1. **After Viewing Lines**: "Start cold calling with [YourAppName]"
2. **Tips Section**: "Track your cold call performance - Free trial"
3. **Bottom Banner**: "Professional calling platform"

### Email Capture Timing
- **Trigger**: After viewing 2+ industries
- **Message**: "Get cold call tracking + analytics - Free trial"

### Value Proposition
- "Track cold call performance"
- "Record and analyze calls"
- "Improve conversion rates"

## Meta Tags Configuration

```typescript
useSeoMeta({
  title: 'Cold Call Opening Lines - Free Resource | YourAppName',
  description: 'Discover high-performing cold call opening lines by industry. Get proven openers, tips, and best practices. Free resource for sales teams.',
  ogTitle: 'Cold Call Opening Lines - Free Resource',
  ogDescription: 'Get proven cold call opening lines by industry. Free resource.',
  ogImage: '/og-images/cold-call-opening-lines.jpg',
  keywords: 'cold call opening lines, cold call script, cold call opener, sales opening lines, cold calling script',
  canonical: 'https://yourdomain.com/tools/cold-call-opening-lines'
})
```

## Content Sections

### Hero Section
```html
<h1>Cold Call Opening Lines</h1>
<p>Discover high-performing cold call opening lines by industry. Get proven openers, tips, and best practices to improve your cold calling success. Free resource - no signup required.</p>
```

### Features
- ✅ Industry-specific opening lines
- ✅ Proven examples
- ✅ Tips and best practices
- ✅ Copy to clipboard
- ✅ Multiple industries

### Industries Covered
- Technology
- Healthcare
- Finance
- Real Estate
- Manufacturing
- Retail
- And more...

### Tips Section
- Keep it brief (under 15 seconds)
- Lead with value, not features
- Create curiosity
- Establish credibility
- Ask permission to continue

### FAQ Questions
1. What makes a good cold call opening line?
2. How long should an opening line be?
3. Should I use the same opener for everyone?
4. How do I personalize opening lines?
5. What should I avoid in opening lines?
6. Can I use these commercially?
7. Are there industry-specific examples?
8. How do I measure opener effectiveness?

## Implementation Checklist

- [ ] Create page component with SEO meta tags
- [ ] Implement structured data (JSON-LD)
- [ ] Build opening lines display component
- [ ] Create industry selector
- [ ] Add opening lines database
- [ ] Implement copy functionality
- [ ] Create tips section
- [ ] Add FAQ section
- [ ] Implement internal linking
- [ ] Add CTA components
- [ ] Optimize for performance
