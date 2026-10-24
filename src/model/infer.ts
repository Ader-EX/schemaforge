import { Field, newField, uid } from './types';
import { findField, walkFields } from './tree';
import { applyPatch, BUILTIN_PRESETS, defaultParams, PATTERNS } from './presets';

export interface Suggestion {
  id: string;
  fieldId: string;
  path: string;
  presetId: string;
  params: Record<string, any>;
  label: string;
  status: 'pending' | 'accepted' | 'rejected';
}

function inferField(v: any, name: string): Field {
  const f = newField({ name, meta: { n: 1 } });
  if (v === null) { f.type = 'string'; f.nullable = true; f.meta!.nullOnly = true; }
  else if (typeof v === 'boolean') f.type = 'boolean';
  else if (typeof v === 'number') f.type = Number.isInteger(v) ? 'integer' : 'number';
  else if (typeof v === 'string') { f.type = 'string'; f.meta!.samples = [v]; }
  else if (Array.isArray(v)) {
    f.type = 'array';
    let items: Field | undefined;
    for (const el of v) {
      const x = inferField(el, '');
      items = items ? merge(items, x) : x;
    }
    f.items = items;
  } else if (typeof v === 'object') {
    f.type = 'object';
    f.children = Object.entries(v).map(([k, x]) => inferField(x, k));
  }
  return f;
}

function merge(a: Field, b: Field): Field {
  if (a.meta?.nullOnly && !b.meta?.nullOnly) return { ...b, nullable: true, meta: { ...b.meta!, n: a.meta.n + b.meta!.n } };
  if (b.meta?.nullOnly && !a.meta?.nullOnly) return { ...a, nullable: true, meta: { ...a.meta!, n: a.meta!.n + b.meta.n } };
  const out: Field = { ...a, nullable: a.nullable || b.nullable, meta: { ...a.meta!, n: (a.meta?.n ?? 1) + (b.meta?.n ?? 1) } };
  if (a.type !== b.type) {
    if ((a.type === 'integer' && b.type === 'number') || (a.type === 'number' && b.type === 'integer')) out.type = 'number';
    return out;
  }
  if (a.type === 'string') out.meta!.samples = [...(a.meta?.samples ?? []), ...(b.meta?.samples ?? [])].slice(0, 100);
  if (a.type === 'array') out.items = a.items && b.items ? merge(a.items, b.items) : a.items ?? b.items;
  if (a.type === 'object') {
    const ch = a.children.map((c) => ({ ...c }));
    for (const c of b.children) {
      const i = ch.findIndex((x) => x.name === c.name);
      if (i >= 0) ch[i] = merge(ch[i], c);
      else ch.push(c);
    }
    out.children = ch;
  }
  return out;
}

const DATE = new RegExp(PATTERNS.date);

export function inferFromSample(json: any, requireAll: boolean): { root: Field; suggestions: Suggestion[]; note?: string } {
  let root = inferField(json, '');
  let note: string | undefined;
  if (root.type !== 'object') {
    note = 'Top-level value is not an object; wrapped under "value".';
    const w = newField({ type: 'object', meta: { n: 1 } });
    root.name = 'value';
    w.children = [root];
    root = w;
  }
  const suggestions: Suggestion[] = [];
  const visit = (f: Field, path: string, parent: Field | null) => {
    f.required = requireAll && !!parent && parent.type === 'object' && (f.meta?.n ?? 0) === (parent.meta?.n ?? 1);
    const samples = f.meta?.samples?.filter((s) => s !== '');
    if (f.type === 'string' && samples && samples.length) {
      const add = (presetId: string, params: Record<string, any>, label: string) =>
        suggestions.push({ id: uid(), fieldId: f.id, path: path || f.name, presetId, params, label, status: 'pending' });
      if (samples.every((s) => /^[0-9]+$/.test(s)) && !samples.every((s) => DATE.test(s) )) {
        const len = Math.max(...samples.map((s) => s.length));
        add('numeric', { ...defaultParams(BUILTIN_PRESETS.find((p) => p.id === 'numeric')!), maxLength: len, nullable: f.nullable }, `All digits → Numeric string preset, maxLength ${len} (observed length)`);
      } else if (samples.every((s) => DATE.test(s))) add('date', { allowBlank: false }, 'Looks like YYYY-MM-DD → Date preset');
      else if (samples.every((s) => s === 'Y' || s === 'N')) add('flag', { allowBlank: false, nullable: f.nullable }, 'Value is Y/N → Y/N flag enum');
      else if (samples.every((s) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(s))) add('email', { maxLength: 254, nullable: f.nullable }, 'Looks like an email → Email preset');
    }
    f.children.forEach((c) => visit(c, `${path}${path ? '.' : ''}${c.name}`, f));
    if (f.items) visit(f.items, `${path}[]`, null);
  };
  visit(root, '', null);
  // children of array items: required only if present in all elements
  return { root, suggestions, note };
}

export function acceptSuggestion(root: Field, s: Suggestion): Field {
  const r = structuredClone(root);
  const hit = findField(r, s.fieldId);
  const preset = BUILTIN_PRESETS.find((p) => p.id === s.presetId);
  if (!hit || !preset) return r;
  const patch = preset.build(s.params);
  const upd = applyPatch(hit.field, patch);
  Object.assign(hit.field, upd);
  return r;
}

export function stripMeta(f: Field): Field {
  walkFields(f, (x) => { delete x.meta; });
  return f;
}
