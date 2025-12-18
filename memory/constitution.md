# Notion Integrations Constitution

## Core Principles

### I. Queue-Based API Calls (NON-NEGOTIABLE)
**All external API calls (Notion API, Google Sheets API, etc.) MUST be made through queues, never directly from API endpoints or handlers.**

- **Rule**: Never call external APIs directly from API endpoint handlers, webhook handlers, or any request handlers
- **Implementation**: Always add a job to the appropriate queue and let the worker handle the API call
- **Rationale**: 
  - Rate limiting: Queues enforce rate limits automatically
  - Reliability: Automatic retries with exponential backoff
  - Scalability: Jobs can be processed asynchronously
  - Observability: Better tracking and monitoring of API calls
  - Error handling: Centralized error handling and logging

**Examples:**
- ✅ **Correct**: Webhook handler queues a `notion-page-fetch` job → Worker fetches from Notion API → Worker queues `mapping-sync` job → Worker writes to Google Sheets
- ❌ **Incorrect**: Webhook handler directly calls `notion.pages.retrieve()` or `sheets.spreadsheets.values.update()`

**Queues:**
- `notion-sync`: Bulk Notion entity syncing
- `notion-page-fetch`: Single Notion page fetching (used by webhooks)
- `mapping-sync-queue`: Google Sheets mapping sync
- `google-sheets`: Google Sheets operations

### [PRINCIPLE_2_NAME]
<!-- Example: II. CLI Interface -->
[PRINCIPLE_2_DESCRIPTION]
<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

### [PRINCIPLE_2_NAME]
<!-- Example: II. CLI Interface -->
[PRINCIPLE_2_DESCRIPTION]
<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

### [PRINCIPLE_3_NAME]
<!-- Example: III. Test-First (NON-NEGOTIABLE) -->
[PRINCIPLE_3_DESCRIPTION]
<!-- Example: TDD mandatory: Tests written → User approved → Tests fail → Then implement; Red-Green-Refactor cycle strictly enforced -->

### [PRINCIPLE_4_NAME]
<!-- Example: IV. Integration Testing -->
[PRINCIPLE_4_DESCRIPTION]
<!-- Example: Focus areas requiring integration tests: New library contract tests, Contract changes, Inter-service communication, Shared schemas -->

### [PRINCIPLE_5_NAME]
<!-- Example: V. Observability, VI. Versioning & Breaking Changes, VII. Simplicity -->
[PRINCIPLE_5_DESCRIPTION]
<!-- Example: Text I/O ensures debuggability; Structured logging required; Or: MAJOR.MINOR.BUILD format; Or: Start simple, YAGNI principles -->

## [SECTION_2_NAME]
<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

[SECTION_2_CONTENT]
<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

## [SECTION_3_NAME]
<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

[SECTION_3_CONTENT]
<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

[GOVERNANCE_RULES]
<!-- Example: All PRs/reviews must verify compliance; Complexity must be justified; Use [GUIDANCE_FILE] for runtime development guidance -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->