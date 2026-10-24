# SchemaForge — Draft-04 JSON Schema builder & tester

Build, lint and test **JSON Schema Draft-04** documents for the webMethods API Gateway 11.1 *Request Validation* policy.
Static React site — **no backend, nothing leaves the browser** (projects live in `localStorage`).

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: round-trip, lint, presets, generator, spec/infer parsers, store flows
npm run build      # type-check + static build into dist/
npm run preview
```

## Deploy (free static hosting)

* **Vercel**: import the repo (or `npx vercel`), framework preset *Vite*, build `npm run build`, output `dist`.
* **Netlify**: build `npm run build`, publish `dist`.
* **GitHub Pages**: upload `dist/` (the build uses relative asset paths, `base: './'`).

## Architecture

| Path | Purpose |
|---|---|
| `src/model/types.ts` | The **tree model** (`Field`) — single source of truth. |
| `src/model/toSchema.ts` | Tree → Draft-04 JSON (always emits `$schema`; nullable ⇒ `type:[t,"null"]`; adds `null` to `enum` for nullable fields; `required` derived from the toggles). |
| `src/model/fromSchema.ts` | JSON → tree. Throws `Unsupported` (→ raw mode, with reason) for `$ref`, `oneOf/anyOf/allOf/not`, tuples, etc. Unknown keywords are preserved in `Field.extra` so the linter can still flag them. |
| `src/model/presets.ts` | Built-in presets + custom-preset helpers. |
| `src/model/infer.ts` | Sample JSON → tree + accept/reject suggestions. |
| `src/model/specTable.ts` | TSV/CSV/Markdown field-spec parser. |
| `src/lint/lint.ts` | Lint rules (run on the derived JSON, fixes patch the JSON then re-import into the tree). |
| `src/engine/validator.ts` | `ajv-draft-04` wrapper (`allErrors`), plain-English errors, fix hints, payload line locator. |
| `src/engine/generate.ts` | Valid / invalid / boundary payload generation (`randexp` for patterns). |
| `src/store.ts` | zustand store: projects, undo/redo, persistence, raw-mode sync. |
| `src/components/**` | UI. |

## How to add a preset

Edit `BUILTIN_PRESETS` in `src/model/presets.ts` and add an entry:

```ts
P({
  id: 'myCode', name: 'My code', group: 'Codes', fieldName: 'myCode',
  description: '…', params: [maxP],                 // optional configurable params
  valid: ['AB12'], invalid: ['ab', ''],            // shown in the UI
  build: (p) => ({ type: 'string', rules: { pattern: '^[A-Z0-9]+$', minLength: 1, maxLength: +p.maxLength } }),
}),
```

`tests/core.test.ts` automatically checks every preset: its `valid` examples must pass and `invalid` must fail against the schema it builds, and it must not emit any non-Draft-04 keyword.
Users can also save any field as a custom preset (☆) and import/export them from the **Presets** dialog.

## How to add a lint rule

In `src/lint/lint.ts`, inside `visit()` (it is called for every schema node with its JSON pointer `ptr`) call:

```ts
add('warning', 'my-rule', ptr, `${label}: message`,
    nodeFix(ptr, 'Fix label', (node) => { node.maxLength = 10; }));   // fix is optional
```

`nodeFix` receives the node of a *clone* of the schema; the store re-imports the result into the tree. Add a case to `tests/core.test.ts`.

## Notes

* Validation uses `unicodeRegExp: false` (ECMA-262 non-unicode semantics) and `strict: false` so Draft-06+ keywords in pasted schemas are *reported by the linter* rather than crashing the validator.
* The gateway's own validator may differ in regex dialect / `format` handling — always verify on the gateway.
