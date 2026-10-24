import { useMemo } from 'react';
import { useSchema } from '../../hooks';
import { applyLintFix, lintSchema, summarize } from '../../lint/lint';
import { compile } from '../../engine/validator';
import { useStore } from '../../store';

const ICON = { error: '⛔', warning: '⚠️', info: 'ℹ️' } as const;
const COLOR = {
  error: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40',
  warning: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
  info: 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30',
} as const;

export function LintPanel() {
  const { schema } = useSchema();
  const loadSchemaObject = useStore((s) => s.loadSchemaObject);
  const toast = useStore((s) => s.toast);
  const issues = useMemo(() => (schema ? lintSchema(schema) : []), [schema]);
  const compileError = useMemo(() => (schema ? compile(schema).error : undefined), [schema]);
  const sum = summarize(issues);
  const order = { error: 0, warning: 1, info: 2 };
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
  const fixAll = () => {
    let s = schema;
    let n = 0;
    for (let round = 0; round < 5; round++) {
      const fixable = lintSchema(s).filter((i) => i.fix && (i.severity === 'error' || i.code === 'desc-enum'));
      if (!fixable.length) break;
      s = applyLintFix(s, fixable[0]);
      n++;
    }
    if (n) { loadSchemaObject(s); toast(`Applied ${n} fix(es) to errors and enum suggestions`); }
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 p-2 dark:border-slate-700">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sum.errors ? 'bg-red-600 text-white' : sum.warnings ? 'bg-amber-500 text-black' : 'bg-green-600 text-white'}`} role="status">
          {sum.errors} error{sum.errors === 1 ? '' : 's'}, {sum.warnings} warning{sum.warnings === 1 ? '' : 's'}{sum.infos ? `, ${sum.infos} info` : ''}
        </span>
        {issues.some((i) => i.fix && i.severity === 'error') && <button className="btn ml-auto" onClick={fixAll}>Fix all errors</button>}
      </div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
        {compileError && (
          <li className={`rounded border p-2 text-xs ${COLOR.error}`}>
            <b>⛔ Schema does not compile (Draft-04)</b>
            <div className="font-mono text-[11px]">{compileError}</div>
          </li>
        )}
        {sorted.length === 0 && !compileError && <li className="p-4 text-center text-xs text-slate-500">No findings. 🎉</li>}
        {sorted.map((i) => (
          <li key={i.id} className={`rounded border p-2 text-xs ${COLOR[i.severity]}`}>
            <div className="flex items-start gap-2">
              <span aria-label={i.severity}>{ICON[i.severity]}</span>
              <div className="min-w-0 flex-1">
                <div className="break-words">{i.message}</div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">{i.path} · {i.code}</div>
              </div>
              {i.fix && (
                <button className="btn shrink-0" title={i.fix.label} onClick={() => { loadSchemaObject(applyLintFix(schema, i)); toast(`Fixed: ${i.fix!.label}`); }}>Fix</button>
              )}
            </div>
            {i.fix && <div className="ml-6 mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">→ {i.fix.label}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
