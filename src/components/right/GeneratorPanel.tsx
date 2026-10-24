import { useMemo, useState } from 'react';
import { useSchema } from '../../hooks';
import { useActive, useStore } from '../../store';
import { genCases, genValid, GenCase } from '../../engine/generate';
import { toCurl, toPostman } from '../../engine/export';
import { CodeEditor, copy, download } from '../common';

export function GeneratorPanel() {
  const p = useActive()!;
  const { schema } = useSchema();
  const { toast, gatewayUrl, setUI, addTests, patchProject } = useStore();
  const [optional, setOptional] = useState(true);
  const [seed, setSeed] = useState(0);
  const [filter, setFilter] = useState<'all' | 'mismatch'>('all');

  const valid = useMemo(() => (schema ? genValid(schema, { optional }) : null), [schema, optional, seed]);
  const validText = JSON.stringify(valid, null, 2);
  const cases: GenCase[] = useMemo(() => (schema ? genCases(schema, genValid(schema, { optional: true })) : []), [schema, seed]);
  const invalid = cases.filter((c) => c.group === 'invalid');
  const boundary = cases.filter((c) => c.group === 'boundary');
  const mism = cases.filter((c) => c.status === 'mismatch');
  const all = [{ label: 'valid payload', payload: valid }, ...boundary, ...invalid];
  const show = (list: GenCase[]) => (filter === 'mismatch' ? list.filter((c) => c.status === 'mismatch') : list);

  const exportPostman = () => download(`${p.title || p.name}.postman_collection.json`, JSON.stringify(toPostman(p.title || p.name, all, gatewayUrl), null, 2));

  const renderCase = (c: GenCase) => (
    <li key={c.id} className={`rounded border p-2 text-xs ${c.status === 'mismatch' ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-start gap-2">
        <span className={c.status === 'ok' ? 'text-green-600' : 'text-red-600'} aria-label={c.status}>{c.status === 'ok' ? '✓' : '✗'}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{c.label}</div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400">
            expected: {c.expect === 'pass' ? 'valid' : <>rejected at <span className="font-mono">{c.expectedPath}</span> ({c.keywords?.[0]})</>}
          </div>
          <div className={`text-[11px] ${c.status === 'mismatch' ? 'font-semibold text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}`}>actual: {c.actual}</div>
          {c.note && <div className="text-[11px] text-amber-700 dark:text-amber-300">⚠ {c.note}</div>}
          <details><summary className="cursor-pointer text-[11px] text-indigo-700 dark:text-indigo-300">payload</summary>
            <pre className="max-h-40 overflow-auto rounded bg-slate-100 p-1 font-mono text-[11px] dark:bg-slate-800">{JSON.stringify(c.payload, null, 2)}</pre>
          </details>
        </div>
        <button className="btn shrink-0" onClick={() => { patchProject((x) => { x.payload = JSON.stringify(c.payload, null, 2); }); setUI({ rightTab: 'test' }); }}>Test</button>
      </div>
    </li>
  );

  if (!schema) return <p className="p-4 text-xs text-slate-500">Fix the schema JSON to generate samples.</p>;
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="space-y-2 border-b border-slate-200 p-2 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Valid payload</h3>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-indigo-600" checked={optional} onChange={(e) => setOptional(e.target.checked)} /> include optional fields</label>
          <button className="btn" onClick={() => setSeed(seed + 1)}>↻ Regenerate</button>
          <button className="btn" onClick={() => copy(validText, toast)}>Copy as JSON</button>
          <button className="btn" onClick={() => { patchProject((x) => { x.payload = validText; }); setUI({ rightTab: 'test' }); }}>Use in tester</button>
        </div>
        <div className="h-44 overflow-hidden rounded border border-slate-200 dark:border-slate-700"><CodeEditor label="Generated valid payload" value={validText} readOnly /></div>
      </div>

      <div className="space-y-2 border-b border-slate-200 p-2 dark:border-slate-700">
        <label className="block text-xs"><span className="label">Gateway URL placeholder (for cURL / Postman)</span>
          <input className="input font-mono" aria-label="Gateway URL" value={gatewayUrl} onChange={(e) => setUI({ gatewayUrl: e.target.value })} /></label>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => copy(JSON.stringify(all.map((c) => c.payload), null, 2), toast)}>Copy all as JSON</button>
          <button className="btn" onClick={exportPostman}>Export Postman collection</button>
          <button className="btn" onClick={() => copy(toCurl(all, gatewayUrl), toast)}>Copy cURL commands</button>
          <button className="btn" onClick={() => download(`${p.title || p.name}-tests.sh`, toCurl(all, gatewayUrl), 'text/x-shellscript')}>Download cURL .sh</button>
          <button className="btn btn-primary" onClick={() => addTests([
            { name: 'valid payload', payload: validText, expect: 'pass' },
            ...[...boundary, ...invalid].map((c) => ({ name: c.label, payload: JSON.stringify(c.payload, null, 2), expect: c.expect })),
          ])}>Add all to test suite</button>
        </div>
      </div>

      <div className="space-y-3 p-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${mism.length ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`} role="status">
            {cases.length - mism.length}/{cases.length} cases behave as expected{mism.length ? ` — ${mism.length} mismatch` : ''}
          </span>
          <select className="input ml-auto w-36" aria-label="Filter cases" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">Show all</option><option value="mismatch">Only mismatches</option>
          </select>
        </div>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Invalid payloads ({invalid.length}) — one violation each</h3>
          <ul className="space-y-1">{show(invalid).map(renderCase)}</ul>
        </section>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Boundary cases — valid ({boundary.length})</h3>
          <ul className="space-y-1">{show(boundary).map(renderCase)}</ul>
        </section>
      </div>
    </div>
  );
}
