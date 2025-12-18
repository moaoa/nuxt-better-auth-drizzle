# Notion to Google Sheets - Data Mapping

## Property Type Mapping

This document specifies how each Notion property type maps to Google Sheets column formats.

## Mapping Table

| Notion Type | Sheets Format | Transformation | Notes |
|-------------|---------------|----------------|-------|
| `title` | Text | Extract plain text | Always column A (primary identifier) |
| `rich_text` | Text | Strip formatting, join blocks | Preserves text content only |
| `number` | Number | Direct value | Preserves decimals and formatting |
| `select` | Text | Option name string | Single value |
| `multi_select` | Text | Comma-separated | `"Option1, Option2, Option3"` |
| `date` | Date | ISO 8601 or formatted | Handles start/end dates |
| `checkbox` | Boolean | `TRUE` / `FALSE` | Google Sheets native boolean |
| `url` | Text | Direct URL string | Can use `=HYPERLINK()` |
| `email` | Text | Direct email string | Plain text |
| `phone_number` | Text | Direct phone string | Plain text |
| `people` | Text | Comma-separated names | User display names |
| `files` | Text | Comma-separated URLs | File download URLs |
| `relation` | Text | Comma-separated page titles | Linked page titles |
| `rollup` | Varies | Depends on rollup type | Number, date, or array |
| `formula` | Varies | Computed result | String, number, date, or boolean |
| `created_time` | DateTime | ISO 8601 | Read-only |
| `created_by` | Text | User name | Read-only |
| `last_edited_time` | DateTime | ISO 8601 | Read-only |
| `last_edited_by` | Text | User name | Read-only |
| `status` | Text | Status option name | Single value |
| `unique_id` | Text | Prefix + number | e.g., "TASK-123" |

## Transformation Functions

### Title Property

```typescript
function transformTitle(property: TitleProperty): string {
  return property.title
    .map((block) => block.plain_text)
    .join('');
}
```

### Rich Text Property

```typescript
function transformRichText(property: RichTextProperty): string {
  return property.rich_text
    .map((block) => block.plain_text)
    .join('');
}
```

### Select Property

```typescript
function transformSelect(property: SelectProperty): string {
  return property.select?.name ?? '';
}
```

### Multi-Select Property

```typescript
function transformMultiSelect(property: MultiSelectProperty): string {
  return property.multi_select
    .map((option) => option.name)
    .join(', ');
}
```

### Date Property

```typescript
function transformDate(property: DateProperty): string {
  if (!property.date) return '';
  
  const { start, end } = property.date;
  if (end) {
    return `${start} → ${end}`;
  }
  return start;
}
```

### Checkbox Property

```typescript
function transformCheckbox(property: CheckboxProperty): boolean {
  return property.checkbox;
}
```

### People Property

```typescript
function transformPeople(property: PeopleProperty): string {
  return property.people
    .map((person) => person.name ?? person.id)
    .join(', ');
}
```

### Relation Property

```typescript
async function transformRelation(
  property: RelationProperty,
  notionClient: Client
): Promise<string> {
  const titles = await Promise.all(
    property.relation.map(async (ref) => {
      const page = await notionClient.pages.retrieve({ page_id: ref.id });
      return getPageTitle(page);
    })
  );
  return titles.join(', ');
}
```

### Formula Property

```typescript
function transformFormula(property: FormulaProperty): string | number | boolean {
  const { formula } = property;
  
  switch (formula.type) {
    case 'string':
      return formula.string ?? '';
    case 'number':
      return formula.number ?? 0;
    case 'boolean':
      return formula.boolean ?? false;
    case 'date':
      return formula.date?.start ?? '';
    default:
      return '';
  }
}
```

### Rollup Property

```typescript
function transformRollup(property: RollupProperty): string | number {
  const { rollup } = property;
  
  switch (rollup.type) {
    case 'number':
      return rollup.number ?? 0;
    case 'date':
      return rollup.date?.start ?? '';
    case 'array':
      // Recursively transform array items
      return rollup.array
        .map((item) => transformProperty(item))
        .join(', ');
    default:
      return '';
  }
}
```

## Edge Cases

### Empty Values

All transformations should handle null/undefined gracefully:

```typescript
function safeTransform<T>(value: T | null | undefined, transform: (v: T) => string): string {
  if (value === null || value === undefined) {
    return '';
  }
  return transform(value);
}
```

### Unsupported Types

Some Notion-specific features don't map cleanly to Sheets:

| Type | Handling |
|------|----------|
| `verification` | Skip (internal Notion feature) |
| `button` | Skip (action, not data) |
| Inline databases | Reference as link |
| Embedded content | Extract URL if available |

### Special Characters

Google Sheets has limitations with certain characters:

```typescript
function sanitizeForSheets(value: string): string {
  // Escape leading characters that Sheets interprets as formulas
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}
```

## Mapping Configuration Schema

Store mapping preferences per automation:

```typescript
interface ColumnMapping {
  notionPropertyId: string;
  notionPropertyName: string;
  notionPropertyType: string;
  sheetColumnIndex: number;    // 0-based
  sheetColumnLetter: string;   // "A", "B", etc.
  transformOptions?: {
    dateFormat?: string;       // e.g., "YYYY-MM-DD"
    numberFormat?: string;     // e.g., "#,##0.00"
    includeTime?: boolean;
    delimiter?: string;        // For multi-select, default ", "
  };
}

interface MappingConfig {
  automationId: string;
  headerRow: number;           // Usually 1
  dataStartRow: number;        // Usually 2
  columns: ColumnMapping[];
  includeNotionId: boolean;    // Add hidden column with page ID
  includeLastSync: boolean;    // Add timestamp column
}
```

## Column Ordering Strategy

1. **Title property** always maps to column A
2. **Notion Page ID** (hidden) in column B if `includeNotionId` is true
3. **Remaining properties** in order of their position in Notion database
4. **Metadata columns** (last_sync, etc.) at the end

## Next Steps

- [03-sync-strategy.md](./03-sync-strategy.md) - Sync direction and conflict handling
- [04-implementation.md](./04-implementation.md) - Code-level implementation guide



