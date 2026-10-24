import { useEffect, useMemo } from 'react';
import { useActive, useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { BuilderPanel } from './components/builder/BuilderPanel';
import { OutputPanel } from './components/OutputPanel';
import { LintPanel } from './components/right/LintPanel';
import { TestPanel } from './components/right/TestPanel';
import { GeneratorPanel } from './components/right/GeneratorPanel';
import { AboutModal, DeployModal, DiffModal, HowToModal, ImportModal, PresetsModal } from './components/Modals';
import { TEMPLATES } from './data/fixtures';
import { useSchema } from './hooks';
import { lintSchema, summarize } from './lint/lint';

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-md px-3 py-2 text-xs font-medium text-white shadow-lg ${t.kind === 'err' ? 'bg-red-700' : t.kind === 'info' ? 'bg-slate-700' : 'bg-green-700'}`}>{t.msg}</div>
      ))}
    </div>
  );
}

function RightPanel() {
  const rightTab = useStore((s) => s.rightTab);
  const setUI = useStore((s) => s.setUI);
  const { schema } = useSchema();
  const sum = useMemo(() => summarize(schema ? lintSchema(schema) : []), [schema]);
  const tabs = [['lint', 'Lint'], ['test', 'Test Payload'], ['gen', 'Sample Generator']] as const;
  return (
    <section className="panel" aria-label="Tools">
      <div role="tablist" className="flex border-b border-slate-200 dark:border-slate-700">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={rightTab === k} className={`tab ${rightTab === k ? 'tab-active' : ''}`} onClick={() => setUI({ rightTab: k })}>
            {l}
            {k === 'lint' && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${sum.errors ? 'bg-red-600 text-white' : sum.warnings ? 'bg-amber-500 text-black' : 'bg-green-600 text-white'}`}>{sum.errors + sum.warnings || '✓'}</span>
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1" role="tabpanel">
        {rightTab === 'lint' && <LintPanel />}
        {rightTab === 'test' && <TestPanel />}
        {rightTab === 'gen' && <GeneratorPanel />}
      </div>
    </section>
  );
}

function EmptyState() {
  const { createProject, loadTemplate, setUI } = useStore();
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-lg rounded-xl border border-dashed border-slate-400 p-8 text-center dark:border-slate-600">
        <h2 className="mb-2 text-xl font-semibold">Welcome to SchemaForge</h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Build a Draft-04 request-validation schema from a field list, a sample payload or the visual builder — lint it and test it before it ever touches the gateway.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary" onClick={() => loadTemplate(TEMPLATES[0].id)}>Load example</button>
          <button className="btn" onClick={() => loadTemplate(TEMPLATES[1].id)}>Load AcctBindingInq</button>
          <button className="btn" onClick={() => createProject()}>New empty project</button>
          <button className="btn" onClick={() => setUI({ modal: 'import' })}>Import schema</button>
          <button className="btn" onClick={() => setUI({ modal: 'howto' })}>📖 How-To Guide</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const st = useStore();
  const p = useActive();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const s = useStore.getState();
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); e.stopPropagation(); s.saveVersion(); }
      else if (k === 'enter') {
        e.preventDefault(); e.stopPropagation();
        s.setUI({ rightTab: 'test' });
        useStore.setState({ runTick: s.runTick + 1 });
        s.toast('Validation re-run');
      } else if (k === 'z' || k === 'y') {
        const t = e.target as HTMLElement;
        if (t.closest('.cm-editor') || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
        e.preventDefault();
        if (k === 'y' || e.shiftKey) s.redo(); else s.undo();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <header className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
        <button className="btn btn-ghost" aria-label="Toggle project sidebar" aria-pressed={st.sidebar} onClick={() => st.setUI({ sidebar: !st.sidebar })}>☰</button>
        <h1 className="text-base font-bold tracking-tight">Schema<span className="text-indigo-600 dark:text-indigo-400">Forge</span> <span className="text-xs font-normal text-slate-500">Draft-04</span></h1>
        {p && <span className="truncate text-xs text-slate-600 dark:text-slate-400">/ {p.name}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button className="btn" disabled={!st.past.length} onClick={st.undo} title="Undo (Ctrl+Z)">↶ Undo</button>
          <button className="btn" disabled={!st.future.length} onClick={st.redo} title="Redo (Ctrl+Y)">↷ Redo</button>
          <button className="btn" disabled={!p} onClick={st.saveVersion} title="Save version (Ctrl+S)">💾 Save</button>
          <button className="btn" disabled={!p} onClick={() => st.setUI({ modal: 'diff' })}>Diff</button>
          <button className="btn" onClick={() => st.setUI({ modal: 'presets' })}>Presets</button>
          <button className="btn btn-primary" onClick={() => st.setUI({ modal: 'howto' })}>📖 How-To</button>
          <button className="btn" onClick={() => st.setUI({ modal: 'deploy' })}>Deploy notes</button>
          <button className="btn" onClick={() => st.setUI({ modal: 'about' })}>About</button>
          <button className="btn" aria-label="Toggle dark / light mode" onClick={() => st.setUI({ theme: st.theme === 'dark' ? 'light' : 'dark' })}>{st.theme === 'dark' ? '☀ Light' : '🌙 Dark'}</button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-2">
        {st.sidebar && <Sidebar />}
        {p ? (
          <main className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 overflow-auto lg:grid-cols-[minmax(340px,1fr)_minmax(300px,1fr)_minmax(360px,1.15fr)] lg:overflow-hidden">
            <BuilderPanel />
            <OutputPanel />
            <RightPanel />
          </main>
        ) : (
          <main className="panel flex-1"><EmptyState /></main>
        )}
      </div>
      {st.modal === 'howto' && <HowToModal />}
      {st.modal === 'about' && <AboutModal />}
      {st.modal === 'deploy' && <DeployModal />}
      {st.modal === 'import' && <ImportModal />}
      {st.modal === 'presets' && <PresetsModal />}
      {st.modal === 'diff' && p && <DiffModal />}
      <Toasts />
    </div>
  );
}
