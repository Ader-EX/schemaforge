import { useState } from 'react';
import { useStore } from '../store';
import { TEMPLATES } from '../data/fixtures';
import { download, readFile } from './common';

export function Sidebar() {
  const { projects, activeId, select, createProject, duplicateProject, renameProject, deleteProject, loadTemplate, exportAll, importAll, setUI } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <aside className="panel w-56 shrink-0" aria-label="Projects">
      <div className="panel-head">
        <h2 className="mr-auto text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Projects</h2>
        <button className="btn btn-primary" onClick={() => createProject()}>＋ New</button>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto p-1.5">
        {projects.length === 0 && <li className="p-2 text-xs text-slate-500">No projects yet.</li>}
        {projects.map((p) => (
          <li key={p.id} className={`group mb-1 rounded-md border p-1.5 ${p.id === activeId ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {editing === p.id ? (
              <input autoFocus className="input" aria-label="Project name" defaultValue={p.name}
                onBlur={(e) => { renameProject(p.id, e.target.value || p.name); setEditing(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null); }} />
            ) : (
              <button className="w-full truncate text-left text-xs font-medium" aria-current={p.id === activeId} onClick={() => select(p.id)} title={p.name}>{p.name}</button>
            )}
            <div className="mt-1 flex gap-0.5">
              <button className="btn btn-ghost px-1" title="Rename" aria-label={`Rename ${p.name}`} onClick={() => setEditing(p.id)}>✎</button>
              <button className="btn btn-ghost px-1" title="Duplicate" aria-label={`Duplicate ${p.name}`} onClick={() => duplicateProject(p.id)}>⧉</button>
              <button className="btn btn-ghost px-1 text-red-600 dark:text-red-400" title="Delete" aria-label={`Delete ${p.name}`} onClick={() => window.confirm(`Delete "${p.name}"?`) && deleteProject(p.id)}>🗑</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t border-slate-200 p-2 dark:border-slate-700">
        <div className="label">Templates</div>
        {TEMPLATES.map((t) => <button key={t.id} className="btn w-full justify-start truncate" onClick={() => loadTemplate(t.id)}>{t.name}</button>)}
        <button className="btn w-full" onClick={() => setUI({ modal: 'import' })}>Import schema…</button>
        <div className="flex gap-1">
          <button className="btn flex-1" onClick={() => download('schemaforge-projects.json', exportAll())}>Export all</button>
          <button className="btn flex-1" onClick={() => readFile('.json,application/json', (t) => importAll(t))}>Import all</button>
        </div>
      </div>
    </aside>
  );
}
