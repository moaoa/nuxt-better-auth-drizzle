# Free Tools Roadmap for Phone / Calling SaaS

This document defines the **free tools** to build as SEO + lead-generation assets for the calling SaaS.
Each section represents **one tool** and should be implemented as a standalone page under:

```
/tools/<tool-slug>
```

---

## 1. Phone Number Checker

**Main Keyword:** phone number checker
**Search Intent:** Validate a phone number before calling

### Description

A tool that validates phone numbers and returns useful metadata for sales and support teams.

### Inputs

* Phone number (string)
* Optional country selector

### Outputs

* Valid / invalid
* Country
* Carrier
* Line type (mobile / landline / VoIP)
* International format (E.164)

### API

* PhoneVerify.online (free tier)

### CTA

> Call this number instantly using **YourAppName**

---

## 2. International Call Cost Calculator

**Main Keyword:** international call cost calculator
**Search Intent:** Estimate calling costs before choosing a provider

### Description

Calculates estimated monthly calling costs based on destination country and usage.

### Inputs

* From country
* To country
* Minutes per month

### Outputs

* Estimated monthly cost
* Cost per minute
* Comparison vs VoIP

### API

* None (static pricing table)

### CTA

> Save money by calling internationally with **YourAppName**

---

## 3. Best Time to Call Internationally

**Main Keyword:** best time to call internationally
**Search Intent:** Avoid calling people at bad times

### Description

Shows the best overlap hours between two time zones.

### Inputs

* Caller country
* Recipient country

### Outputs

* Current local time for both
* Working hours overlap
* Recommended calling window

### API

* WorldTimeAPI or IPGeolocation Timezone API

### CTA

> Schedule your calls automatically with **YourAppName**

---

## 4. Phone Number Formatter

**Main Keyword:** phone number formatter
**Search Intent:** Clean and standardize phone numbers

### Description

Formats phone numbers into international formats.

### Inputs

* Raw phone number
* Country

### Outputs

* E.164 format
* National format
* Click-to-call link

### API

* None

### CTA

> Import formatted numbers directly into **YourAppName**

---

## 5. Click-to-Call Button Generator

**Main Keyword:** click to call button generator
**Search Intent:** Enable calling from websites

### Description

Generates ready-to-use call buttons for websites.

### Inputs

* Phone number
* Button style

### Outputs

* HTML code
* QR code
* Preview

### API

* None

### CTA

> Handle incoming calls with **YourAppName**

---

## 6. Missed Call Cost Calculator

**Main Keyword:** missed call cost calculator
**Search Intent:** Measure revenue loss from missed calls

### Description

Calculates potential revenue lost due to unanswered calls.

### Inputs

* Calls per day
* Missed call percentage
* Average deal value

### Outputs

* Monthly revenue loss
* Annual revenue loss

### API

* None

### CTA

> Never miss a call again with **YourAppName**

---

## 7. VoIP vs GSM Call Comparison

**Main Keyword:** voip vs gsm calls
**Search Intent:** Decide between VoIP and traditional calls

### Description

Compares cost, quality, and scalability between VoIP and GSM calls.

### Inputs

* Destination country
* Minutes per month

### Outputs

* Cost comparison
* Feature comparison
* Recommendation

### API

* None

### CTA

> Switch to VoIP calling with **YourAppName**

---

## 8. International Dialing Codes Lookup

**Main Keyword:** international dialing codes
**Search Intent:** Find country calling codes

### Description

Quick lookup tool for international calling prefixes.

### Inputs

* Country name

### Outputs

* Country code
* Example phone number

### API

* FreeIPAPI (optional)

### CTA

> Start international calls with **YourAppName**

---

## 9. Business Phone Number Lookup

**Main Keyword:** business phone number lookup
**Search Intent:** Verify business contact numbers

### Description

Checks and enriches business phone numbers.

### Inputs

* Phone number

### Outputs

* Validity
* Carrier
* Line type

### API

* Phone validation API

### CTA

> Call verified businesses using **YourAppName**

---

## 10. Sales Call Script Generator

**Main Keyword:** sales call script generator
**Search Intent:** Improve call conversions

### Description

Generates ready-to-use sales call scripts.

### Inputs

* Industry
* Call type

### Outputs

* Opening line
* Objection handling
* Closing script

### API

* Optional AI API

### CTA

> Use this script inside **YourAppName**

---

## 11. Cold Call Opening Lines

**Main Keyword:** cold call opening lines

### Description

Displays high-performing cold call openers by industry.

### Inputs

* Industry

### Outputs

* List of opening lines

### API

* None

### CTA

> Start cold calling with **YourAppName**

---

## 12. Call Center Cost Calculator

**Main Keyword:** call center cost calculator

### Description

Estimates operational costs of running a call center.

### Inputs

* Agents count
* Minutes per agent
* Cost per minute

### Outputs

* Monthly cost
* Annual cost

### API

* None

### CTA

> Reduce call center costs with **YourAppName**

---

## 13. Call Volume Estimator

**Main Keyword:** call volume estimator

### Description

Estimates expected call volume based on business size.

### Inputs

* Customers count
* Calls per customer

### Outputs

* Daily calls
* Monthly calls

### API

* None

### CTA

> Scale calls easily with **YourAppName**

---

## 14. Timezone Overlap Calculator

**Main Keyword:** timezone overlap calculator

### Description

Calculates shared working hours between two locations.

### Inputs

* Location A
* Location B

### Outputs

* Overlap hours
* Best meeting / calling time

### API

* WorldTimeAPI

### CTA

> Coordinate global calls with **YourAppName**

---

## 15. Phone Number Validation API Page

**Main Keyword:** phone number validation api free

### Description

Landing page describing a free phone validation API tier.

### Inputs

* Phone number

### Outputs

* JSON response

### API

* PhoneVerify.online

### CTA

> Upgrade to full calling APIs with **YourAppName**

---

## Global Notes for Developer

* All tools must be fast (no auth required)
* Soft email gate only after showing value
* Each page must include internal links to other tools
* All CTAs must link to main SaaS signup
