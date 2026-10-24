# CLAUDE.md — SchemaForge & webMethods API Gateway (Draft-04) Agent Guide

This document gives AI coding agents (Claude Code, Cursor, Windsurf, Playwright MCP agents, etc.) complete context to:
1. Maintain and extend **SchemaForge** (the Draft-04 JSON Schema generator, linter, and tester web app).
2. Convert banking API specifications (`.xlsx`, `.csv`, `.tsv`, `.docx`, `.md`)—including 150+ field services like **SKN**, **RTGS**, **SWIFT**, and **BI-FAST**—into verified **JSON Schema Draft-04** files for **webMethods API Gateway 11.1**.
3. Drive either the **SchemaForge TypeScript engine** directly or automate **SchemaForge / webMethods API Gateway** via **Playwright MCP**.

---

## 1. Quick Commands

```bash
# Inside schemaforge/
npm install
npm run dev        # Start Vite dev server (http://localhost:5173)
npm test           # Run Vitest suite (54 tests: Draft-04 rules, round-trip, lint, presets, SKN CSVs)
npm run build      # TypeScript check + production static build in dist/
```

---

## 2. Non-Negotiable JSON Schema Draft-04 Rules (webMethods API Gateway 11.1)

webMethods API Gateway 11.1's **Validate API Specification** policy uses **JSON Schema Draft-04** for request body validation. Every generated schema **MUST** obey these rules:

1. **Always declare Draft-04 at the root:**
   ```json
   "$schema": "http://json-schema.org/draft-04/schema#"
   ```
2. **FORBIDDEN keywords (Draft-06 / Draft-07 / OpenAPI 3.0 — NEVER emit these):**
   * ❌ `"nullable": true` → ✅ Use `"type": ["string", "null"]` (and if `"enum"` is present on a nullable field, include `null` in the `"enum"` array: `"enum": ["Y", "N", null]`).
   * ❌ `"const": "X"` → ✅ Use `"enum": ["X"]`.
   * ❌ `"$id"` → ✅ Use `"id"`.
   * ❌ `"$defs"` → ✅ Use `"definitions"`.
   * ❌ `"examples"`, `"if"`, `"then"`, `"else"`, `"contains"`, `"propertyNames"`, `"readOnly"`, `"writeOnly"`, `"deprecated"`.
3. **`exclusiveMinimum` / `exclusiveMaximum` are BOOLEANS in Draft-04:**
   * ❌ `"exclusiveMinimum": 0` (Draft-07 style — fails to compile in Draft-04!)
   * ✅ `"minimum": 0, "exclusiveMinimum": true`
4. **`required` is an array on the parent `object`, never a boolean on the property:**
   * Every entry in `required` MUST exist in that object's `properties`.
   * For required strings that must not be blank `""`, always include `"minLength": 1` (unless a regex `pattern` already forbids `""`).
5. **Anchor all regex patterns:**
   * Every `pattern` must be ECMA-262 compatible and anchored with `^` and `$` (e.g. `^[0-9]{1,19}$`, or `^$|^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$` when blank is allowed).
   * Do not use PCRE/Java-only constructs (`(?i)`, `(?>...)`, `++`, `\A`, `\z`).

---

## 3. Banking / ESB / SNAP BI Spec Conventions (How to Interpret `.xlsx` / `.csv` / `.docx`)

When reading banking mapping sheets (ESB Parameter specs, SNAP BI specs, Confluence tables, Excel workbooks):

### 3.1 Filtering Rows (Crucial for 150+ Field Services like SKN / RTGS / SWIFT)
* **Banner vs Header Row:** Row 1 is often a merged banner (`ESB PARAMETER | PROVIDER PARAMETER` or `API PARAMETER`). Row 2 is the actual column header (`Input / Output`, `Location`/`Located`, `Field Name`, `Path`, `Data Type`, `Length`, `M/N/O`, `Encrypted`, `LOV ID`, `Remarks`/`Description`). Ignore the right-side `PROVIDER PARAMETER` / `DSP` columns.
* **Stop at Response Sections:** Spec sheets often have a section divider row (`Response Data`, `Response Data for Success`, `OUTPUT`) halfway down the sheet. In some sheets (e.g. `InterbankSKNLCY.csv`, `InterbankSKNFCY.csv`, `IFTRTGSLCY.csv`), the author accidentally left `"Input"` in column A under the `Response Data` section (`$.statusCode`, `$.subStatusCode`, `$.tmqF1.*`, `$.tmqR0.*`). **Stop reading request fields as soon as a Response section banner row appears.**
* **Skip HTTP Headers:** Rows with `Location = Header` (or rows with an empty `Path` when the sheet has a JSON `Path` column, such as `Request-ID`, `CIMB-APIKey`, `CIMB-Timestamp`) are HTTP headers, **not** JSON request body properties.

### 3.2 Mapping Data Types & Lengths
| Spec Type / Length | Meaning | Correct Draft-04 Schema Output |
|---|---|---|
| `String (Numeric Only)` / `Numeric` / `NC`, length `N` | Digits carried as a JSON string (e.g. `accountNo`, `branchId`, `journalSeqNum`, `custPermId`) | `"type": "string", "pattern": "^[0-9]{1,N}$", "maxLength": N` (plus `"minLength": 1` if required). **Do NOT use `"type": "integer"`**—clients send `"00123"` as a string and 19-digit account numbers exceed IEEE-754 safe integers. |
| `Long` / `Integer`, length `N` | JSON integer (e.g. `bankId` len 2, `rebidRequest` len 3) | `"type": "integer", "maximum": 10^N - 1` (e.g. len 2 → `maximum: 99`, len 3 → `maximum: 999`). |
| `String (Decimal)` or length `18,2` / `18.2` / `17,2 (18 Inc Decimal)` | Decimal amount or rate as a string (`precision, scale` where `precision >= scale` and `scale > 0`) | `"type": "string", "pattern": "^[0-9]+(\\.[0-9]{1,SCALE})?$", "maxLength": PRECISION` |
| Length `19,0` / `9,0` | COBOL/DSP integer-digits notation (`scale = 0`) | `maxLength: 19` (or `9`), 0 decimals. |
| Length `1-19` / `(1,19)` | Min/Max character length (`first < second`) | `"minLength": 1, "maxLength": 19` |
| `Date` / `String (Date)` | Length 10 (or unset): `YYYY-MM-DD`<br>Length 8: `YYYYMMDD`<br>Length 4 (ISO-8583): `MMDD` | Len 10: `"pattern": "^[0-9]{4}-(0[1-9]\|1[0-2])-([0-2][0-9]\|3[0-1])$", "maxLength": 10`<br>Len 8: `"pattern": "^[0-9]{4}(0[1-9]\|1[0-2])([0-2][0-9]\|3[0-1])$", "maxLength": 8`<br>Len 4: `"pattern": "^(0[1-9]\|1[0-2])([0-2][0-9]\|3[0-1])$", "maxLength": 4` |
| `Datetime` / `Timestamp` | ISO 8601 timestamp | `"type": "string", "pattern": "^[0-9]{4}-(0[1-9]\|1[0-2])-([0-2][0-9]\|3[0-1])T([01][0-9]\|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]+)?(Z\|[+-]([01][0-9]\|2[0-3]):[0-5][0-9])$"` |
| `Stirng` / `strng` | Common spec typo | Normalize to `"type": "string"`. |

### 3.3 Mandatory / Optional (`M/N/O`) & Descriptions
* `M` / `Y` / `Mandatory` / `Required` → `required: true` (and `minLength: 1` for strings).
* `O` / `N` / `Optional` → `required: false`.
* `M/O`, `O/M`, `MO`, `C` (Conditional, e.g. *"Mandatory when R0TRXTCD = 59"*) → Treat as **optional (`required: false`)** in Draft-04 so valid requests where the condition doesn't apply aren't rejected by the gateway, and preserve the condition in `description`.
* **Allowed values in `Remarks` / `Description`:** When `Remarks` lists codes like `Valid values: 'CDA', 'SDA'`, `Expected Value: C - Credit, D - Debit, *Blanks - Both`, or `Y - Yes, N - No`, extract `"enum": ["CDA", "SDA"]` (include `""` when `*Blanks` is allowed).

### 3.4 JSON Paths & Arrays
* Strip leading `$.` (e.g. `$.finSvcHeaderInfo.chequeNo` → `finSvcHeaderInfo.chequeNo`).
* Normalize indexed array paths like `$.beneficiaryListAddress[0].beneficiaryAddress`, `[1]`, `[2]` or `[*]` into `beneficiaryListAddress[].beneficiaryAddress` and merge duplicate index rows into a single `array` of `object` schema.

---

## 4. SchemaForge Codebase Architecture

All source code lives in `schemaforge/src/`:

* **`src/model/types.ts`** — Single-source-of-truth internal tree model (`Field`, `Rules`, `Project`, `TestCase`).
* **`src/model/toSchema.ts`** — `fieldToSchema(field)` and `buildSchema(project)` convert the `Field` tree into strict Draft-04 JSON.
* **`src/model/fromSchema.ts`** — `fromSchema(json)` parses any Draft-04 JSON into the `Field` tree. Throws `Unsupported` (falling back to raw mode) if the schema uses `$ref`, `oneOf`/`anyOf`/`allOf`/`not`, or tuple `items`. Preserves unknown keywords (like `nullable`) in `Field.extra` so the linter can flag and auto-fix them.
* **`src/model/presets.ts`** — 20+ banking & validation presets (`BUILTIN_PRESETS`), including block presets (`pagination`, `stdHeader`, `finSvcHeaderInfo`, `sofInfo`) and custom preset helpers.
* **`src/model/infer.ts`** — `inferFromSample(json, requireAll)` infers a tree from a sample JSON payload and proposes accept/rejectable preset suggestions.
* **`src/model/specTable.ts`** — `parseSpecDocument(text, opts)`, `parseTable`, `detectHeaderRow`, `detectColumns`, `interpretTable`, `rowsToTree`. Parses CSV/TSV/Markdown spec tables (including multi-hundred-row ESB/SNAP CSVs) into the `Field` tree.
* **`src/model/decode.ts`** — `decodeBytes(buffer)` decodes UTF-8 with automatic fallback to Windows-1252 (`cp1252`) for Excel CSV exports.
* **`src/lint/lint.ts`** — `lintSchema(schema)` and `applyLintFix(schema, issue)`. Static analysis checking Draft-04 compliance, unanchored/non-ECMA regexes, range conflicts, pattern-vs-length redundancies, and description-vs-schema mismatches (missing enums, missing `required`, mismatched lengths), with one-click fixes.
* **`src/engine/validator.ts`** — Real Draft-04 validation via `ajv-draft-04` + `ajv-formats` (`allErrors: true`), plain-English explanations, fix hints, and JSON pointer line-offset locator (`locatePointers`).
* **`src/engine/generate.ts`** — `genValid(schema, { optional })` (using `randexp` for patterns) and `genCases(schema)` (generates negative/invalid test cases, one violation each, plus boundary cases, and checks actual vs expected validator outcomes).
* **`src/engine/export.ts`** — Exports test cases as Postman v2.1 collections (`toPostman`) or `curl` scripts (`toCurl`).
* **`src/store.ts`** — Zustand store persisted to `localStorage` (`schemaforge:v1`) with undo/redo, version snapshots, project import/export, and raw-mode sync.

---

## 5. Programmatic Usage (For Agents Converting `.xlsx` / `.csv` Specs in Node)

An agent can convert any spec table directly into a linted, tested Draft-04 schema without opening a browser by importing the engine modules:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeBytes } from './src/model/decode';
import { parseSpecDocument, rowsToTree } from './src/model/specTable';
import { fieldToSchema } from './src/model/toSchema';
import { lintSchema, applyLintFix } from './src/lint/lint';
import { genValid, genCases } from './src/engine/generate';
import { validatePayload } from './src/engine/validator';

const text = decodeBytes(readFileSync('../InterbankSKNLCY.csv'));
const { specRows } = parseSpecDocument(text, { inputOnly: true, bodyOnly: true });
const root = rowsToTree(specRows);

let schema: any = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  title: 'InterbankSKNLCYRequest',
  ...fieldToSchema(root),
};

// Optional: inspect or auto-apply lint fixes (e.g. extract enums from descriptions)
const issues = lintSchema(schema);

// Verify a generated valid payload passes Draft-04 validation
const sample = genValid(schema, { optional: true });
const res = validatePayload(schema, sample);
if (!res.valid) throw new Error(JSON.stringify(res.issues, null, 2));

writeFileSync('./InterbankSKNLCY.schema.json', JSON.stringify(schema, null, 2));
```

---

## 6. Playwright MCP Workflow (UI Automation)

If using a **Playwright MCP** agent to drive SchemaForge or webMethods API Gateway:

1. **In SchemaForge (`http://localhost:5173`):**
   * Click the **Paste field table** tab in the left **Builder** panel.
   * Click **📂 Upload CSV / TSV file(s)** to upload one or multiple spec CSVs (or paste a table converted from `.xlsx` into the `Field spec table` textarea).
   * Review the interpreted rows in the preview table (filter by `Notes` to see any conditional `M/O` fields or unparsed values), then click **Replace current schema** or **＋ Save as new project**.
   * Check the **Lint** tab in the right panel and click **Fix** on any enum/length/Draft-04 findings.
   * Open the **Sample Generator** tab to verify that all generated negative/boundary cases behave as expected (`0 mismatch`), then click **Add all to test suite**.
   * Click **Copy** or **Download .json** in the middle panel (or **⬇ Download all .json** in the left sidebar).
2. **In webMethods API Gateway 11.1:**
   * Navigate to **APIs → `<API Name>` → Policies → Edit → Request Processing → Validate API Specification**.
   * Enable **Request Payload Validation** for `application/json` and upload/paste the downloaded Draft-04 `.schema.json`.
   * Save and activate the API.

---

## 7. Multi-Agent Coordination Flag (`D:\MII\cimb\idms`)

When picking a service workbook from `D:\MII\cimb\idms\<ServiceFolder>\`:
1. **Check before starting:** Read [`D:\MII\cimb\idms\CHECKED_STATUS.md`](../idms/CHECKED_STATUS.md) and check whether `D:\MII\cimb\idms\<ServiceFolder>\CHECKED.flag` already exists. Skip folders that already have `CHECKED.flag`.
2. **Understand the 3 horizontal column groups in `idms` `.xlsx` sheets:**
   * **Left group (`GATEWAY TRANSLATOR LAYER`):** Existing endpoint mapping (cols ~1–10).
   * **Middle group (`ESB GENERIC PARAMETER` / `ESB ORCHESTRATOR`):** To-Be GenericSpec JSON API mapping (cols ~11–21). Note that manual YAML snippets in the `Definitions` / `definitions:` column of `v1.0.1.xlsx` often contain copy-paste errors or OpenAPI 3.0 `nullable: true`—always generate the schema from the actual spec columns via SchemaForge and verify against the `Sample Req Res Payload` sheet.
   * **Right group (`CBA / SIBS PROVIDER`):** Backend DSP/provider mapping (ignore for API Gateway request validation).
3. **Flag after testing:** Once verified in SchemaForge / Playwright MCP, write `D:\MII\cimb\idms\<ServiceFolder>\CHECKED.flag` (JSON summary of generated schemas, test counts, and workbook findings) and mark the service `[x] CHECKED` in `D:\MII\cimb\idms\CHECKED_STATUS.md`.
