import { useMemo, useState } from 'react';
import { CodeEditor, copy, download, Modal, readFile } from './common';
import { useActive, useStore } from '../store';
import { useSchema } from '../hooks';
import { BUILTIN_PRESETS, customToPreset } from '../model/presets';

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
