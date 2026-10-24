import { useActive, useStore } from '../../store';
import { FieldTree, AddBar } from './FieldTree';
import { InferPanel } from './InferPanel';
import { SpecPanel } from './SpecPanel';
import { TEMPLATES } from '../../data/fixtures';

export function BuilderPanel() {
  const p = useActive()!;
  const leftTab = useStore((s) => s.leftTab);
  const setUI = useStore((s) => s.setUI);
  const setTitle = useStore((s) => s.setTitle);
  const editRoot = useStore((s) => s.editRoot);
  const toggleRaw = useStore((s) => s.toggleRawEdit);
  const loadTemplate = useStore((s) => s.loadTemplate);
  const tabs = [['visual', 'Visual builder'], ['sample', 'Paste sample JSON'], ['spec', 'Paste field table']] as const;

  return (
    <section className="panel" aria-label="Builder">
      <div role="tablist" className="flex border-b border-slate-200 dark:border-slate-700">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={leftTab === k} className={`tab ${leftTab === k ? 'tab-active' : ''}`} onClick={() => setUI({ leftTab: k })}>{l}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {leftTab === 'sample' && <InferPanel />}
        {leftTab === 'spec' && <SpecPanel />}
        {leftTab === 'visual' && (
          p.raw !== null ? (
            <div className="space-y-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-semibold">This schema is in raw mode.</p>
              <p>{p.rawReason}</p>
              <p>The visual builder can't represent it, so edit the JSON in the middle panel (use “Edit raw”). Lint, testing and generation still work on the raw JSON.</p>
              <button className="btn" onClick={toggleRaw}>Edit raw JSON</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label><span className="label">Schema title</span><input className="input" aria-label="Schema title" value={p.title} onChange={(e) => setTitle(e.target.value)} /></label>
                <label>
                  <span className="label">Root additionalProperties</span>
                  <select className="input" aria-label="Root additionalProperties" value={p.root.rules.additionalProperties === undefined ? '' : String(p.root.rules.additionalProperties)}
                    onChange={(e) => editRoot((r) => { if (e.target.value === '') delete r.rules.additionalProperties; else r.rules.additionalProperties = e.target.value === 'true'; })}>
                    <option value="">not set (accepts unknown)</option>
                    <option value="true">allow</option>
                    <option value="false">forbid</option>
                  </select>
                </label>
              </div>
              <label className="block"><span className="label">Root description</span><input className="input" aria-label="Root description" value={p.root.description} onChange={(e) => editRoot((r) => { r.description = e.target.value; })} /></label>
              {p.root.children.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
                  <p className="mb-1 font-semibold">No fields yet</p>
                  <p className="mb-3 text-xs text-slate-500">Add fields here, paste a sample body, or paste a field table from your spec.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button className="btn btn-primary" onClick={() => setUI({ leftTab: 'sample' })}>Paste sample JSON</button>
                    <button className="btn" onClick={() => setUI({ leftTab: 'spec' })}>Paste field table</button>
                    {TEMPLATES.map((t) => <button key={t.id} className="btn" onClick={() => loadTemplate(t.id)}>Load example: {t.name}</button>)}
                  </div>
                  <div className="mt-3 flex justify-center"><AddBar parentId={p.root.id} /></div>
                </div>
              ) : <FieldTree root={p.root} />}
            </div>
          )
        )}
      </div>
    </section>
  );
}
