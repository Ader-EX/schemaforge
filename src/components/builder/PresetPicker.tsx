import { useMemo, useState } from 'react';
import { BUILTIN_PRESETS, customToPreset, defaultParams, FieldPatch, Preset } from '../../model/presets';
import { useStore } from '../../store';
import { Check } from '../common';

export function useAllPresets(): Preset[] {
  const custom = useStore((s) => s.customPresets);
  return useMemo(() => [...BUILTIN_PRESETS, ...custom.map(customToPreset)], [custom]);
}

const show = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v).slice(0, 24) : JSON.stringify(v)?.slice(0, 40));

export function PresetPicker({ presets, onApply, applyLabel = 'Apply preset' }: { presets: Preset[]; onApply: (patch: FieldPatch, p: Preset) => void; applyLabel?: string }) {
  const [id, setId] = useState('');
  const [params, setParams] = useState<Record<string, any>>({});
  const p = presets.find((x) => x.id === id);
  const groups = [...new Set(presets.map((x) => x.group))];
  const pick = (v: string) => {
    setId(v);
    const np = presets.find((x) => x.id === v);
    setParams(np ? defaultParams(np) : {});
  };
  const patch = p ? p.build(params) : null;
  return (
    <div className="space-y-1.5 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-600">
      <select className="input" aria-label="Preset" value={id} onChange={(e) => pick(e.target.value)}>
        <option value="">Choose a preset…</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {presets.filter((x) => x.group === g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </optgroup>
        ))}
      </select>
      {p && patch && (
        <>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">{p.description}</p>
          {p.params.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              {p.params.map((x) =>
                x.kind === 'bool' ? (
                  <Check key={x.key} label={x.label} checked={!!params[x.key]} onChange={(v) => setParams({ ...params, [x.key]: v })} />
                ) : (
                  <label key={x.key} className="text-[11px]">
                    <span className="label block">{x.label}</span>
                    <input className="input w-32" type={x.kind === 'number' ? 'number' : 'text'} value={params[x.key] ?? ''} onChange={(e) => setParams({ ...params, [x.key]: x.kind === 'number' ? Number(e.target.value) : e.target.value })} />
                  </label>
                ),
              )}
            </div>
          )}
          <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
            {patch.rules?.pattern && <div>pattern: {patch.rules.pattern}</div>}
            {patch.rules?.enum && <div>enum: {JSON.stringify(patch.rules.enum)}</div>}
            {(patch.rules?.minLength !== undefined || patch.rules?.maxLength !== undefined) && <div>length: {patch.rules.minLength ?? 0}–{patch.rules.maxLength ?? '∞'}</div>}
            {(patch.rules?.minimum !== undefined || patch.rules?.maximum !== undefined) && <div>range: {patch.rules.minimum ?? '-∞'}…{patch.rules.maximum ?? '∞'}</div>}
            {patch.nullable && <div>nullable</div>}
            {patch.children && <div>fields: {patch.children.map((c) => c.name).join(', ')}</div>}
          </div>
          {(p.valid.length > 0 || p.invalid.length > 0) && (
            <div className="flex flex-wrap gap-1 text-[11px]">
              {p.valid.slice(0, 3).map((v, i) => <span key={'v' + i} className="chip bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200" title="valid example">✓ {show(v)}</span>)}
              {p.invalid.slice(0, 3).map((v, i) => <span key={'i' + i} className="chip bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200" title="invalid example">✗ {show(v)}</span>)}
            </div>
          )}
          {p.warning && <p className="rounded bg-amber-100 p-1.5 text-[11px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">⚠ {p.warning}</p>}
          <button className="btn btn-primary" onClick={() => onApply(patch, p)}>{applyLabel}</button>
        </>
      )}
    </div>
  );
}
