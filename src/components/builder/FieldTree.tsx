import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Field, FIELD_TYPES, FieldType, newField } from '../../model/types';
import { childList, findField, walkFields } from '../../model/tree';
import { applyPatch, fieldToPatch } from '../../model/presets';
import { uid } from '../../model/types';
import { useStore } from '../../store';
import { Check } from '../common';
import { changeType, RulesEditor } from './RulesEditor';
import { PresetPicker, useAllPresets } from './PresetPicker';

interface Dnd {
  dragId: string | null;
  setDragId: (s: string | null) => void;
  hint: { id: string; pos: 'before' | 'after' | 'inside' } | null;
  setHint: (h: Dnd['hint']) => void;
  collapseTick: { n: number; collapsed: boolean };
  visibleIds: Set<string> | null;
}
const DndCtx = createContext<Dnd>(null as any);

export function AddBar({ parentId }: { parentId: string }) {
  const addField = useStore((s) => s.addField);
  const presets = useAllPresets();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <div className="flex gap-1">
        <button className="btn" onClick={() => addField(parentId)}>＋ Field</button>
        <button className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>＋ From preset</button>
      </div>
      {open && (
        <div className="mt-1">
          <PresetPicker presets={presets} applyLabel="Add field" onApply={(patch, p) => { addField(parentId, applyPatch(newField({ name: p.fieldName }), patch)); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function FieldRow({ f, depth }: { f: Field; depth: number }) {
  const editRoot = useStore((s) => s.editRoot);
  const dup = useStore((s) => s.duplicateField);
  const del = useStore((s) => s.removeField);
  const moveField = useStore((s) => s.moveField);
  const addCustom = useStore((s) => s.addCustomPreset);
  const toast = useStore((s) => s.toast);
  const dnd = useContext(DndCtx);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dnd.collapseTick.n > 0) setCollapsed(dnd.collapseTick.collapsed);
  }, [dnd.collapseTick]);

  const upd = (fn: (f: Field) => void) => editRoot((r) => { const h = findField(r, f.id); if (h) fn(h.field); });
  const list = childList(f);
  const hint = dnd.hint?.id === f.id ? dnd.hint.pos : null;
  const isFiltered = dnd.visibleIds !== null;
  const effectiveCollapsed = isFiltered ? false : collapsed;

  if (dnd.visibleIds && !dnd.visibleIds.has(f.id)) return null;

  const over = (e: React.DragEvent) => {
    if (!dnd.dragId || dnd.dragId === f.id) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = rowRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    dnd.setHint({ id: f.id, pos: y < rect.height / 2 ? 'before' : 'after' });
  };
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dnd.dragId && dnd.hint) moveField(dnd.dragId, dnd.hint.id, dnd.hint.pos);
    dnd.setDragId(null);
    dnd.setHint(null);
  };

  const reqSubCount = list ? list.filter((c) => c.required).length : 0;

  return (
    <div className="relative" onDragOver={over} onDrop={drop}>
      {hint === 'before' && <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-indigo-500" />}
      <div ref={rowRef} className={`rounded-md border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900 ${dnd.dragId === f.id ? 'opacity-40' : ''}`}>
        <div className="flex items-center gap-1">
          <span
            draggable role="button" tabIndex={0} aria-label={`Drag to reorder ${f.name}`} title="Drag to reorder"
            className="cursor-grab select-none px-0.5 text-slate-400"
            onDragStart={(e) => { dnd.setDragId(f.id); e.dataTransfer.setData('text/plain', f.id); if (rowRef.current) e.dataTransfer.setDragImage(rowRef.current, 10, 10); }}
            onDragEnd={() => { dnd.setDragId(null); dnd.setHint(null); }}
            onKeyDown={(e) => {
              if (!e.altKey) return;
              const h = useStore.getState();
              const proj = h.projects.find((p) => p.id === h.activeId);
              const fh = proj && findField(proj.root, f.id);
              if (!fh?.list) return;
              if (e.key === 'ArrowUp' && fh.index > 0) { e.preventDefault(); moveField(f.id, fh.list[fh.index - 1].id, 'before'); }
              if (e.key === 'ArrowDown' && fh.index < fh.list.length - 1) { e.preventDefault(); moveField(f.id, fh.list[fh.index + 1].id, 'after'); }
            }}
          >⠿</span>
          {list ? (
            <button className="btn btn-ghost px-1" aria-label={effectiveCollapsed ? 'Expand' : 'Collapse'} aria-expanded={!effectiveCollapsed} onClick={() => setCollapsed(!collapsed)}>{effectiveCollapsed ? '▸' : '▾'}</button>
          ) : <span className="w-5" />}
          <input className="input min-w-0 flex-1 font-mono" aria-label="Field name" value={f.name} onChange={(e) => upd((x) => { x.name = e.target.value; })} />
          {f.required && <span className="font-bold text-red-600 dark:text-red-400" title="required" aria-label="required">*</span>}
          {list && (
            <span className="chip shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" title="Child fields">
              {list.length} {list.length === 1 ? 'field' : 'fields'}{reqSubCount ? ` · ${reqSubCount} req` : ''}
            </span>
          )}
          <select className="input w-24 shrink-0" aria-label={`Type of ${f.name}`} value={f.type} onChange={(e) => upd((x) => changeType(x, e.target.value as FieldType))}>
            {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
          <Check label="required" checked={f.required} onChange={(v) => upd((x) => { x.required = v; })} />
          <Check label="nullable" checked={f.nullable} onChange={(v) => upd((x) => { x.nullable = v; })} />
          <button className={`btn ${open ? 'btn-primary' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>⚙ Rules</button>
          <button className="btn btn-ghost" title="Duplicate" aria-label={`Duplicate ${f.name}`} onClick={() => dup(f.id)}>⧉</button>
          <button className="btn btn-ghost" title="Save field or block as reusable preset" aria-label={`Save ${f.name} as preset`} onClick={() => {
            const name = window.prompt('Preset name', f.name);
            if (name) { addCustom({ id: uid(), name, description: f.description, patch: fieldToPatch(f) }); toast(`Saved preset "${name}"`); }
          }}>☆</button>
          <button className="btn btn-ghost text-red-600 dark:text-red-400" title="Delete" aria-label={`Delete ${f.name}`} onClick={() => del(f.id)}>🗑</button>
          {f.extra && <span className="chip bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100" title={`Extra keywords: ${Object.keys(f.extra).join(', ')}`}>+{Object.keys(f.extra).join(',')}</span>}
        </div>
        <input className="input mt-1" aria-label={`Description of ${f.name}`} placeholder="Description" value={f.description} onChange={(e) => upd((x) => { x.description = e.target.value; })} />
        {open && <div className="mt-1"><RulesEditor f={f} upd={upd} /></div>}
      </div>
      {hint === 'after' && <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-indigo-500" />}
      {list && !effectiveCollapsed && (
        <div className="ml-3 mt-1 space-y-1 border-l-2 border-slate-200 pl-2 dark:border-slate-700">
          {f.type === 'array' && <div className="text-[11px] text-slate-500">items (object)</div>}
          <FieldList list={list} depth={depth + 1} parentId={f.id} />
        </div>
      )}
    </div>
  );
}

function FieldList({ list, depth, parentId }: { list: Field[]; depth: number; parentId: string }) {
  const dnd = useContext(DndCtx);
  const moveField = useStore((s) => s.moveField);
  const parent = useStore((s) => s.projects.find((p) => p.id === s.activeId)?.root);
  const pid = parent ? (findField(parent, parentId)?.field.id ?? parentId) : parentId;
  return (
    <>
      {list.map((c) => <FieldRow key={c.id} f={c} depth={depth} />)}
      {list.length === 0 && (
        <div
          className="rounded border border-dashed border-slate-300 p-2 text-center text-[11px] text-slate-500 dark:border-slate-600"
          onDragOver={(e) => dnd.dragId && e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dnd.dragId) moveField(dnd.dragId, pid, 'inside'); dnd.setDragId(null); dnd.setHint(null); }}
        >No fields — add one or drop a field here</div>
      )}
      <AddBar parentId={parentId} />
    </>
  );
}

export function FieldTree({ root }: { root: Field }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [hint, setHint] = useState<Dnd['hint']>(null);
  const [search, setSearch] = useState('');
  const [reqOnly, setReqOnly] = useState(false);
  const [collapseTick, setCollapseTick] = useState<{ n: number; collapsed: boolean }>({ n: 0, collapsed: false });

  const stats = useMemo(() => {
    let total = 0, req = 0, objects = 0;
    walkFields(root, (f) => {
      if (f.id === root.id || f.name === '') return;
      total++;
      if (f.required) req++;
      if (childList(f)) objects++;
    });
    return { total, req, objects };
  }, [root]);

  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q && !reqOnly) return null;
    const set = new Set<string>();
    const visit = (f: Field, path: string): boolean => {
      const p = f.name ? (path ? `${path}.${f.name}` : f.name) : path;
      const selfMatch =
        f.id !== root.id &&
        f.name !== '' &&
        (!reqOnly || f.required) &&
        (!q || p.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || (f.rules.pattern ?? '').toLowerCase().includes(q));
      let childMatch = false;
      for (const c of f.children) if (visit(c, p)) childMatch = true;
      if (f.items && visit(f.items, `${p}[]`)) childMatch = true;
      if (selfMatch || childMatch) {
        set.add(f.id);
        return true;
      }
      return false;
    };
    visit(root, '');
    return set;
  }, [root, search, reqOnly]);

  return (
    <DndCtx.Provider value={{ dragId, setDragId, hint, setHint, collapseTick, visibleIds }}>
      <div className="space-y-2" onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHint(null); }}>
        {stats.total > 3 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60">
            <input
              className="input min-w-[140px] flex-1"
              placeholder={`Search ${stats.total} fields (${stats.req} req)…`}
              aria-label="Search fields"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="btn btn-ghost px-1.5" onClick={() => setSearch('')} title="Clear search">✕</button>}
            <button className={`btn ${reqOnly ? 'btn-primary' : ''}`} onClick={() => setReqOnly(!reqOnly)} title="Show required fields only">
              * Req ({stats.req})
            </button>
            {stats.objects > 0 && (
              <>
                <button className="btn" onClick={() => setCollapseTick((t) => ({ n: t.n + 1, collapsed: true }))} title="Collapse all nested blocks">
                  Collapse all
                </button>
                <button className="btn" onClick={() => setCollapseTick((t) => ({ n: t.n + 1, collapsed: false }))} title="Expand all nested blocks">
                  Expand all
                </button>
              </>
            )}
          </div>
        )}
        <FieldList list={root.children} depth={0} parentId={root.id} />
      </div>
    </DndCtx.Provider>
  );
}
