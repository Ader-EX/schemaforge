import { useRef } from 'react';
import { CodeEditor, copy, download } from './common';
import { useActive, useStore } from '../store';
import { useSchema } from '../hooks';

export function OutputPanel() {
  const p = useActive()!;
  const { schema, text, error } = useSchema();
  const { minified, rawEdit, rawDraft, rawError, toast, setUI, toggleRawEdit, setRawDraft } = useStore();
  const shown = rawEdit ? rawDraft : minified && schema ? JSON.stringify(schema) : text;
  const dl = useRef<HTMLButtonElement>(null);
  const out = () => (schema ? (minified ? JSON.stringify(schema) : JSON.stringify(schema, null, 2)) : text);
  return (
    <section className="panel" aria-label="Schema output">
      <div className="panel-head">
        <h2 className="mr-auto text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Draft-04 schema {rawEdit ? '(raw edit)' : '(read-only)'}</h2>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-indigo-600" checked={minified} disabled={rawEdit} onChange={(e) => setUI({ minified: e.target.checked })} /> Minified</label>
        <button className={`btn ${rawEdit ? 'btn-primary' : ''}`} aria-pressed={rawEdit} onClick={toggleRawEdit} title="Edit the JSON directly; edits sync back to the builder when possible">{rawEdit ? 'Done editing' : 'Edit raw'}</button>
        <button className="btn" onClick={() => copy(out(), toast)} disabled={!schema}>Copy</button>
        <button ref={dl} className="btn" disabled={!schema} onClick={() => download(`${p.title || p.name}.json`, out())}>Download .json</button>
      </div>
      {rawEdit && (
        <div className={`px-3 py-1 text-[11px] ${rawError ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' : p.raw !== null ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'}`} role="status">
          {rawError ? `Invalid JSON — builder keeps the last valid schema. ${rawError}` : p.raw !== null ? `Synced as raw only: ${p.rawReason}` : 'Valid — builder is in sync.'}
        </div>
      )}
      {!rawEdit && p.raw !== null && <div className="bg-amber-100 px-3 py-1 text-[11px] text-amber-900 dark:bg-amber-950 dark:text-amber-100">Raw mode: {p.rawReason}</div>}
      {error && !rawEdit && <div className="bg-red-100 px-3 py-1 text-[11px] text-red-800 dark:bg-red-950 dark:text-red-200">Invalid JSON: {error}</div>}
      <div className="min-h-0 flex-1">
        <CodeEditor label="Schema JSON" value={shown} readOnly={!rawEdit} onChange={rawEdit ? setRawDraft : undefined} />
      </div>
    </section>
  );
}
