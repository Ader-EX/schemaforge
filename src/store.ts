import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Field, newField, newProject, Project, TestCase, uid } from './model/types';
import { fromSchema, Unsupported } from './model/fromSchema';
import { buildSchema } from './model/toSchema';
import { cloneFresh, findField, mergeTrees, moveField } from './model/tree';
import { CustomPreset } from './model/presets';
import { TEMPLATES } from './data/fixtures';

type Snap = Pick<Project, 'root' | 'title' | 'raw' | 'rawReason'>;
export type Modal = null | 'about' | 'deploy' | 'diff' | 'presets' | 'import' | 'howto';
export type RightTab = 'lint' | 'test' | 'gen';
export type LeftTab = 'visual' | 'sample' | 'spec';
export interface Toast { id: string; msg: string; kind: 'ok' | 'err' | 'info' }

interface State {
  projects: Project[];
  activeId: string | null;
  theme: 'dark' | 'light';
  customPresets: CustomPreset[];
  gatewayUrl: string;
  sidebar: boolean;
  // transient
  past: Snap[];
  future: Snap[];
  toasts: Toast[];
  modal: Modal;
  rightTab: RightTab;
  leftTab: LeftTab;
  minified: boolean;
  rawEdit: boolean;
  rawDraft: string;
  rawError: string | null;
  runTick: number;

  toast: (msg: string, kind?: Toast['kind']) => void;
  setUI: (p: Partial<Pick<State, 'modal' | 'rightTab' | 'leftTab' | 'minified' | 'theme' | 'sidebar' | 'gatewayUrl'>>) => void;
  editRoot: (fn: (root: Field) => void) => void;
  setTitle: (t: string) => void;
  patchProject: (fn: (p: Project) => void) => void;
  undo: () => void;
  redo: () => void;
  replaceRoot: (root: Field, title?: string) => void;
  loadSchemaObject: (schema: any, opts?: { toast?: boolean }) => boolean;
  toggleRawEdit: () => void;
  setRawDraft: (text: string) => void;
  moveField: (src: string, tgt: string, pos: 'before' | 'after' | 'inside') => void;
  duplicateField: (id: string) => void;
  removeField: (id: string) => void;
  addField: (parentId: string, f?: Field) => void;
  // projects
  select: (id: string) => void;
  createProject: (name?: string, schema?: any, tests?: { name: string; payload: any; expect: 'pass' | 'fail' }[]) => string;
  loadTemplate: (id: string) => void;
  duplicateProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  saveVersion: () => void;
  exportAll: () => string;
  importAll: (json: string) => boolean;
  addCustomPreset: (p: CustomPreset) => void;
  removeCustomPreset: (id: string) => void;
  importPresets: (json: string) => boolean;
  addTests: (cases: Omit<TestCase, 'id'>[]) => void;
}

const snap = (p: Project): Snap => ({ root: p.root, title: p.title, raw: p.raw, rawReason: p.rawReason });

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const active = () => get().projects.find((p) => p.id === get().activeId) ?? null;
      const update = (fn: (p: Project) => void, history: boolean) => {
        const a = active();
        if (!a) return;
        const next: Project = { ...a };
        const before = snap(a);
        next.root = structuredClone(a.root);
        fn(next);
        next.updatedAt = Date.now();
        set((s) => ({
          projects: s.projects.map((p) => (p.id === a.id ? next : p)),
          ...(history ? { past: [...s.past.slice(-99), before], future: [] } : {}),
        }));
      };
      return {
        projects: [], activeId: null, theme: matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark', customPresets: [],
        gatewayUrl: 'https://<gateway-host>:5555/gateway/<API-name>/<version>/<resource>', sidebar: true,
        past: [], future: [], toasts: [], modal: null, rightTab: 'lint', leftTab: 'visual', minified: false,
        rawEdit: false, rawDraft: '', rawError: null, runTick: 0,

        toast: (msg, kind = 'ok') => {
          const id = uid();
          set((s) => ({ toasts: [...s.toasts, { id, msg, kind }] }));
          setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
        },
        setUI: (p) => {
          set(p as any);
          if (p.theme) document.documentElement.classList.toggle('dark', p.theme === 'dark');
        },
        editRoot: (fn) => {
          if (active()?.raw !== null) return get().toast('Schema is in raw mode — edit the JSON, or fix it so it can be shown in the builder.', 'info');
          update((p) => fn(p.root), true);
        },
        setTitle: (t) => update((p) => { p.title = t; }, true),
        patchProject: (fn) => update(fn, false),
        undo: () => {
          const { past, future } = get();
          const a = active();
          if (!a || !past.length) return;
          const prev = past[past.length - 1];
          set({ past: past.slice(0, -1), future: [...future, snap(a)], rawEdit: false });
          update((p) => Object.assign(p, structuredClone(prev)), false);
        },
        redo: () => {
          const { past, future } = get();
          const a = active();
          if (!a || !future.length) return;
          const nxt = future[future.length - 1];
          set({ future: future.slice(0, -1), past: [...past, snap(a)], rawEdit: false });
          update((p) => Object.assign(p, structuredClone(nxt)), false);
        },
        replaceRoot: (root, title) => update((p) => { p.root = root; p.raw = null; p.rawReason = null; if (title !== undefined) p.title = title; }, true),
        loadSchemaObject: (schema, opts) => {
          try {
            const { root, title } = fromSchema(schema);
            update((p) => { p.root = root; p.title = title || p.title; p.raw = null; p.rawReason = null; }, true);
            if (get().rawEdit) set({ rawDraft: JSON.stringify(schema, null, 2), rawError: null });
            return true;
          } catch (e: any) {
            if (!(e instanceof Unsupported)) throw e;
            update((p) => { p.raw = JSON.stringify(schema, null, 2); p.rawReason = e.message; }, true);
            if (get().rawEdit) set({ rawDraft: JSON.stringify(schema, null, 2), rawError: null });
            if (opts?.toast !== false) get().toast(`Switched to raw mode: ${e.message}`, 'info');
            return false;
          }
        },
        toggleRawEdit: () => {
          const a = active();
          if (!a) return;
          if (get().rawEdit) return set({ rawEdit: false, rawError: null });
          const { schema } = buildSchema(a);
          set({ rawEdit: true, rawDraft: JSON.stringify(schema, null, 2), rawError: null, past: [...get().past.slice(-99), snap(a)], future: [] });
        },
        setRawDraft: (text) => {
          set({ rawDraft: text });
          let obj: any;
          try { obj = JSON.parse(text); } catch (e: any) { return set({ rawError: e.message }); }
          set({ rawError: null });
          try {
            const { root, title } = fromSchema(obj);
            update((p) => { p.root = root; p.title = title; p.raw = null; p.rawReason = null; }, false);
          } catch (e: any) {
            if (!(e instanceof Unsupported)) throw e;
            update((p) => { p.raw = text; p.rawReason = e.message; }, false);
          }
        },
        moveField: (src, tgt, pos) => get().editRoot((r) => { moveField(r, src, tgt, pos); }),
        duplicateField: (id) =>
          get().editRoot((r) => {
            const h = findField(r, id);
            if (!h?.list) return;
            const c = cloneFresh(h.field);
            c.name = h.field.name + 'Copy';
            h.list.splice(h.index + 1, 0, c);
          }),
        removeField: (id) =>
          get().editRoot((r) => {
            const h = findField(r, id);
            if (h?.list) h.list.splice(h.index, 1);
          }),
        addField: (parentId, f) =>
          get().editRoot((r) => {
            const h = findField(r, parentId);
            if (!h) return;
            const parent = h.field.type === 'array' ? h.field.items! : h.field;
            const name = f?.name || 'newField';
            let nm = name, i = 1;
            while (parent.children.some((c) => c.name === nm)) nm = name + ++i;
            parent.children.push(f ? { ...f, name: nm } : newField({ name: nm }));
          }),

        select: (id) => set({ activeId: id, past: [], future: [], rawEdit: false, rawError: null }),
        createProject: (name, schema, tests) => {
          const p = newProject(name || `Schema ${get().projects.length + 1}`);
          if (tests) p.tests = tests.map((t) => ({ id: uid(), name: t.name, expect: t.expect, payload: JSON.stringify(t.payload, null, 2) }));
          if (tests?.[0]) p.payload = JSON.stringify(tests[0].payload, null, 2);
          set((s) => ({ projects: [...s.projects, p], activeId: p.id, past: [], future: [], rawEdit: false }));
          if (schema) get().loadSchemaObject(schema);
          set({ past: [], future: [] });
          return p.id;
        },
        loadTemplate: (id) => {
          const t = TEMPLATES.find((x) => x.id === id)!;
          get().createProject(t.name, t.schema, t.tests);
          get().toast(`Loaded "${t.name}"`);
        },
        duplicateProject: (id) => {
          const p = get().projects.find((x) => x.id === id);
          if (!p) return;
          const c: Project = { ...structuredClone(p), id: uid(), name: p.name + ' copy', updatedAt: Date.now() };
          set((s) => ({ projects: [...s.projects, c], activeId: c.id, past: [], future: [] }));
        },
        renameProject: (id, name) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)) })),
        deleteProject: (id) =>
          set((s) => {
            const projects = s.projects.filter((p) => p.id !== id);
            return { projects, activeId: s.activeId === id ? projects[0]?.id ?? null : s.activeId, past: [], future: [] };
          }),
        saveVersion: () => {
          const a = active();
          if (!a) return;
          const { schema } = buildSchema(a);
          if (!schema) return get().toast('Cannot save: JSON is invalid', 'err');
          update((p) => { p.versions = [...p.versions.slice(-19), { at: Date.now(), schema: JSON.stringify(schema, null, 2) }]; }, false);
          get().toast('Version saved (also auto-saved to this browser)');
        },
        exportAll: () => JSON.stringify({ app: 'schemaforge', version: 1, projects: get().projects, customPresets: get().customPresets }, null, 2),
        importAll: (json) => {
          try {
            const d = JSON.parse(json);
            if (!Array.isArray(d.projects)) throw new Error('no projects array');
            const incoming: Project[] = d.projects.map((p: Project) => ({ ...newProject(p.name), ...p, id: uid() }));
            set((s) => ({ projects: [...s.projects, ...incoming], activeId: incoming[0]?.id ?? s.activeId, customPresets: [...s.customPresets, ...(d.customPresets ?? []).filter((c: CustomPreset) => !s.customPresets.some((x) => x.id === c.id))] }));
            get().toast(`Imported ${incoming.length} project(s)`);
            return true;
          } catch (e: any) {
            get().toast('Import failed: ' + e.message, 'err');
            return false;
          }
        },
        addCustomPreset: (p) => set((s) => ({ customPresets: [...s.customPresets, p] })),
        removeCustomPreset: (id) => set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id) })),
        importPresets: (json) => {
          try {
            const d = JSON.parse(json);
            const list: CustomPreset[] = Array.isArray(d) ? d : d.customPresets;
            if (!Array.isArray(list)) throw new Error('expected an array of presets');
            set((s) => ({ customPresets: [...s.customPresets, ...list.filter((c) => c?.name && c.patch).map((c) => ({ ...c, id: uid() }))] }));
            get().toast(`Imported ${list.length} preset(s)`);
            return true;
          } catch (e: any) {
            get().toast('Preset import failed: ' + e.message, 'err');
            return false;
          }
        },
        addTests: (cases) => {
          update((p) => { p.tests = [...p.tests, ...cases.map((c) => ({ ...c, id: uid() }))]; }, false);
          get().toast(`Added ${cases.length} case(s) to the test suite`);
        },
      };
    },
    {
      name: 'schemaforge:v1',
      partialize: (s) => ({ projects: s.projects, activeId: s.activeId, theme: s.theme, customPresets: s.customPresets, gatewayUrl: s.gatewayUrl, sidebar: s.sidebar }),
      onRehydrateStorage: () => (s) => { if (s) document.documentElement.classList.toggle('dark', s.theme === 'dark'); },
    },
  ),
);

export const useActive = () => useStore((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
export { mergeTrees };
