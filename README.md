# SchemaForge — Draft-04 JSON Schema Builder & Tester

Build, lint, and test **JSON Schema Draft-04** documents for the **webMethods API Gateway 11.1** *Request Validation* policy.
100% client-side static React app — **no backend, nothing leaves the browser** (projects persist in `localStorage`).

---

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: round-trip, lint, presets, generator, ESB CSV parser, store flows (54 tests)
npm run build      # type-check + static build into dist/
npm run preview
```

### Offline / Corporate Firewall Usage
If external hosting (Vercel/Netlify) is blocked on your corporate network:
1. Run locally via `npm run dev` or `npm run preview`, or
2. Serve the static `dist/` folder with Python (`python -m http.server 8080 --directory dist`) or an internal Nginx/IIS container.

---

## Features

### 1. Three Ways to Build a Schema (Mix & Match)
* **Visual Tree Builder**
  * Field rows with name, Draft-04 type (`string`, `integer`, `number`, `boolean`, `object`, `array`), **Required (`*`)** toggle, **Nullable (`∅`)** toggle, description, and expandable rules drawer.
  * **Large-Schema Ergonomics (150+ fields)**:
    * Instant **Search bar** (matches field name, description, or pattern and auto-expands matching ancestor branches).
    * **`* Req` filter toggle** to inspect only mandatory fields.
    * **`Collapse all` / `Expand all`** buttons and child-field count badges on nested objects (`{14}`).
    * Drag-and-drop reordering, field duplication (`⧉`), and bulk `Forbid extra props (recursive)`.
* **Sample JSON Inference**
  * Paste a sample request body to infer nested objects, arrays (merging elements across array items), and `null` → nullable fields.
  * Smart, accept/rejectable preset suggestions (all-digit strings → numeric string with observed length, `YYYY-MM-DD` → date preset, `"Y"`/`"N"` → Y/N flag).
* **Field Spec Table & ESB / SNAP BI CSV Importer**
  * Paste TSV/CSV from Excel/Confluence or Markdown tables, or use **`📂 Upload .csv`** / **`📚 Bulk CSVs → Projects`**.
  * **Automatic Windows-1252 (`cp1252`) Fallback**: Decodes Excel CSV exports containing smart quotes (`0x93`/`0x94`) or en-dashes (`0x96`) without corruption.
  * **ESB / SNAP BI Mapping Sheet Intelligence**:
    * Automatically detects the real header row (`Parameter` + `Data Type` + `JSON Path`), skipping title banners on Row 1 (`ESB PARAMETER` / `API PARAMETER`).
    * Filters to **Request Body (`Input`)** rows only, stops automatically at **`Response Data` / `OUTPUT`** section dividers (even if `"Input"` was accidentally left in column 0 below the divider), and ignores HTTP header rows (`Location = Header` or empty JSON path).
    * Normalizes JSONPath (`$.cardInfo.cardNo` → `cardInfo.cardNo`) and deduplicates indexed arrays (`items[0]..items[9]`, `items[*]` → `items[].field`).
    * Understands banking length notations: `18,2` / `18.2` / `17,2 (18 Inc Decimal)` → `maxLength: 18` + decimal pattern `^[0-9]+(\.[0-9]{1,2})?$`; `19,0` → 19-digit integer string; `(1,19)` / `1-19` → `minLength: 1, maxLength: 19`.
    * Understands date lengths: `String (Date)` with length `4` → `MMDD`, length `8` → `YYYYMMDD`, length `10` (or unset) → `YYYY-MM-DD`.
    * Interactive preview table with search/filter and editable rows before generating or merging into the tree.

### 2. Multi-Service Bulk Workflows
* **📚 Bulk CSVs → Projects**: Select 5–20 ESB/SNAP CSV files at once; each file becomes a complete project in the left sidebar with a pre-generated valid test payload in its Test Suite.
* **⬇ Download all `.json`**: One-click batch download in the sidebar exports `<project-name>.schema.json` for every project, plus full workspace JSON import/export (`Export all` / `Import`).

### 3. Built-in Presets & Reusable Banking Blocks
* **24 Built-in Presets**:
  * *Strings & Codes*: Alphanumeric, Numeric string (`^[0-9]{1,N}$`), Alphabetic, Identifier, Y/N flag, Blank-or-code (`^[A-Z]?$`), Free-text, Nullable free-text.
  * *Dates & Times*: Date `YYYY-MM-DD` (with optional empty string & calendar warning), Datetime ISO 8601, Time `HH:mm:ss`.
  * *Banking*: Bank ID (`0–99`), Branch ID (5 digits), Account Number (19 digits), Decimal Amount (`^[0-9]+(\.[0-9]{1,2})?$`).
  * *Formats*: Email, Phone Number, UUID, URL, IPv4.
  * *Reusable Object Blocks*:
    * **Pagination block** (`flag`, nullable `key`)
    * **Standard header block** (`channelId`, `requestId`, `timestamp`)
    * **ESB `finSvcHeaderInfo` block** (`usecaseName`, `transactionId`, `timestamp`, `sourceId`, `version`, `channelId`, `serviceName`)
    * **Source of Fund (`sofInfo`) block** (`sofAccountNo`, `sofAccountType`, `sofAccountName`, `sofBankId`, `sofBranchId`, `sofCurrency`)
* **Custom Presets**: Save any configured field (including nested objects) as a reusable preset (`☆`) and import/export your preset library as JSON.
* **Built-in Templates**: Ships with `AcctBindingInq` and `CASATransactionHistoryRequest`.

### 4. Real-Time Draft-04 Linter (with One-Click Fixes)
Runs on every schema change and flags:
* **Errors**: Unsupported Draft-04 keywords (`nullable`, `const`, `examples`, `$id`, `$defs`, `if/then/else`, `contains`, `propertyNames`), non-boolean `exclusiveMinimum`/`exclusiveMaximum`, `required` property missing from `properties`, invalid ECMA-262 regex, `minLength > maxLength`, `minimum > maximum`.
* **Warnings**: Description mentions allowed values (`Valid values: CDA, SDA`, `Y/N`) without `enum` (one-click extract), description mentions `(Required)`/`Mandatory` vs `required` mismatch, description length vs `maxLength` mismatch, redundant/conflicting regex length quantifiers, unanchored regex (missing `^`/`$`), calendar date regex caveat, numeric string vs integer reminder, empty string `""` passing on required string without `minLength`, missing `additionalProperties`.
* **Info**: Nullable field with `pattern`, object without `required` array.

### 5. Live Test Payload & Regression Suite (`ajv-draft-04`)
* Real Draft-04 validation (`allErrors: true`, `unicodeRegExp: false`) with plain-English explanations, fix hints, missing-required summary, and click-to-jump line highlighting.
* **Test Suite**: Save named positive/negative test payloads with expected pass/fail outcomes and run all tests with one click.

### 6. Sample & Negative Test Generator
* **Valid Payload Generator**: Respects `pattern` (via `randexp`), `enum`, `minLength`/`maxLength`, numeric bounds, and `format`, with an `Include optional fields` toggle.
* **Negative & Boundary Cases**: Automatically generates one-violation-at-a-time test cases (missing required, `maxLength + 1`, `minLength - 1`, empty string, pattern violation, enum violation, wrong type, `null` on non-nullable, numeric boundary violations, unexpected extra property) and highlights any mismatch between expected and actual validator outcomes.
* **Exporters**: Export valid + negative cases as a **Postman Collection v2.1** (with test scripts checking HTTP 200 vs 400) or **cURL** script.

---

## Architecture

| Path | Purpose |
|---|---|
| `src/model/types.ts` | The **tree model** (`Field`) — single source of truth. |
| `src/model/toSchema.ts` | Tree → Draft-04 JSON (always emits `$schema`; nullable ⇒ `type:[t,"null"]`; adds `null` to `enum` for nullable fields; `required` derived from toggles). |
| `src/model/fromSchema.ts` | JSON → tree. Throws `Unsupported` (→ raw mode, with reason) for `$ref`, `oneOf/anyOf/allOf/not`, tuples, etc. Unknown keywords are preserved in `Field.extra` so the linter can flag and fix them. |
| `src/model/presets.ts` | 24 built-in presets (including `finSvcHeaderInfo` & `sofInfo` blocks) + custom-preset helpers. |
| `src/model/infer.ts` | Sample JSON → tree + accept/reject preset suggestions. |
| `src/model/specTable.ts` | TSV/CSV/Markdown & ESB/SNAP BI CSV parser (`parseSpecText`, `specRowsToFields`). |
| `src/model/decode.ts` | `Uint8Array` / `ArrayBuffer` decoder with UTF-8 → Windows-1252 (`cp1252`) fallback. |
| `src/lint/lint.ts` | Draft-04 static analyzer + one-click JSON patch fixes. |
| `src/engine/validator.ts` | `ajv-draft-04` wrapper (`allErrors`), plain-English errors, fix hints, payload line locator. |
| `src/engine/generate.ts` | Valid / invalid / boundary payload generation (`randexp` for patterns). |
| `src/engine/export.ts` | Postman Collection v2.1 and cURL script generators. |
| `src/store.ts` | Zustand store: projects, undo/redo (`Ctrl+Z`/`Ctrl+Y`), `localStorage` persistence, raw-mode sync, bulk CSV import. |
| `tests/core.test.ts` | Round-trip, Draft-04 compliance, lint, presets, inference, spec parser, generator tests. |
| `tests/skn.test.ts` | Integration tests against real ESB CSVs (`InterbankSKNLCY.csv`, `InterbankSKNFCY.csv`, `IFTRTGSLCY.csv`, `RealtimeFundTransfer.csv`, etc.). |

---

## How to Add a Preset

Edit `BUILTIN_PRESETS` in `src/model/presets.ts` and add an entry:

```ts
P({
  id: 'myCode', name: 'My code', group: 'Codes', fieldName: 'myCode',
  description: '…', params: [maxP],                 // optional configurable params
  valid: ['AB12'], invalid: ['ab', ''],            // shown in the UI & tested by Vitest
  build: (p) => ({ type: 'string', rules: { pattern: '^[A-Z0-9]+$', minLength: 1, maxLength: +p.maxLength } }),
}),
```

`tests/core.test.ts` automatically verifies every preset: its `valid` examples must pass and `invalid` examples must fail against the generated Draft-04 schema.
