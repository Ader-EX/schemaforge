import { Field, newField, uid } from './types';

/** the list of fields shown under a row (object children, or children of the array's object items) */
export function childList(f: Field): Field[] | null {
  if (f.type === 'object') return f.children;
  if (f.type === 'array' && f.items?.type === 'object') return f.items.children;
  return null;
}

export function walkFields(f: Field, cb: (f: Field, parent: Field | null) => void, parent: Field | null = null) {
  cb(f, parent);
  f.children.forEach((c) => walkFields(c, cb, f));
  if (f.items) walkFields(f.items, cb, f);
}

export function findField(root: Field, id: string): { field: Field; list: Field[] | null; index: number } | null {
  if (root.id === id) return { field: root, list: null, index: -1 };
  let res: ReturnType<typeof findField> = null;
  walkFields(root, (f) => {
    if (res) return;
    const list = childList(f);
    const i = list ? list.findIndex((c) => c.id === id) : -1;
    if (list && i >= 0) res = { field: list[i], list, index: i };
    else if (f.items && f.items.id === id) res = { field: f.items, list: null, index: -1 };
  });
  return res;
}

export function cloneFresh(f: Field): Field {
  const c: Field = structuredClone(f);
  const re = (x: Field) => {
    x.id = uid();
    x.children.forEach(re);
    if (x.items) re(x.items);
  };
  re(c);
  return c;
}

export function isDescendant(root: Field, ancestorId: string, id: string): boolean {
  const a = findField(root, ancestorId);
  if (!a) return false;
  let found = false;
  walkFields(a.field, (f) => {
    if (f.id === id) found = true;
  });
  return found;
}

/** move `srcId` before/after/inside `targetId` */
export function moveField(root: Field, srcId: string, targetId: string, pos: 'before' | 'after' | 'inside'): boolean {
  if (srcId === targetId || isDescendant(root, srcId, targetId)) return false;
  const src = findField(root, srcId);
  const tgt = findField(root, targetId);
  if (!src || !src.list || !tgt) return false;
  src.list.splice(src.index, 1);
  if (pos === 'inside') {
    const list = childList(tgt.field);
    if (!list) {
      src.list.splice(src.index, 0, src.field);
      return false;
    }
    list.push(src.field);
  } else {
    const t2 = findField(root, targetId)!;
    if (!t2.list) {
      src.list.splice(src.index, 0, src.field);
      return false;
    }
    t2.list.splice(t2.index + (pos === 'after' ? 1 : 0), 0, src.field);
  }
  return true;
}

/** merge `incoming` object tree into `base` (incoming wins for scalar fields, objects merge recursively) */
export function mergeTrees(base: Field, incoming: Field): Field {
  const out = structuredClone(base);
  for (const c of incoming.children) {
    const i = out.children.findIndex((x) => x.name === c.name);
    if (i < 0) out.children.push(c);
    else if (out.children[i].type === 'object' && c.type === 'object') {
      const merged = mergeTrees(out.children[i], c);
      merged.required = c.required || out.children[i].required;
      out.children[i] = merged;
    } else out.children[i] = { ...c, id: out.children[i].id };
  }
  return out;
}

export { newField };
