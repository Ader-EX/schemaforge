import { useMemo, useState } from 'react';
import { useSchema } from '../../hooks';
import { applyLintFix, lintSchema, summarize } from '../../lint/lint';
import { LINT_GLOSSARY } from '../../lint/glossary';
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
  const [showGlossary, setShowGlossary] = useState(false);
  const [glossaryQuery, setGlossaryQuery] = useState('');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const issues = useMemo(() => (schema ? lintSchema(schema) : []), [schema]);
  const compileError = useMemo(() => (schema ? compile(schema).error : undefined), [schema]);
  const sum = summarize(issues);
  const order = { error: 0, warning: 1, info: 2 };
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);

  const glossaryMap = useMemo(() => new Map(LINT_GLOSSARY.map((g) => [g.code, g])), []);
  const filteredGlossary = useMemo(() => {
    const q = glossaryQuery.trim().toLowerCase();
    if (!q) return LINT_GLOSSARY;
    return LINT_GLOSSARY.filter(
      (g) =>
        g.code.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q) ||
        g.when.toLowerCase().includes(q) ||
        g.whyItMatters.toLowerCase().includes(q),
    );
  }, [glossaryQuery]);

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
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 p-2 dark:border-slate-700">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sum.errors ? 'bg-red-600 text-white' : sum.warnings ? 'bg-amber-500 text-black' : 'bg-green-600 text-white'}`} role="status">
          {sum.errors} error{sum.errors === 1 ? '' : 's'}, {sum.warnings} warning{sum.warnings === 1 ? '' : 's'}{sum.infos ? `, ${sum.infos} info` : ''}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {issues.some((i) => i.fix && i.severity === 'error') && !showGlossary && (
            <button className="btn" onClick={fixAll}>Fix all errors</button>
          )}
          <button
            className={`btn ${showGlossary ? 'btn-primary' : ''}`}
            onClick={() => setShowGlossary((v) => !v)}
            title="Toggle Lint Rules Glossary"
          >
            {showGlossary ? '← Back to findings' : '📖 Glossary'}
          </button>
        </div>
      </div>

      {showGlossary ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-slate-200 p-2 dark:border-slate-700">
            <input
              className="input text-xs"
              placeholder="Search lint rule code or explanation (e.g. desc-enum, nullable, empty-required)..."
              value={glossaryQuery}
              onChange={(e) => setGlossaryQuery(e.target.value)}
            />
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
            {filteredGlossary.map((g) => (
              <li key={g.code} className={`rounded border p-2.5 text-xs ${COLOR[g.severity]}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>{ICON[g.severity]}</span>
                  <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[11px] font-bold dark:bg-white/10">{g.code}</code>
                  <b className="text-xs">{g.title}</b>
                  <span className="chip ml-auto uppercase">{g.severity}</span>
                </div>
                <div className="mt-1.5 space-y-1 text-[11px]">
                  <div><b>Trigger:</b> {g.when}</div>
                  <div><b>Why it matters:</b> {g.whyItMatters}</div>
                  <div><b>Auto-Fix:</b> {g.autoFix}</div>
                  {(g.exampleBad || g.exampleGood) && (
                    <div className="mt-1 grid gap-1 font-mono text-[10px] sm:grid-cols-2">
                      {g.exampleBad && <div className="rounded bg-red-100/80 p-1 text-red-900 dark:bg-red-950/60 dark:text-red-200">✗ {g.exampleBad}</div>}
                      {g.exampleGood && <div className="rounded bg-green-100/80 p-1 text-green-900 dark:bg-green-950/60 dark:text-green-200">✓ {g.exampleGood}</div>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
          {compileError && (
            <li className={`rounded border p-2 text-xs ${COLOR.error}`}>
              <b>⛔ Schema does not compile (Draft-04)</b>
              <div className="font-mono text-[11px]">{compileError}</div>
            </li>
          )}
          {sorted.length === 0 && !compileError && <li className="p-4 text-center text-xs text-slate-500">No findings. 🎉</li>}
          {sorted.map((i) => {
            const g = glossaryMap.get(i.code);
            const isExp = expandedCode === i.id;
            return (
              <li key={i.id} className={`rounded border p-2 text-xs ${COLOR[i.severity]}`}>
                <div className="flex items-start gap-2">
                  <span aria-label={i.severity}>{ICON[i.severity]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="break-words">{i.message}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      <span>{i.path}</span>
                      <span>·</span>
                      <button
                        type="button"
                        className="underline decoration-dotted hover:text-indigo-600 dark:hover:text-indigo-400"
                        onClick={() => setExpandedCode(isExp ? null : i.id)}
                        title="Click to view rule explanation from glossary"
                      >
                        {i.code} ⓘ
                      </button>
                    </div>
                  </div>
                  {i.fix && (
                    <button className="btn shrink-0" title={i.fix.label} onClick={() => { loadSchemaObject(applyLintFix(schema, i)); toast(`Fixed: ${i.fix!.label}`); }}>Fix</button>
                  )}
                </div>
                {i.fix && <div className="ml-6 mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">→ {i.fix.label}</div>}
                {isExp && g && (
                  <div className="ml-6 mt-2 rounded border border-slate-300/80 bg-white/80 p-2 text-[11px] dark:border-slate-700 dark:bg-slate-900/80">
                    <div className="font-semibold">{g.title} (<code className="font-mono">{g.code}</code>)</div>
                    <div className="mt-0.5"><b>Why it matters:</b> {g.whyItMatters}</div>
                    <div className="mt-0.5"><b>Fix:</b> {g.autoFix}</div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
