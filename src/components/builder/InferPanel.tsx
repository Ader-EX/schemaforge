import { useState } from 'react';
import { Field } from '../../model/types';
import { acceptSuggestion, inferFromSample, stripMeta, Suggestion } from '../../model/infer';
import { mergeTrees } from '../../model/tree';
import { fieldToSchema } from '../../model/toSchema';
import { useStore, useActive } from '../../store';

function Outline({ f, path = '' }: { f: Field; path?: string }) {
  return (
    <ul className="ml-3 border-l border-slate-300 pl-2 dark:border-slate-600">
      {f.children.map((c) => (
        <li key={c.id} className="font-mono text-[11px]">
          {c.name}{c.required && <span className="text-red-600">*</span>}: {c.type}{c.nullable ? ' | null' : ''}
          {c.rules.pattern && <span className="text-slate-500"> ⟨{c.rules.pattern}⟩</span>}
          {c.rules.enum && <span className="text-slate-500"> enum{JSON.stringify(c.rules.enum)}</span>}
          {c.type === 'object' && <Outline f={c} />}
          {c.type === 'array' && c.items && <div className="ml-2">[ ] {c.items.type}{c.items.type === 'object' && <Outline f={c.items} />}</div>}
        </li>
      ))}
    </ul>
  );
}

export function ApplyBar({ build, label }: { build: () => Field; label: string }) {
  const replaceRoot = useStore((s) => s.replaceRoot);
  const proj = useActive()!;
  const toast = useStore((s) => s.toast);
  const setUI = useStore((s) => s.setUI);
  const done = (root: Field) => { replaceRoot(root); setUI({ leftTab: 'visual' }); toast(`${label} applied`); };
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn btn-primary" onClick={() => done(build())}>Replace current schema</button>
      <button className="btn" onClick={() => done(mergeTrees(proj.root, build()))}>Merge into current</button>
    </div>
  );
}

export function InferPanel() {
  const toast = useStore((s) => s.toast);
  const [text, setText] = useState('');
  const [requireAll, setRequireAll] = useState(false);
  const [res, setRes] = useState<{ root: Field; suggestions: Suggestion[]; note?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const analyze = (ra = requireAll) => {
    try {
      const r = inferFromSample(JSON.parse(text), ra);
      setRes(r);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
      setRes(null);
    }
  };
  const setStatus = (id: string, status: Suggestion['status']) => {
    if (!res) return;
    const s = res.suggestions.find((x) => x.id === id)!;
    const root = status === 'accepted' && s.status !== 'accepted' ? acceptSuggestion(res.root, s) : res.root;
    setRes({ ...res, root, suggestions: res.suggestions.map((x) => (x.id === id ? { ...x, status } : x)) });
  };
  const acceptAll = () => {
    if (!res) return;
    let root = res.root;
    for (const s of res.suggestions) if (s.status === 'pending') root = acceptSuggestion(root, s);
    setRes({ ...res, root, suggestions: res.suggestions.map((x) => (x.status === 'pending' ? { ...x, status: 'accepted' } : x)) });
  };
  const pending = res?.suggestions.filter((s) => s.status === 'pending').length ?? 0;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Paste a sample request body</span>
        <textarea className="input h-40 font-mono" aria-label="Sample JSON" value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "accountNo": "1234567890", "startDate": "2026-01-31", "flag": "Y", "key": null }' />
      </label>
      <fieldset className="flex items-center gap-4 text-xs">
        <legend className="label mb-1">Mark observed fields as required?</legend>
        <label className="flex items-center gap-1"><input type="radio" name="reqall" checked={!requireAll} onChange={() => { setRequireAll(false); res && analyze(false); }} /> None (default)</label>
        <label className="flex items-center gap-1"><input type="radio" name="reqall" checked={requireAll} onChange={() => { setRequireAll(true); res && analyze(true); }} /> All observed</label>
      </fieldset>
      <button className="btn btn-primary" disabled={!text.trim()} onClick={() => analyze()}>Infer structure</button>
      {err && <p role="alert" className="text-xs text-red-600 dark:text-red-400">Invalid JSON: {err}</p>}
      {res && (
        <>
          {res.note && <p className="text-xs text-amber-700 dark:text-amber-300">{res.note}</p>}
          <div>
            <div className="label mb-1">Inferred structure</div>
            <div className="max-h-52 overflow-auto rounded border border-slate-200 p-2 dark:border-slate-700"><Outline f={res.root} /></div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="label">Suggestions ({res.suggestions.length}) — nothing is applied until you accept</span>
              {pending > 0 && <button className="btn" onClick={acceptAll}>Accept all</button>}
            </div>
            {res.suggestions.length === 0 && <p className="text-xs text-slate-500">No rule suggestions for these values.</p>}
            <ul className="space-y-1">
              {res.suggestions.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded border border-slate-200 p-1.5 text-xs dark:border-slate-700">
                  <span className="min-w-0 flex-1"><span className="font-mono font-semibold">{s.path}</span> — {s.label}</span>
                  {s.status === 'pending' ? (
                    <>
                      <button className="btn btn-primary" onClick={() => setStatus(s.id, 'accepted')}>Accept</button>
                      <button className="btn" onClick={() => setStatus(s.id, 'rejected')}>Reject</button>
                    </>
                  ) : (
                    <span className={s.status === 'accepted' ? 'text-green-600' : 'text-slate-500'}>{s.status} <button className="underline" onClick={() => setStatus(s.id, s.status === 'accepted' ? 'rejected' : 'accepted')}>{s.status === 'accepted' ? '' : 'accept'}</button></span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <ApplyBar label="Inferred schema" build={() => stripMeta(structuredClone(res.root))} />
        </>
      )}
    </div>
  );
}
