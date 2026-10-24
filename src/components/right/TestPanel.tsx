import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditor, EditorHandle } from '../common';
import { useActive, useStore } from '../../store';
import { useSchema } from '../../hooks';
import { locatePointers, validatePayload } from '../../engine/validator';
import { fromPointer, toPointer } from '../../engine/jsonptr';

export function TestPanel() {
  const p = useActive()!;
  const { schema } = useSchema();
  const patch = useStore((s) => s.patchProject);
  const runTick = useStore((s) => s.runTick);
  const toast = useStore((s) => s.toast);
  const ed = useRef<EditorHandle>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { if (runTick) setShowAll(true); }, [runTick]);

  const parsed = useMemo(() => {
    try { return { data: JSON.parse(p.payload), err: null as string | null }; } catch (e: any) { return { data: undefined, err: e.message as string }; }
  }, [p.payload]);
  const result = useMemo(() => (schema && !parsed.err ? validatePayload(schema, parsed.data) : null), [schema, parsed]);
  const locs = useMemo(() => locatePointers(p.payload), [p.payload]);

  const jump = (pointer: string) => {
    if (!locs) return;
    // fall back to the nearest existing ancestor
    let ptr = fromPointer(pointer);
    while (ptr.length >= 0) {
      const hit = locs.get(toPointer(ptr));
      if (hit) { ed.current?.select(hit[0], hit[1]); return; }
      if (!ptr.length) return;
      ptr = ptr.slice(0, -1);
    }
  };

  const suite = useMemo(
    () => p.tests.map((t) => {
      let res: ReturnType<typeof validatePayload> | null = null;
      let perr: string | null = null;
      try { res = schema ? validatePayload(schema, JSON.parse(t.payload)) : null; } catch (e: any) { perr = e.message; }
      const actual = perr ? 'fail' : res ? (res.valid ? 'pass' : 'fail') : 'fail';
      return { t, res, perr, actual, ok: actual === t.expect };
    }),
    [p.tests, schema],
  );
  const passed = suite.filter((s) => s.ok).length;

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="h-56 shrink-0 border-b border-slate-200 dark:border-slate-700">
        <CodeEditor ref={ed} label="Test payload" value={p.payload} onChange={(v) => patch((x) => { x.payload = v; })} />
      </div>
      <div className="space-y-2 p-2">
        <div aria-live="polite">
          {parsed.err && <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">Payload is not valid JSON: {parsed.err}</div>}
          {result?.compileError && <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">Schema does not compile: {result.compileError}</div>}
          {result?.valid && <div className="rounded border border-green-400 bg-green-50 p-2 text-sm font-semibold text-green-800 dark:border-green-700 dark:bg-green-950/40 dark:text-green-200">✓ Valid</div>}
          {result && !result.valid && !result.compileError && (
            <div className="space-y-1.5">
              <div className="rounded border border-red-400 bg-red-50 p-2 text-sm font-semibold text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">✗ Invalid — {result.issues.length} error{result.issues.length === 1 ? '' : 's'}</div>
              {result.missing.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-950/30">
                  <b>Missing required properties</b>
                  <ul className="ml-4 list-disc font-mono">
                    {result.missing.map((m, i) => <li key={i}>{(m.parent === '/' ? '' : m.parent) + '/' + m.property}</li>)}
                  </ul>
                </div>
              )}
              <ul className="space-y-1">
                {result.issues.map((i, n) => (
                  <li key={n}>
                    <button onClick={() => jump(i.pointer)} className="w-full rounded border border-slate-200 p-2 text-left text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" title="Click to highlight in the payload">
                      <div className="flex items-center gap-2"><span className="font-mono font-semibold">{i.path}</span><span className="chip bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100">{i.keyword}</span></div>
                      <div>{i.explain}</div>
                      {i.hint && <div className="mt-0.5 text-[11px] text-indigo-700 dark:text-indigo-300">💡 Fix hint: {i.hint}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-2 dark:border-slate-700">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="mr-auto text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Test suite ({p.tests.length})</h3>
            <button className="btn" onClick={() => {
              const name = window.prompt('Name for this payload', p.tests.length ? `case ${p.tests.length + 1}` : 'valid happy path');
              if (name) patch((x) => { x.tests = [...x.tests, { id: Math.random().toString(36).slice(2), name, payload: x.payload, expect: result?.valid ? 'pass' : 'fail' }]; });
            }}>Save current as case</button>
            <button className="btn btn-primary" onClick={() => setShowAll(true)} disabled={!p.tests.length}>Run all (Ctrl+Enter)</button>
          </div>
          {p.tests.length === 0 && <p className="text-xs text-slate-500">Save named payloads with an expected result, then re-run them after every schema change.</p>}
          {showAll && p.tests.length > 0 && (
            <div className={`mb-2 rounded p-1.5 text-xs font-semibold ${passed === suite.length ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'}`} role="status">
              {passed}/{suite.length} passed
            </div>
          )}
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[11px] text-slate-500"><th>Name</th><th>Expect</th>{showAll && <><th>Actual</th><th>Result</th></>}<th /></tr></thead>
            <tbody>
              {suite.map(({ t, ok, actual, res, perr }) => (
                <tr key={t.id} className="border-t border-slate-200 align-top dark:border-slate-700">
                  <td className="py-1 pr-1"><input className="input" aria-label="Case name" value={t.name} onChange={(e) => patch((x) => { x.tests = x.tests.map((y) => (y.id === t.id ? { ...y, name: e.target.value } : y)); })} /></td>
                  <td className="pr-1">
                    <select className="input w-16" aria-label="Expected result" value={t.expect} onChange={(e) => patch((x) => { x.tests = x.tests.map((y) => (y.id === t.id ? { ...y, expect: e.target.value as 'pass' | 'fail' } : y)); })}>
                      <option>pass</option><option>fail</option>
                    </select>
                  </td>
                  {showAll && (
                    <>
                      <td className="pr-1" title={perr ?? res?.issues.map((i) => `${i.path}: ${i.explain}`).join('\n')}>{actual}</td>
                      <td className={`pr-1 font-bold ${ok ? 'text-green-600' : 'text-red-600'}`}>{ok ? '✓ PASS' : '✗ FAIL'}</td>
                    </>
                  )}
                  <td className="whitespace-nowrap">
                    <button className="btn btn-ghost" title="Load into editor" aria-label={`Load ${t.name}`} onClick={() => patch((x) => { x.payload = t.payload; })}>↥</button>
                    <button className="btn btn-ghost" title="Delete" aria-label={`Delete ${t.name}`} onClick={() => { patch((x) => { x.tests = x.tests.filter((y) => y.id !== t.id); }); toast('Case deleted', 'info'); }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
