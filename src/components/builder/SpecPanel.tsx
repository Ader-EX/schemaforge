import { useMemo, useState } from 'react';
import { COL_LABELS, ColKey, ColMap, detectColumns, detectHeaderRow, interpretTable, parseSpecDocument, parseTable, rowsToTree, SpecRow } from '../../model/specTable';
import { decodeBytes } from '../../model/decode';
import { FIELD_TYPES, FieldType } from '../../model/types';
import { fieldToSchema } from '../../model/toSchema';
import { genValid } from '../../engine/generate';
import { enumToText, parseEnumText } from './RulesEditor';
import { ApplyBar } from './InferPanel';
import { useStore } from '../../store';

const EXAMPLE = `Field Name\tType\tLength\tM/O\tAllowed Values\tDescription
accountInfo.accountNo\tNumeric\t1-19\tM\t\tAccount number
accountInfo.accountType\tString\t3\tM\t'CDA', 'SDA'\tAccount type
transactionType\tString\t1\tO\tC - Credit, D - Debit, *Blanks - Both\tTransaction type
items[].id\tInteger\t3\tM\t\tItem id
startDate\tString\t10\tO\tYYYY-MM-DD\tStart date`;

interface BulkItem {
  name: string;
  format: string;
  headerRow: number;
  ok: boolean;
  specRows: SpecRow[];
}

export function SpecPanel() {
  const { createProject, setUI, toast } = useStore();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [inputOnly, setInputOnly] = useState(true);
  const [bodyOnly, setBodyOnly] = useState(true);
  const [override, setOverride] = useState<Partial<ColMap>>({});
  const [edits, setEdits] = useState<Record<string, Partial<SpecRow> & { _del?: boolean }>>({});
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'required' | 'notes'>('all');
  const [bulk, setBulk] = useState<BulkItem[]>([]);

  const parsed = useMemo(() => parseTable(text), [text]);
  const headerIdx = useMemo(() => (parsed.rows.length && hasHeader ? detectHeaderRow(parsed.rows) : 0), [parsed, hasHeader]);
  const detected = useMemo(() => (parsed.rows.length ? detectColumns(parsed.rows[headerIdx] ?? parsed.rows[0]) : null), [parsed, headerIdx]);
  const map: ColMap | null = detected ? ({ ...detected.map, ...override } as ColMap) : null;
  const base = useMemo(
    () => (map && parsed.rows.length ? interpretTable(parsed.rows, map, hasHeader ? headerIdx + 1 : 0, { inputOnly, bodyOnly }) : []),
    [parsed, JSON.stringify(map), hasHeader, headerIdx, inputOnly, bodyOnly],
  );
  const rows: SpecRow[] = base.map((r) => ({ ...r, ...(edits[r.id] ?? {}) })).filter((r) => !(edits[r.id] as any)?._del);
  const ncols = Math.max(0, ...parsed.rows.map((r) => r.length));
  const edit = (id: string, p: Partial<SpecRow> & { _del?: boolean }) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...p } }));

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterMode === 'required' && !r.required) return false;
      if (filterMode === 'notes' && r.notes.length === 0) return false;
      if (q && !r.path.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterMode]);

  const handleUploadFiles = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.csv,.tsv,.txt,.md,text/csv,text/tab-separated-values,text/markdown';
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      if (files.length === 1) {
        const buf = await files[0].arrayBuffer();
        const decoded = decodeBytes(buf);
        setBulk([]);
        setFileName(files[0].name.replace(/\.[^.]+$/, ''));
        setText(decoded);
        setEdits({});
        setOverride({});
        toast(`Loaded ${files[0].name}`);
      } else {
        const items: BulkItem[] = [];
        for (const f of files) {
          const decoded = decodeBytes(await f.arrayBuffer());
          const res = parseSpecDocument(decoded, { inputOnly, bodyOnly });
          items.push({
            name: f.name.replace(/\.[^.]+$/, ''),
            format: res.format,
            headerRow: res.headerRow,
            ok: res.ok,
            specRows: res.specRows,
          });
        }
        setBulk(items);
        toast(`Parsed ${items.length} spec files`);
      }
    };
    input.click();
  };

  const createBulkProjects = () => {
    const validItems = bulk.filter((b) => b.ok && b.specRows.length > 0);
    if (!validItems.length) return;
    for (const item of validItems) {
      const root = rowsToTree(item.specRows);
      const schema = { $schema: 'http://json-schema.org/draft-04/schema#', title: item.name, ...fieldToSchema(root) };
      const sample = genValid(schema, { optional: false });
      createProject(item.name, schema, [{ name: 'valid happy path', payload: sample, expect: 'pass' }]);
    }
    setBulk([]);
    setUI({ leftTab: 'visual' });
    toast(`Created ${validItems.length} project(s) from spec files`);
  };

  const createSingleProject = () => {
    const root = rowsToTree(rows);
    const name = fileName || 'SpecSchema';
    const schema = { $schema: 'http://json-schema.org/draft-04/schema#', title: name, ...fieldToSchema(root) };
    const sample = genValid(schema, { optional: false });
    createProject(name, schema, [{ name: 'valid happy path', payload: sample, expect: 'pass' }]);
    setUI({ leftTab: 'visual' });
    toast(`Created project "${name}" (${rows.length} fields)`);
  };

  const reqCount = rows.filter((r) => r.required).length;
  const noteCount = rows.filter((r) => r.notes.length > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={handleUploadFiles}>📂 Upload CSV / TSV file(s) (single or bulk)</button>
        <button className="btn" onClick={() => { setBulk([]); setFileName('ExampleSpec'); setText(EXAMPLE); setEdits({}); setOverride({}); }}>Load example table</button>
      </div>

      {bulk.length > 0 && (
        <div className="space-y-2 rounded-md border border-indigo-400 bg-indigo-50/70 p-3 dark:border-indigo-700 dark:bg-indigo-950/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Bulk spec import — {bulk.length} files selected</span>
            <button className="btn btn-ghost text-xs" onClick={() => setBulk([])}>✕ Clear</button>
          </div>
          <div className="max-h-48 overflow-auto rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="p-1.5 text-left">Service / File</th>
                  <th className="p-1.5 text-left">Format</th>
                  <th className="p-1.5 text-right">Request Body Fields</th>
                  <th className="p-1.5 text-right">Required</th>
                </tr>
              </thead>
              <tbody>
                {bulk.map((b, i) => (
                  <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-1.5 font-mono font-medium">{b.name}</td>
                    <td className="p-1.5">{b.format} (hdr row #{b.headerRow + 1})</td>
                    <td className="p-1.5 text-right font-semibold">{b.ok ? b.specRows.length : <span className="text-red-600">No path/name col</span>}</td>
                    <td className="p-1.5 text-right">{b.specRows.filter((r) => r.required).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" onClick={createBulkProjects}>
            Create all {bulk.filter((b) => b.ok && b.specRows.length > 0).length} project(s)
          </button>
        </div>
      )}

      <label className="block">
        <span className="label">Or paste TSV / CSV (Excel, ESB/SNAP spec, Confluence) or Markdown table</span>
        <textarea className="input h-28 font-mono" aria-label="Field spec table" value={text} onChange={(e) => { setText(e.target.value); setEdits({}); setOverride({}); }} placeholder={EXAMPLE} />
      </label>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1"><input type="checkbox" className="accent-indigo-600" checked={inputOnly} onChange={(e) => setInputOnly(e.target.checked)} /> Input only (skip Response/Output)</label>
        <label className="flex items-center gap-1"><input type="checkbox" className="accent-indigo-600" checked={bodyOnly} onChange={(e) => setBodyOnly(e.target.checked)} /> Body only (skip HTTP Headers)</label>
      </div>

      {detected && (
        <details open={!detected.ok}>
          <summary className="cursor-pointer text-xs font-semibold">
            Column mapping ({parsed.format}, header row #{headerIdx + 1}) {detected.ok ? '✓ auto-detected' : <span className="text-red-600 dark:text-red-400">— could not detect the "Field name" or "JSON path" column, please map it</span>}
          </summary>
          <label className="my-1 flex items-center gap-1 text-xs"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> Table has a header row</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(COL_LABELS) as ColKey[]).map((k) => (
              <label key={k} className="text-xs">
                <span className="label block">{COL_LABELS[k]}</span>
                <select className="input" value={map![k]} onChange={(e) => setOverride({ ...override, [k]: Number(e.target.value) })}>
                  <option value={-1}>— none —</option>
                  {Array.from({ length: ncols }, (_, i) => <option key={i} value={i}>{i + 1}: {(parsed.rows[headerIdx]?.[i] ?? '').replace(/\s+/g, ' ').slice(0, 24)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </details>
      )}
      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label mr-auto">Preview — {filteredRows.length} of {rows.length} fields shown</span>
            <div className="flex gap-1">
              <button className={`btn px-2 py-0.5 text-[11px] ${filterMode === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilterMode('all')}>All ({rows.length})</button>
              <button className={`btn px-2 py-0.5 text-[11px] ${filterMode === 'required' ? 'btn-primary' : ''}`} onClick={() => setFilterMode('required')}>Required ({reqCount})</button>
              <button className={`btn px-2 py-0.5 text-[11px] ${filterMode === 'notes' ? 'btn-primary' : ''}`} onClick={() => setFilterMode('notes')}>Notes ({noteCount})</button>
            </div>
            <input className="input w-44" placeholder="Filter by path or desc…" aria-label="Filter preview rows" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-80 overflow-auto rounded border border-slate-200 dark:border-slate-700">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                <tr>{['Path', 'Type', 'Req', 'Null', 'Min', 'Max', 'Pattern', 'Enum', 'Notes', ''].map((h) => <th key={h} className="px-1 py-1 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
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
          <div className="flex flex-wrap items-center gap-2">
            <ApplyBar label="Spec table" build={() => rowsToTree(rows)} />
            <button className="btn" onClick={createSingleProject}>＋ Save as new project{fileName ? ` (${fileName})` : ''}</button>
          </div>
        </>
      )}
    </div>
  );
}
