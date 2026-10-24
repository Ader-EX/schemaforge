import { useMemo, useState } from 'react';
import { COL_LABELS, ColKey, ColMap, detectColumns, interpretTable, parseTable, rowsToTree, SpecRow } from '../../model/specTable';
import { FIELD_TYPES, FieldType } from '../../model/types';
import { enumToText, parseEnumText } from './RulesEditor';
import { ApplyBar } from './InferPanel';

const EXAMPLE = `Field Name\tType\tLength\tM/O\tAllowed Values\tDescription
accountInfo.accountNo\tNumeric\t1-19\tM\t\tAccount number
accountInfo.accountType\tString\t3\tM\t'CDA', 'SDA'\tAccount type
transactionType\tString\t1\tO\tC - Credit, D - Debit, *Blanks - Both\tTransaction type
items[].id\tInteger\t3\tM\t\tItem id
startDate\tString\t10\tO\tYYYY-MM-DD\tStart date`;

export function SpecPanel() {
  const [text, setText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [override, setOverride] = useState<Partial<ColMap>>({});
  const [edits, setEdits] = useState<Record<string, Partial<SpecRow> & { _del?: boolean }>>({});

  const parsed = useMemo(() => parseTable(text), [text]);
  const detected = useMemo(() => (parsed.rows.length ? detectColumns(parsed.rows[0]) : null), [parsed]);
  const map: ColMap | null = detected ? ({ ...detected.map, ...override } as ColMap) : null;
  const base = useMemo(() => (map && parsed.rows.length ? interpretTable(parsed.rows, map, hasHeader) : []), [parsed, JSON.stringify(map), hasHeader]);
  const rows: SpecRow[] = base.map((r) => ({ ...r, ...(edits[r.id] ?? {}) })).filter((r) => !(edits[r.id] as any)?._del);
  const ncols = Math.max(0, ...parsed.rows.map((r) => r.length));
  const edit = (id: string, p: Partial<SpecRow> & { _del?: boolean }) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...p } }));

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Paste TSV / CSV (Excel, Confluence) or a Markdown table</span>
        <textarea className="input h-36 font-mono" aria-label="Field spec table" value={text} onChange={(e) => { setText(e.target.value); setEdits({}); setOverride({}); }} placeholder={EXAMPLE} />
      </label>
      <div className="flex gap-2"><button className="btn" onClick={() => { setText(EXAMPLE); setEdits({}); setOverride({}); }}>Load example table</button></div>
      {detected && (
        <details open={!detected.ok}>
          <summary className="cursor-pointer text-xs font-semibold">
            Column mapping ({parsed.format}) {detected.ok ? '✓ auto-detected' : <span className="text-red-600 dark:text-red-400">— could not detect the "Field name" column, please map it</span>}
          </summary>
          <label className="my-1 flex items-center gap-1 text-xs"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> First row is a header</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(COL_LABELS) as ColKey[]).map((k) => (
              <label key={k} className="text-xs">
                <span className="label block">{COL_LABELS[k]}</span>
                <select className="input" value={map![k]} onChange={(e) => setOverride({ ...override, [k]: Number(e.target.value) })}>
                  <option value={-1}>— none —</option>
                  {Array.from({ length: ncols }, (_, i) => <option key={i} value={i}>{i + 1}: {(parsed.rows[0][i] ?? '').slice(0, 24)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </details>
      )}
      {rows.length > 0 && (
        <>
          <div className="label">Preview — how each row was interpreted (editable)</div>
          <div className="max-h-80 overflow-auto rounded border border-slate-200 dark:border-slate-700">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                <tr>{['Path', 'Type', 'Req', 'Null', 'Min', 'Max', 'Pattern', 'Enum', 'Notes', ''].map((h) => <th key={h} className="px-1 py-1 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200 align-top dark:border-slate-700">
                    <td className="p-0.5"><input className="input w-36 font-mono" aria-label="Path" value={r.path} onChange={(e) => edit(r.id, { path: e.target.value })} /></td>
                    <td className="p-0.5"><select className="input w-20" aria-label="Type" value={r.type} onChange={(e) => edit(r.id, { type: e.target.value as FieldType })}>{FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></td>
                    <td className="p-0.5 text-center"><input type="checkbox" aria-label="Required" checked={r.required} onChange={(e) => edit(r.id, { required: e.target.checked })} /></td>
                    <td className="p-0.5 text-center"><input type="checkbox" aria-label="Nullable" checked={r.nullable} onChange={(e) => edit(r.id, { nullable: e.target.checked })} /></td>
                    <td className="p-0.5"><input className="input w-12" type="number" aria-label="Min length" value={r.minLength ?? ''} onChange={(e) => edit(r.id, { minLength: e.target.value === '' ? undefined : +e.target.value })} /></td>
                    <td className="p-0.5"><input className="input w-14" type="number" aria-label="Max length" value={r.maxLength ?? ''} onChange={(e) => edit(r.id, { maxLength: e.target.value === '' ? undefined : +e.target.value })} /></td>
                    <td className="p-0.5"><input className="input w-32 font-mono" aria-label="Pattern" value={r.pattern ?? ''} onChange={(e) => edit(r.id, { pattern: e.target.value || undefined })} /></td>
                    <td className="p-0.5"><input className="input w-24 font-mono" aria-label="Enum" defaultValue={enumToText(r.enum)} onBlur={(e) => edit(r.id, { enum: parseEnumText(e.target.value, false).length ? parseEnumText(e.target.value, false) : undefined })} /></td>
                    <td className="max-w-[10rem] p-0.5 text-amber-700 dark:text-amber-300">{r.notes.join('; ')}</td>
                    <td className="p-0.5"><button className="btn btn-ghost" aria-label={`Remove row ${r.path}`} onClick={() => edit(r.id, { _del: true })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ApplyBar label="Spec table" build={() => rowsToTree(rows)} />
        </>
      )}
    </div>
  );
}
