import { Field, FIELD_TYPES, FieldType, newField } from '../../model/types';
import { applyPatch, FieldPatch } from '../../model/presets';
import { Check, CommitInput, NumInput } from '../common';
import { PresetPicker, useAllPresets } from './PresetPicker';

const FORMATS = ['', 'date-time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri'];

export function parseEnumText(text: string, numeric: boolean): any[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s, i, a) => s !== '' || (a.length === 1 && false))
    .map((s) => (s === '""' || s === "''" ? '' : s.replace(/^["']|["']$/g, '')))
    .map((s) => (numeric ? Number(s) : s))
    .filter((v) => !(typeof v === 'number' && isNaN(v)));
}
export const enumToText = (e?: any[]) => (e ?? []).map((v) => (v === '' ? '""' : String(v))).join(', ');

export function changeType(f: Field, t: FieldType) {
  f.type = t;
  f.rules = {};
  if (t === 'array') f.items = f.items ?? newField({ type: 'string' });
  else f.items = undefined;
  if (t !== 'object') f.children = [];
}

/** rules drawer content for one field (also used recursively for array items) */
export function RulesEditor({ f, upd }: { f: Field; upd: (fn: (f: Field) => void) => void }) {
  const presets = useAllPresets();
  const r = f.rules;
  const set = (k: keyof Field['rules'], v: any) => upd((x) => { if (v === undefined || v === '' || v === false) delete (x.rules as any)[k]; else (x.rules as any)[k] = v; });
  let regexErr: string | null = null;
  if (r.pattern) { try { new RegExp(r.pattern); } catch (e: any) { regexErr = e.message; } }
  const fieldPresets = presets.filter((p) => { const b = p.build({}); return b.type === f.type && !b.children; });
  const applyP = (patch: FieldPatch) => upd((x) => Object.assign(x, applyPatch(x, patch)));

  return (
    <div className="space-y-2 rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
      {f.type === 'string' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">minLength</span><NumInput label="minLength" value={r.minLength} onChange={(v) => set('minLength', v)} /></label>
            <label><span className="label">maxLength</span><NumInput label="maxLength" value={r.maxLength} onChange={(v) => set('maxLength', v)} /></label>
          </div>
          <label className="block">
            <span className="label">pattern (regex, ECMA-262)</span>
            <CommitInput mono label="pattern" value={r.pattern ?? ''} onCommit={(v) => set('pattern', v)} placeholder="^[A-Za-z0-9]+$" />
            {regexErr && <span className="text-[11px] text-red-600 dark:text-red-400">Invalid regex: {regexErr}</span>}
          </label>
          <label className="block">
            <span className="label">enum (comma separated; "" = blank)</span>
            <CommitInput mono label="enum" value={enumToText(r.enum)} onCommit={(v) => set('enum', parseEnumText(v, false).length ? parseEnumText(v, false) : undefined)} placeholder='Y, N, ""' />
          </label>
          <label className="block">
            <span className="label">format</span>
            <select className="input" aria-label="format" value={r.format ?? ''} onChange={(e) => set('format', e.target.value)}>
              {FORMATS.map((x) => <option key={x} value={x}>{x || '(none)'}</option>)}
            </select>
          </label>
        </>
      )}
      {(f.type === 'integer' || f.type === 'number') && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">minimum</span><NumInput label="minimum" value={r.minimum} onChange={(v) => set('minimum', v)} /></label>
            <label><span className="label">maximum</span><NumInput label="maximum" value={r.maximum} onChange={(v) => set('maximum', v)} /></label>
            <Check label="exclusiveMinimum (boolean)" checked={!!r.exclusiveMinimum} onChange={(v) => set('exclusiveMinimum', v)} />
            <Check label="exclusiveMaximum (boolean)" checked={!!r.exclusiveMaximum} onChange={(v) => set('exclusiveMaximum', v)} />
          </div>
          <label className="block"><span className="label">multipleOf</span><NumInput label="multipleOf" value={r.multipleOf} onChange={(v) => set('multipleOf', v)} /></label>
          <label className="block">
            <span className="label">enum (numbers, comma separated)</span>
            <CommitInput mono label="enum" value={enumToText(r.enum)} onCommit={(v) => set('enum', parseEnumText(v, true).length ? parseEnumText(v, true) : undefined)} />
          </label>
          <p className="text-[11px] text-slate-500">Draft-04: exclusive flags modify minimum/maximum and are only emitted when that bound is set.</p>
        </>
      )}
      {f.type === 'array' && f.items && (
        <>
          <div className="rounded border border-slate-300 p-2 dark:border-slate-600">
            <div className="mb-1 flex items-center gap-2">
              <span className="label">items type</span>
              <select className="input w-28" aria-label="items type" value={f.items.type} onChange={(e) => upd((x) => changeType(x.items!, e.target.value as FieldType))}>
                {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <Check label="nullable" checked={f.items.nullable} onChange={(v) => upd((x) => { x.items!.nullable = v; })} />
            </div>
            {f.items.type !== 'object' && f.items.type !== 'boolean' && (
              <RulesEditor f={f.items} upd={(fn) => upd((x) => fn(x.items!))} />
            )}
            {f.items.type === 'object' && <p className="text-[11px] text-slate-500">Item fields are edited in the tree below this row.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">minItems</span><NumInput label="minItems" value={r.minItems} onChange={(v) => set('minItems', v)} /></label>
            <label><span className="label">maxItems</span><NumInput label="maxItems" value={r.maxItems} onChange={(v) => set('maxItems', v)} /></label>
          </div>
          <Check label="uniqueItems" checked={!!r.uniqueItems} onChange={(v) => set('uniqueItems', v)} />
        </>
      )}
      {f.type === 'object' && (
        <label className="block">
          <span className="label">additionalProperties</span>
          <select className="input" aria-label="additionalProperties" value={r.additionalProperties === undefined ? '' : String(r.additionalProperties)}
            onChange={(e) => upd((x) => { if (e.target.value === '') delete x.rules.additionalProperties; else x.rules.additionalProperties = e.target.value === 'true'; })}>
            <option value="">not set (unknown fields accepted)</option>
            <option value="true">allow unknown fields</option>
            <option value="false">forbid unknown fields</option>
          </select>
        </label>
      )}
      {f.type === 'boolean' && <p className="text-[11px] text-slate-500">No extra rules for boolean.</p>}
      {fieldPresets.length > 0 && f.type !== 'array' && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-indigo-700 dark:text-indigo-300">Presets</summary>
          <div className="mt-1"><PresetPicker presets={fieldPresets} onApply={(patch) => applyP(patch)} /></div>
        </details>
      )}
      {f.extra && Object.keys(f.extra).length > 0 && (
        <div className="rounded bg-amber-100 p-1.5 text-[11px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          Preserved keywords not editable here: <span className="font-mono">{Object.keys(f.extra).join(', ')}</span> — see the Lint tab.
        </div>
      )}
    </div>
  );
}
