import { useMemo, useState } from 'react';
import { CodeEditor, copy, download, Modal, readFile } from './common';
import { useActive, useStore } from '../store';
import { useSchema } from '../hooks';
import { BUILTIN_PRESETS, customToPreset } from '../model/presets';

export function HowToModal() {
  const { setUI, createProject } = useStore();
  const active = useActive();
  const [tab, setTab] = useState<'quickstart' | 'esb' | 'builder' | 'testing' | 'agents'>('quickstart');

  const jumpTo = (leftTab?: 'visual' | 'sample' | 'spec', rightTab?: 'lint' | 'test' | 'gen') => {
    if (!active) createProject('New Service Schema');
    setUI({
      modal: null,
      ...(leftTab ? { leftTab } : {}),
      ...(rightTab ? { rightTab } : {}),
    });
  };

  const tabs = [
    ['quickstart', '⚡ Quick Start'],
    ['esb', '📊 ESB & IDMS Excel/CSV'],
    ['builder', '🛠 Builder & Draft-04 Rules'],
    ['testing', '🧪 Lint, Test & Generator'],
    ['agents', '🤖 AI Agent & IDMS Workflow'],
  ] as const;

  return (
    <Modal title="📖 How to Use SchemaForge" onClose={() => setUI({ modal: null })} wide>
      <div className="space-y-4 text-sm">
        <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-700">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                tab === k
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'quickstart' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100">
              <b>Goal:</b> Go from an ESB/SNAP mapping sheet, sample payload, or field list to a verified, copy-ready <b>JSON Schema Draft-04</b> for <b>webMethods API Gateway 11.1</b> in under 2 minutes — 100% locally in your browser.
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Step 1 — Import or Build Your Schema</span>
                  <span className="chip bg-slate-200 dark:bg-slate-700">Left Panel</span>
                </div>
                <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                  Pick any of the three input modes (you can mix and match them on the same project):
                </p>
                <ul className="ml-4 list-disc space-y-1 text-xs">
                  <li><b>Spec table:</b> Upload an ESB/SNAP <code>.csv</code> (or bulk-upload 20 CSVs at once) or paste from Excel/Confluence.</li>
                  <li><b>Sample JSON:</b> Paste an example JSON request payload to auto-infer structure and smart rule suggestions.</li>
                  <li><b>Tree builder:</b> Add fields visually, apply banking presets, or insert reusable blocks (<code>finSvcHeaderInfo</code>, <code>sofInfo</code>).</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button className="btn btn-primary" onClick={() => jumpTo('spec')}>Go to Spec Table</button>
                  <button className="btn" onClick={() => jumpTo('sample')}>Go to Sample JSON</button>
                  <button className="btn" onClick={() => jumpTo('visual')}>Go to Tree Builder</button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Step 2 — Static Lint & One-Click Fixes</span>
                  <span className="chip bg-slate-200 dark:bg-slate-700">Right Panel → Lint</span>
                </div>
                <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                  The linter runs on every keystroke and checks 16 Draft-04 & banking rules:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-xs">
                  <li>Flags forbidden Draft-06+ keywords (<code>nullable</code>, <code>const</code>, <code>examples</code>) and converts them with one click.</li>
                  <li>Detects hidden enums or lengths mentioned in field descriptions (e.g. <code>"Valid values: Y/N"</code>) and offers a <b>Fix</b> button to extract them.</li>
                  <li>Warns on unanchored regexes, missing <code>minLength</code> on required strings, or missing <code>additionalProperties</code>.</li>
                </ul>
                <div className="mt-3">
                  <button className="btn" onClick={() => jumpTo(undefined, 'lint')}>Open Lint Panel</button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Step 3 — Verify with Valid & Negative Payloads</span>
                  <span className="chip bg-slate-200 dark:bg-slate-700">Right Panel → Test / Gen</span>
                </div>
                <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                  Prove your schema works before deploying to webMethods:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-xs">
                  <li><b>Sample Generator:</b> Generate a valid payload (respecting regexes via <code>randexp</code>) and dozens of one-violation-at-a-time negative test cases.</li>
                  <li><b>Test Payload:</b> Paste real payloads from your workbook's <i>Sample Req Res Payload</i> sheet and save them to your regression <b>Test Suite</b>.</li>
                  <li><b>Export Postman / cURL:</b> Download a ready-to-run Postman Collection v2.1 (with 200 OK & 400 Bad Request assertions).</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button className="btn" onClick={() => jumpTo(undefined, 'gen')}>Open Sample Generator</button>
                  <button className="btn" onClick={() => jumpTo(undefined, 'test')}>Open Test Payload</button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Step 4 — Export to webMethods API Gateway 11.1</span>
                  <span className="chip bg-slate-200 dark:bg-slate-700">Middle Panel & Sidebar</span>
                </div>
                <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                  Every output schema is guaranteed to start with <code>"$schema": "http://json-schema.org/draft-04/schema#"</code>:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-xs">
                  <li>Click <b>Copy</b> or <b>Download .json</b> in the middle panel for the active service.</li>
                  <li>Or click <b>⬇ Download all .json</b> in the left sidebar to batch-export every project at once.</li>
                  <li>In webMethods API Gateway: <b>APIs → Policies → Edit → Request Processing → Validate API Specification</b>.</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button className="btn" onClick={() => setUI({ modal: 'deploy' })}>View Gateway Deploy Notes</button>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800/50">
              <b>⌨ Keyboard Shortcuts:</b>{' '}
              <kbd className="rounded border px-1">Ctrl+Z</kbd> / <kbd className="rounded border px-1">Ctrl+Y</kbd> Undo / Redo ·{' '}
              <kbd className="rounded border px-1">Ctrl+S</kbd> Save schema snapshot (compare in <b>Diff</b>) ·{' '}
              <kbd className="rounded border px-1">Ctrl+Enter</kbd> Re-run payload validation ·{' '}
              <kbd className="rounded border px-1">Alt+↑/↓</kbd> on a field's <code>⋮⋮</code> handle to reorder.
            </div>
          </div>
        )}

        {tab === 'esb' && (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              <b>Built for CIMB ESB, SNAP BI & IDMS Mapping Workbooks:</b> SchemaForge's spec parser is specifically tuned for the <code>.csv</code> and <code>.xlsx</code> interface mapping sheets used across SKN, RTGS, SWIFT, RFT, and IDMS services.
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">1. Single vs. Bulk CSV Import</h3>
              <ul className="ml-5 list-disc space-y-1">
                <li><b>Single Service (<code>📂 Upload .csv</code>):</b> Opens the parsed rows in the interactive preview table where you can search, filter, or tweak any row before clicking <b>Generate (replace tree)</b> or <b>Merge into existing tree</b>.</li>
                <li><b>Multi-Service Batch (<code>📚 Bulk CSVs → Projects</code>):</b> Select 5–20 CSV files at once. Each file automatically creates a dedicated project in the sidebar, generates its Draft-04 schema, and seeds a passing test payload in its Test Suite.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">2. Working with IDMS Workbooks (<code>Service Interface Data Mapping_*.xlsx</code>)</h3>
              <p className="text-slate-600 dark:text-slate-400">
                IDMS workbooks typically contain two distinct service mapping tabs plus a sample payload tab:
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded border border-slate-200 p-2.5 dark:border-slate-700">
                  <b>① ESB Orchestrator Tab</b>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    Sheet named <code>ESB_Orchestrator_...</code>. Contains the backend/ESB JSON payload mapping (e.g. <code>$.finSvcHeaderInfo.*</code> + request fields). Export or copy this tab to generate the <code>_ESB.schema.json</code>.
                  </p>
                </div>
                <div className="rounded border border-slate-200 p-2.5 dark:border-slate-700">
                  <b>② Gateway Translator Tab</b>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    Sheet named <code>Gateway_Translator_...</code>. Contains the external/channel-facing API Gateway request mapping (e.g. <code>$.system.channelId</code> + request body). Export or copy this tab to generate the <code>_Gateway.schema.json</code>.
                  </p>
                </div>
                <div className="rounded border border-slate-200 p-2.5 dark:border-slate-700">
                  <b>③ Sample Req Res Payload Tab</b>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    Contains sample JSON bodies for both layers. Paste these into the <b>Test Payload</b> tab (and click <b>+ Save to suite</b>) to verify your generated schema against the workbook's official examples.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">3. Automatic ESB / SNAP Quirks Handled by SchemaForge</h3>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="p-2">Spreadsheet Quirk</th>
                      <th className="p-2">Example in CSV / Excel</th>
                      <th className="p-2">How SchemaForge Handles It</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    <tr>
                      <td className="p-2 font-medium">Row 1 Title Banner</td>
                      <td className="p-2 font-mono">,,,ESB PARAMETER,,,API PARAMETER</td>
                      <td className="p-2">Scans first 15 rows to locate the true header row (<code>Parameter</code>, <code>Data Type</code>, <code>JSON Path</code>).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Response Section Cutoff</td>
                      <td className="p-2 font-mono">,,,Response Data for Success / OUTPUT</td>
                      <td className="p-2">Stops reading at the response divider — even if the author accidentally left <code>"Input"</code> in Column 0 on response rows (like <code>$.statusCode</code> or <code>$.tmqF1</code> in SKN/RTGS).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">HTTP Header Rows</td>
                      <td className="p-2 font-mono">Request-ID, CIMB-Timestamp (Location=Header)</td>
                      <td className="p-2">Automatically skipped so HTTP headers aren't mixed into the JSON request body schema.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Precision/Scale Lengths</td>
                      <td className="p-2 font-mono">18,2 · 18.2 · 17,2 (18 Inc Decimal)</td>
                      <td className="p-2">Sets <code>maxLength: 18</code> and decimal regex <code>^[0-9]+(\.[0-9]&#123;1,2&#125;)?$</code>.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Zero-Scale Integer Strings</td>
                      <td className="p-2 font-mono">19,0</td>
                      <td className="p-2">Sets <code>maxLength: 19</code> and digits-only regex <code>^[0-9]&#123;1,19&#125;$</code>.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Date Lengths</td>
                      <td className="p-2 font-mono">String (Date) with Length 4 / 8 / 10</td>
                      <td className="p-2">Emits <code>MMDD</code> (len 4, e.g. ISO-8583 <code>settlementDate</code>), <code>YYYYMMDD</code> (len 8), or <code>YYYY-MM-DD</code> (len 10).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Indexed Arrays</td>
                      <td className="p-2 font-mono">$.items[0].id .. $.items[9].id · $.items[*]</td>
                      <td className="p-2">Normalized and deduplicated into a single array item definition (<code>items[].id</code>).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Windows-1252 Smart Quotes</td>
                      <td className="p-2 font-mono">Byte 0x93 / 0x94 (“CDA”, “SDA”)</td>
                      <td className="p-2">Decoded automatically via <code>cp1252</code> fallback without UTF-8 <code>U+FFFD</code> corruption.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded border border-amber-300 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <b>⚠ Watch Out for Manual YAML Typos in Workbooks:</b> Some IDMS sheets have a rightmost column (<code>definitions:</code>) with hand-typed YAML snippets that occasionally contain copy-paste bugs (e.g., naming a field <code>mobilePhone:</code> on the <code>accountNumber</code> row, or putting a numeric regex <code>^\d+$</code> on an alphabetic <code>accountType</code> field like <code>"RPN"</code>). Always rely on the structured columns (<code>JSON Path</code>, <code>Data Type</code>, <code>Length</code>, <code>Mandatory</code>) and verify with the workbook's sample payload!
            </div>
          </div>
        )}

        {tab === 'builder' && (
          <div className="space-y-4 text-xs">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">1. Navigating Large Schemas (150+ Fields like SKN & RTGS)</h3>
              <ul className="ml-5 list-disc space-y-1">
                <li><b>Instant Search Bar:</b> Type any field name, description keyword, or regex fragment in the Tree toolbar. Matching fields and their parent object containers auto-expand while non-matching branches hide.</li>
                <li><b><code>* Req</code> Filter Button:</b> Toggle to view only mandatory fields across the entire tree hierarchy.</li>
                <li><b><code>Collapse all</code> / <code>Expand all</code>:</b> Collapse deep object trees into compact top-level blocks (e.g., <code>finSvcHeaderInfo &#123;7&#125;</code>, <code>xferInfo &#123;24&#125;</code>) to focus on one section at a time.</li>
                <li><b><code>Forbid extra props (recursive)</code>:</b> One-click button in the Tree toolbar sets <code>"additionalProperties": false</code> on the root object and every nested object container.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">2. Reusable Banking Presets & Custom Blocks</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Click <b>＋ From preset</b> at the bottom of the Tree (or inside any field's <b>⚙ Rules</b> drawer) to apply 24 built-in patterns and object blocks:
              </p>
              <ul className="ml-5 list-disc space-y-1">
                <li><b>Object Blocks:</b> <code>ESB finSvcHeaderInfo block</code>, <code>Source of Fund (sofInfo) block</code>, <code>Pagination block</code>, and <code>Standard header block</code>.</li>
                <li><b>Banking Fields:</b> Account Number (19 digits), Bank ID (0–99), Branch ID (5 digits), Amount Decimal (<code>^[0-9]+(\.[0-9]&#123;1,2&#125;)?$</code>), Y/N Flag, Blank-or-single-char code, Date <code>YYYY-MM-DD</code>, Datetime ISO 8601.</li>
                <li><b>Save Custom Preset (<code>☆</code>):</b> Configure any field or nested object once, click <code>☆</code> on its row to save it to your library, and export/share presets via the <b>Presets</b> button in the top bar.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">3. Strict Draft-04 Rules for webMethods API Gateway 11.1</h3>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="p-2">Rule / Concept</th>
                      <th className="p-2 text-red-700 dark:text-red-300">❌ Forbidden (Draft-06 / 07 / OpenAPI)</th>
                      <th className="p-2 text-green-700 dark:text-green-300">✅ Required Draft-04 Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono dark:divide-slate-700">
                    <tr>
                      <td className="p-2 font-sans font-medium">Schema Header</td>
                      <td className="p-2">draft-07 / 2020-12</td>
                      <td className="p-2">"$schema": "http://json-schema.org/draft-04/schema#"</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium">Nullable Field</td>
                      <td className="p-2">"nullable": true</td>
                      <td className="p-2">"type": ["string", "null"] (and include null in enum)</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium">Single Constant</td>
                      <td className="p-2">"const": "X"</td>
                      <td className="p-2">"enum": ["X"]</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium">Exclusive Bounds</td>
                      <td className="p-2">"exclusiveMinimum": 0</td>
                      <td className="p-2">"minimum": 0, "exclusiveMinimum": true</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium">Schema ID & Defs</td>
                      <td className="p-2">"$id", "$defs", "examples"</td>
                      <td className="p-2">"id", "definitions" (or inline properties)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'testing' && (
          <div className="space-y-4 text-xs">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">1. Static Analysis (Lint Tab)</h3>
              <p className="text-slate-600 dark:text-slate-400">
                The Lint tab inspects your schema for errors, ambiguities, and mismatches between human descriptions and formal rules:
              </p>
              <ul className="ml-5 list-disc space-y-1">
                <li><b>One-Click Enum Extraction:</b> If a field's description says <code>Valid values: CDA, SDA</code> or <code>Y/N</code> but has no <code>enum</code>, click <b>Fix: Set enum [...]</b>.</li>
                <li><b>Length & Required Sync:</b> Flags if the description says <code>(Required)</code> or <code>length: 19</code> while the schema disagrees.</li>
                <li><b>Empty String Protection:</b> Warns when a required string has no <code>minLength</code> or <code>pattern</code> (which would allow <code>""</code> to pass validation).</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">2. Live Payload Validation & Regression Suite (Test Payload Tab)</h3>
              <ul className="ml-5 list-disc space-y-1">
                <li>Paste any JSON request body to validate it live with <code>ajv-draft-04</code> (<code>allErrors: true</code>).</li>
                <li><b>Click-to-Locate:</b> Clicking any validation error highlights and scrolls directly to the offending property in the JSON editor.</li>
                <li><b>Test Suite:</b> Save multiple named payloads (e.g. <i>"Valid happy path"</i> expecting <code>PASS</code>, <i>"Missing channelId"</i> expecting <code>FAIL</code>) and click <b>Run all</b> whenever you edit the schema to ensure no regressions.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">3. Sample Generator & Negative Boundary Testing</h3>
              <ul className="ml-5 list-disc space-y-1">
                <li><b>Valid Payload Generator:</b> Produces a randomized valid request body satisfying all patterns (via <code>randexp</code>), enums, and lengths. Toggle <b>Include optional fields</b> to test minimal vs. maximal payloads.</li>
                <li><b>Negative & Boundary Cases:</b> Automatically generates a comprehensive matrix of invalid payloads — one violation per case (missing each required field, <code>maxLength + 1</code>, <code>minLength - 1</code>, pattern violated, enum violated, wrong type, <code>null</code> on non-nullable, numeric bounds exceeded, unexpected extra property).</li>
                <li><b>Mismatch Detection:</b> Every negative case is immediately run through <code>ajv-draft-04</code>. If a negative case unexpectedly passes, it is highlighted with a red <b>⚠ MISMATCH</b> badge so you know your schema rule is too loose.</li>
                <li><b>Postman & cURL Export:</b> Click <b>Export Postman</b> to download a Postman v2.1 collection containing the valid request + every negative test case with pre-written status code assertions (HTTP 200 vs 400).</li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'agents' && (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-purple-300 bg-purple-50/70 p-3 text-purple-950 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-100">
              <b>Autonomous Agent & Playwright MCP Workflow:</b> SchemaForge is designed to work seamlessly with AI coding agents (Claude Code, Cursor, Antigravity, Playwright MCP) via the repository's <code>CLAUDE.md</code> and <code>idms/CHECKED_STATUS.md</code> files.
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">1. How Agents Process <code>idms/</code> Workbooks</h3>
              <ol className="ml-5 list-decimal space-y-1.5">
                <li><b>Check Status Table:</b> The agent reads <code>idms/CHECKED_STATUS.md</code> and picks the next unchecked <code>[ ]</code> service folder (picking the latest workbook version, e.g. <code>v1.1.1.xlsx</code> over <code>v1.0.1.xlsx</code>).</li>
                <li><b>Extract Mapping Tabs:</b> Extracts the <b>ESB Orchestrator</b> and <b>Gateway Translator</b> request mapping tables into clean CSVs inside that service folder.</li>
                <li><b>Build & Verify in SchemaForge:</b> Imports the CSVs into SchemaForge (via Playwright MCP or headless Node API), sets <code>additionalProperties: false</code>, resolves all lint errors/warnings, and cross-checks against the workbook's <i>Sample Req Res Payload</i> tab.</li>
                <li><b>Run Full Test Matrix:</b> Executes the Sample Generator's negative/boundary suite and verifies <b>0 mismatches</b> and <b>100% test suite pass rate</b>.</li>
                <li><b>Write <code>CHECKED.flag</code> & Update Table:</b> Saves the verified <code>_ESB.schema.json</code> and <code>_Gateway.schema.json</code>, writes <code>CHECKED.flag</code> documenting test counts and any workbook typos found, and marks <code>[x] CHECKED</code> in <code>idms/CHECKED_STATUS.md</code>.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">2. Example Prompt to Give Another Agent</h3>
              <pre className="overflow-x-auto rounded border border-slate-300 bg-slate-100 p-2.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800">{`Read CLAUDE.md and idms/CHECKED_STATUS.md.
Pick the next unchecked service in idms/, extract its ESB Orchestrator and Gateway Translator request specs,
generate and verify both Draft-04 .schema.json files using SchemaForge (0 lint errors, 0 generator mismatches,
and test against the workbook's Sample Req Res Payload), then write CHECKED.flag and update idms/CHECKED_STATUS.md.`}</pre>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AboutModal() {
  const setUI = useStore((s) => s.setUI);
  return (
    <Modal title="About SchemaForge" onClose={() => setUI({ modal: null })}>
      <div className="space-y-3 text-sm">
        <p><b>SchemaForge</b> builds, lints and tests <b>JSON Schema Draft-04</b> documents for the webMethods API Gateway “Request Validation” policy.</p>
        <div className="rounded-md border border-green-400 bg-green-50 p-3 text-green-900 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100">
          <p className="font-semibold">🔒 Nothing leaves your browser.</p>
          <p>This is a static site with no backend. Schemas, test payloads (which may contain banking data) and presets are processed locally and stored only in this browser's localStorage. There are no analytics and no network calls with your data. Use “Export all” to back up or move projects.</p>
        </div>
        <ul className="ml-5 list-disc space-y-1">
          <li>Validation uses <code>ajv</code> + <code>ajv-draft-04</code> — a real Draft-04 validator, not Draft-07.</li>
          <li>Output never contains Draft-06+ keywords (<code>const</code>, <code>if/then/else</code>, <code>contains</code>, <code>propertyNames</code>, <code>examples</code>, <code>nullable</code>, <code>$id</code>, <code>$defs</code>).</li>
          <li>The gateway's validator may differ slightly from ajv (regex dialect, <code>format</code> handling). Always confirm on the gateway.</li>
        </ul>
        <p className="text-xs text-slate-500">Shortcuts: Ctrl+S save version · Ctrl+Enter run validation / test suite · Ctrl+Z / Ctrl+Y undo / redo · Alt+↑/↓ on a field's drag handle to reorder.</p>
      </div>
    </Modal>
  );
}

export function DeployModal() {
  const setUI = useStore((s) => s.setUI);
  return (
    <Modal title="Deploy notes (webMethods API Gateway 11.1)" onClose={() => setUI({ modal: null })}>
      <div className="space-y-3 text-sm">
        <p className="rounded border border-amber-400 bg-amber-50 p-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">⚠ This is general guidance only. Menu names differ between versions — verify against the official webMethods API Gateway 11.1 documentation.</p>
        <ol className="ml-5 list-decimal space-y-1.5">
          <li>Download or copy the schema from the middle panel (it always starts with <code>"$schema": "http://json-schema.org/draft-04/schema#"</code>).</li>
          <li>In API Gateway, open the API: <b>APIs → your API → Policies → Edit</b>.</li>
          <li>Under <b>Request Processing</b>, add / open the <b>Validate API Specification</b> (request validation) policy.</li>
          <li>Enable JSON request payload validation and paste the schema into the JSON schema field (or upload it as a schema file, depending on version).</li>
          <li>Save and re-activate the API, then test with the cURL / Postman exports from the Sample Generator tab.</li>
        </ol>
        <ul className="ml-5 list-disc space-y-1">
          <li>The request must be sent with <code>Content-Type: application/json</code>, otherwise the JSON schema is not applied.</li>
          <li>Run the “invalid payload” cases against the deployed API too; compare any difference with SchemaForge's results.</li>
        </ul>
      </div>
    </Modal>
  );
}

export function ImportModal() {
  const { setUI, createProject, loadSchemaObject, toast } = useStore();
  const active = useActive();
  const [text, setText] = useState('');
  const [name, setName] = useState('Imported schema');
  const [err, setErr] = useState('');
  const go = (replace: boolean) => {
    let obj: any;
    try { obj = JSON.parse(text); } catch (e: any) { return setErr(e.message); }
    if (typeof obj !== 'object' || !obj || Array.isArray(obj)) return setErr('Schema must be a JSON object');
    if (replace && active) loadSchemaObject(obj);
    else createProject(obj.title || name, obj);
    setUI({ modal: null });
    toast('Schema imported');
  };
  return (
    <Modal title="Import existing Draft-04 schema" onClose={() => setUI({ modal: null })}>
      <div className="space-y-2">
        <p className="text-xs text-slate-600 dark:text-slate-400">Paste any Draft-04 schema. It is parsed into the visual builder; if it uses <code>$ref</code>, <code>oneOf/anyOf/allOf</code> or other constructs the builder can't show, it opens in raw mode and the reason is displayed. Unsupported keywords (e.g. <code>nullable</code>) are kept so the linter can flag and fix them.</p>
        <textarea className="input h-64 font-mono" aria-label="Schema JSON" value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} />
        {err && <p role="alert" className="text-xs text-red-600">Invalid JSON: {err}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-56" aria-label="New project name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" disabled={!text.trim()} onClick={() => go(false)}>Import as new project</button>
          <button className="btn" disabled={!text.trim() || !active} onClick={() => go(true)}>Replace current</button>
        </div>
      </div>
    </Modal>
  );
}

export function PresetsModal() {
  const { setUI, customPresets, removeCustomPreset, importPresets, toast } = useStore();
  const all = useMemo(() => [...BUILTIN_PRESETS, ...customPresets.map(customToPreset)], [customPresets]);
  return (
    <Modal title="Presets library" onClose={() => setUI({ modal: null })} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600 dark:text-slate-400">Apply presets from a field's ⚙ Rules → Presets, or “＋ From preset”. Save any field as a preset with ☆.</span>
        <button className="btn ml-auto" onClick={() => download('schemaforge-presets.json', JSON.stringify({ customPresets }, null, 2))} disabled={!customPresets.length}>Export custom presets</button>
        <button className="btn" onClick={() => readFile('.json', (t) => importPresets(t))}>Import presets</button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {all.map((p) => {
          const b = p.build(Object.fromEntries(p.params.map((x) => [x.key, x.default])));
          return (
            <div key={p.id} className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
              <div className="flex items-center gap-2">
                <b>{p.name}</b>
                <span className="chip bg-slate-200 dark:bg-slate-700">{p.group}</span>
                {!p.builtin && <button className="btn btn-danger ml-auto" onClick={() => { removeCustomPreset(p.id); toast('Preset removed', 'info'); }}>Delete</button>}
              </div>
              <p className="text-slate-600 dark:text-slate-400">{p.description}</p>
              <pre className="mt-1 overflow-auto rounded bg-slate-100 p-1 font-mono text-[11px] dark:bg-slate-800">{JSON.stringify({ type: b.nullable ? [b.type, 'null'] : b.type, ...b.rules, ...(b.children ? { fields: b.children.map((c) => c.name) } : {}) }, null, 1)}</pre>
              {(p.valid.length > 0 || p.invalid.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.valid.slice(0, 3).map((v, i) => <span key={'v' + i} className="chip bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">✓ {JSON.stringify(v).slice(0, 30)}</span>)}
                  {p.invalid.slice(0, 3).map((v, i) => <span key={'i' + i} className="chip bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">✗ {JSON.stringify(v).slice(0, 30)}</span>)}
                </div>
              )}
              {p.warning && <p className="mt-1 text-amber-700 dark:text-amber-300">⚠ {p.warning}</p>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

type Op = { t: '=' | '-' | '+'; s: string };
function diffLines(a: string[], b: string[]): Op[] {
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Op[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: '=', s: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: '-', s: a[i++] });
    else out.push({ t: '+', s: b[j++] });
  }
  while (i < n) out.push({ t: '-', s: a[i++] });
  while (j < m) out.push({ t: '+', s: b[j++] });
  return out;
}

export function DiffModal() {
  const p = useActive()!;
  const { text } = useSchema();
  const setUI = useStore((s) => s.setUI);
  const [idx, setIdx] = useState(p.versions.length - 1);
  const prev = p.versions[idx]?.schema ?? '';
  const rows = useMemo(() => {
    const ops = diffLines(prev ? prev.split('\n') : [], text.split('\n'));
    const out: { l?: string; r?: string; k: '=' | 'c' }[] = [];
    for (let i = 0; i < ops.length; ) {
      if (ops[i].t === '=') { out.push({ l: ops[i].s, r: ops[i].s, k: '=' }); i++; continue; }
      const dels: string[] = [], ins: string[] = [];
      while (i < ops.length && ops[i].t !== '=') { (ops[i].t === '-' ? dels : ins).push(ops[i].s); i++; }
      for (let k = 0; k < Math.max(dels.length, ins.length); k++) out.push({ l: dels[k], r: ins[k], k: 'c' });
    }
    return out;
  }, [prev, text]);
  const changed = rows.filter((r) => r.k === 'c').length;
  return (
    <Modal title="Schema diff — saved version vs current" onClose={() => setUI({ modal: null })} wide>
      {p.versions.length === 0 ? (
        <p className="text-sm">No saved version yet. Press <kbd>Ctrl+S</kbd> to save the current schema as a version, then change something and come back.</p>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <label>Compare with{' '}
              <select className="input inline-block w-56" value={idx} onChange={(e) => setIdx(+e.target.value)}>
                {p.versions.map((v, i) => <option key={v.at} value={i}>{new Date(v.at).toLocaleString()}{i === p.versions.length - 1 ? ' (latest)' : ''}</option>)}
              </select>
            </label>
            <span>{changed === 0 ? 'No differences' : `${changed} changed line(s)`}</span>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-auto rounded border border-slate-300 bg-slate-300 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-600">
            <div className="bg-slate-50 px-2 py-1 font-sans font-semibold dark:bg-slate-800">Saved</div>
            <div className="bg-slate-50 px-2 py-1 font-sans font-semibold dark:bg-slate-800">Current</div>
            {rows.map((r, i) => (
              <div key={i} className="contents">
                <pre className={`whitespace-pre-wrap break-all px-2 ${r.k === 'c' && r.l !== undefined ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' : 'bg-white dark:bg-slate-900'}`}>{r.l ?? ' '}</pre>
                <pre className={`whitespace-pre-wrap break-all px-2 ${r.k === 'c' && r.r !== undefined ? 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200' : 'bg-white dark:bg-slate-900'}`}>{r.r ?? ' '}</pre>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
export { CodeEditor, copy };
