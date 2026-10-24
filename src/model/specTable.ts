import { Field, FieldType, newField, uid } from './types';
import { numericPattern, PATTERNS } from './presets';

export type ColKey = 'io' | 'location' | 'path' | 'name' | 'type' | 'length' | 'minLength' | 'maxLength' | 'required' | 'format' | 'allowed' | 'description';
export const COL_LABELS: Record<ColKey, string> = {
  io: 'Input / Output', location: 'Location (Header/Body)', path: 'JSON path', name: 'Field name', type: 'Type', length: 'Length',
  minLength: 'Min length', maxLength: 'Max length', required: 'Required', format: 'Format / Pattern', allowed: 'Allowed values', description: 'Description',
};
const HEADERS: [ColKey, RegExp][] = [
  ['minLength', /^(min(imum)?\.?\s*(length|len)|min)$/i],
  ['maxLength', /^(max(imum)?\.?\s*(length|len)|max)$/i],
  ['io', /^(input\s*\/?\s*output|i\s*\/\s*o|direction)$/i],
  ['location', /^(loc[as]tion|located|in|place|position)$/i],
  ['path', /^(json\s*path|field\s*path|xml\s*path|path|xpath)$/i],
  ['name', /^(field(\s*name\d*)?|name|attribute|parameter|element|property|json\s*(field|key|name))\b/i],
  ['type', /^(data\s*)?type|^field\s*type/i],
  ['length', /^(field\s*)?(length|len|size)\b/i],
  ['required', /^(req|mandatory|m\s*\/\s*[nor]|r\s*\/\s*o|optional|presence)/i],
  ['format', /^(format|pattern|regex|validation)/i],
  ['allowed', /^(allowed|valid|values?|enum|expected|possible)/i],
  ['description', /^(desc|rema?r?ks?|notes?|comment)/i],
];

export function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"' && cur === '') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ''));
}

export function parseTable(text: string): { rows: string[][]; format: string } {
  const t = text.replace(/^\uFEFF/, '').trim();
  if (!t) return { rows: [], format: '' };
  if (t.startsWith('|') || /^\s*\|.*\|\s*$/m.test(t.split('\n')[0])) {
    const rows = t.split(/\r?\n/).filter((l) => l.trim().startsWith('|')).map((l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|').replace(/<br\s*\/?>/gi, ', ')));
    return { rows: rows.filter((r) => !r.every((c) => /^:?-{2,}:?$|^$/.test(c))), format: 'Markdown' };
  }
  const first = t.split(/\r?\n/)[0];
  if (first.includes('\t')) return { rows: parseDelimited(t, '\t'), format: 'TSV' };
  const commas = (first.match(/,/g) || []).length, semis = (first.match(/;/g) || []).length;
  return { rows: parseDelimited(t, semis > commas ? ';' : ','), format: 'CSV' };
}

export type ColMap = Record<ColKey, number>;
export function detectColumns(header: string[]): { map: ColMap; ok: boolean } {
  const map = Object.fromEntries((Object.keys(COL_LABELS) as ColKey[]).map((k) => [k, -1])) as ColMap;
  header.forEach((h, i) => {
    const hh = h.replace(/[*()]/g, '').replace(/\s+/g, ' ').trim();
    for (const [k, re] of HEADERS) if (map[k] === -1 && re.test(hh)) { map[k] = i; break; }
  });
  return { map, ok: map.name >= 0 || map.path >= 0 };
}

/** pick the real header among the first rows (handles group-title rows like "ESB PARAMETER" above it) */
export function detectHeaderRow(rows: string[][]): number {
  let best = 0, score = -1;
  rows.slice(0, 6).forEach((r, i) => {
    const d = detectColumns(r);
    const sc = d.ok ? Object.values(d.map).filter((x) => x >= 0).length : 0;
    if (sc > score) { score = sc; best = i; }
  });
  return best;
}

export function parseLength(s: string): { min?: number; max?: number; decimals?: number } {
  const t = s.trim();
  if (!t) return {};
  // Banking precision/scale notation: "18,2", "18.2", "19,0", "17,2 (18 Inc Decimal)"
  const ps = /^(\d+)\s*[,.]\s*(\d+)(?:\s*\((\d+)\s*inc[^)]*\))?$/i.exec(t);
  if (ps) {
    const a = +ps[1], b = +ps[2], inc = ps[3] ? +ps[3] : undefined;
    if (a >= b) {
      return { max: inc ?? a, ...(b > 0 ? { decimals: b } : {}) };
    }
    return { min: a, max: b };
  }
  const nums = t.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return {};
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  if (/\bmin/i.test(t) && !/\bmax/i.test(t)) return { min: nums[0] };
  return { max: nums[0] };
}

export function parseRequired(s: string): boolean | undefined {
  const t = s.trim().toLowerCase();
  if (!t) return undefined;
  if (/^(y|yes|m|r|mandatory|required|true|x|✓|✔|1)$/.test(t)) return true;
  if (/^(n|no|o|optional|false|c|conditional|0|-)$/.test(t)) return false;
  if (/mandatory|required/.test(t) && !/not|if|cond/.test(t)) return true;
  return false;
}

export function parseAllowed(s: string): string[] | undefined {
  let t = s.trim();
  if (!t) return undefined;
  t = t.replace(/<br\s*\/?>/gi, ',');
  let tokens = t.split(/[,;|\n]/).map((x) => x.trim()).filter(Boolean);
  if (tokens.length === 1 && tokens[0].includes('/') && !/\s/.test(tokens[0])) tokens = tokens[0].split('/');
  const Q = `"'“”‘’`;
  const vals: string[] = [];
  for (const tok of tokens) {
    if (/^\*?\s*(blanks?|empty|space)\b/i.test(tok)) { vals.push(''); continue; }
    const m = new RegExp(`^[${Q}]?([^\\s${Q}]+)[${Q}]?\\s*[-–—=:]\\s*\\S`).exec(tok);
    if (m) { vals.push(m[1]); continue; }
    const v = tok.replace(new RegExp(`^[${Q}]+|[${Q}]+$`, 'g'), '');
    if (/^\S{1,40}$/.test(v)) vals.push(v);
    else return undefined;
  }
  return vals.length > 0 && vals.length <= 40 ? [...new Set(vals)] : undefined;
}

export interface SpecRow {
  id: string;
  path: string;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  enum?: string[];
  description: string;
  notes: string[];
}

const FORMATS = ['date-time', 'email', 'hostname', 'ipv4', 'ipv6', 'uri'];

export function interpretRow(cells: string[], map: ColMap): SpecRow | null {
  const g = (k: ColKey) => (map[k] >= 0 ? cells[map[k]] ?? '' : '');
  const rawPath = g('path').trim();
  const rawName = g('name').trim();
  let path = rawPath
    ? rawPath.replace(/^\$\.?/, '').replace(/^\/+/, '').replace(/\[(\d+|\*)?\]/g, '[]').replace(/\//g, rawPath.includes('.') ? '/' : '.')
    : rawName;
  path = path.replace(/^[\s\-–•·]+|\s+$/g, '').replace(/\s+/g, '');
  if (!path) return null;
  const notes: string[] = [];
  const typeText = g('type').replace(/\s+/g, ' ').trim();
  const tl = typeText.toLowerCase();
  let type: FieldType = 'string';
  let numericStr = false;
  let decimalStr = false;
  if (/^(int|integer|long|short|bigint)\b/.test(tl)) type = 'integer';
  else if (/^(number|float|double|real)\b/.test(tl)) type = 'number';
  else if (/^(decimal)\b/.test(tl) || /string\s*\(\s*decimal\s*\)/i.test(typeText)) { decimalStr = true; }
  else if (/^(numeric|nc|n|num)\b/.test(tl)) { numericStr = true; notes.push('"Numeric" read as numeric STRING (digits only)'); }
  else if (/^bool/.test(tl)) type = 'boolean';
  else if (/^(obj|object|struct|group|complex|record)/.test(tl)) type = 'object';
  else if (/^(array|list|\[\])/.test(tl)) type = 'array';
  else if (tl && !/^(string|stirng|strng|str|text|varchar|char|alphanumeric|alpha|an|a|date|datetime|timestamp|time)/.test(tl)) notes.push(`Unknown type "${typeText}" → string`);
  if (type === 'string' && /numeric/i.test(tl) && !numericStr) numericStr = true;
  if (/^(stirng|strng)/.test(tl)) notes.push(`Type "${typeText}" typo → string`);

  let { min, max, decimals } = parseLength(g('length'));
  if (map.minLength >= 0) { const m = parseLength(g('minLength')); if (m.max !== undefined) min = m.max; }
  if (map.maxLength >= 0) { const m = parseLength(g('maxLength')); if (m.max !== undefined) max = m.max; }
  const tl2 = /\((\d+)(?:\s*[,-]\s*(\d+))?\)/.exec(typeText);
  if (tl2 && max === undefined) { max = tl2[2] ? +tl2[2] : +tl2[1]; if (tl2[2]) min = +tl2[1]; }

  const reqText = g('required');
  const row: SpecRow = { id: uid(), path, type, required: parseRequired(reqText) ?? false, nullable: false, description: g('description').replace(/\s+/g, ' ').trim(), notes };
  if (/m/i.test(reqText) && /o/i.test(reqText) && /[\/]/.test(reqText)) notes.push(`"${reqText}" (conditional) → optional in schema`);
  const fmt = g('format').trim();
  const enumVals = parseAllowed(g('allowed'));
  if (enumVals) row.enum = enumVals;
  if (type === 'string') {
    if (min !== undefined) row.minLength = min;
    if (max !== undefined) row.maxLength = max;
    if (decimals !== undefined && decimals > 0) {
      row.pattern = `^[0-9]+(\\.[0-9]{1,${decimals}})?$`;
      notes.push(`Decimal pattern (≤${decimals} decimal places)`);
    } else if (decimalStr) {
      row.pattern = PATTERNS.amount;
      notes.push('Decimal amount pattern (≤2 decimal places)');
    } else if (numericStr) {
      row.pattern = numericPattern(max);
    }
    if (fmt) {
      const f = fmt.toLowerCase();
      if (fmt.startsWith('^')) row.pattern = fmt;
      else if (/yyyy.?mm.?dd.?t?\s*hh/.test(f)) { row.pattern = PATTERNS.datetime; notes.push('Datetime preset pattern'); }
      else if (/yyyy.?mm.?dd/.test(f)) { row.pattern = PATTERNS.date; row.maxLength ??= 10; notes.push('Date preset pattern (cannot reject 2026-02-31)'); }
      else if (/hh.?mm.?ss/.test(f)) { row.pattern = PATTERNS.time; }
      else if (/alphanumeric/.test(f)) row.pattern = '^[A-Za-z0-9]+$';
      else if (/numeric|digits?\s*only|number/.test(f)) row.pattern = decimals ? `^[0-9]+(\\.[0-9]{1,${decimals}})?$` : numericPattern(max);
      else if (/^alpha(betic)?\b/.test(f)) row.pattern = '^[A-Za-z]+$';
      else if (FORMATS.includes(f)) row.format = f;
      else notes.push(`Format "${fmt}" not recognised — ignored`);
    }
    if (!row.pattern && !row.format && !row.enum) {
      if (/^(datetime|timestamp)/.test(tl)) { row.pattern = PATTERNS.datetime; notes.push('Datetime preset pattern'); }
      else if (/^(date|string\s*\(?\s*date\s*\)?)$/.test(tl)) {
        if (max === undefined || max === 10) {
          row.pattern = PATTERNS.date;
          row.maxLength ??= 10;
          notes.push('Date preset pattern (cannot reject 2026-02-31)');
        } else if (max === 4) {
          row.pattern = '^(0[1-9]|1[0-2])([0-2][0-9]|3[0-1])$';
          notes.push('4-char date (MMDD) pattern');
        } else if (max === 8) {
          row.pattern = '^[0-9]{4}(0[1-9]|1[0-2])([0-2][0-9]|3[0-1])$';
          notes.push('8-char date (YYYYMMDD) pattern');
        }
      }
    }
    if (row.required && row.minLength === undefined && !row.pattern?.startsWith('^$|') && !row.enum) row.minLength = 1;
  } else if (type === 'integer' && max !== undefined && max <= 15) {
    (row as any).maximum = Math.pow(10, max) - 1;
    notes.push(`length ${max} → maximum ${Math.pow(10, max) - 1}`);
  }
  if (g('allowed') && !enumVals) notes.push('Allowed values not parsed as a list');
  if (!g('length') && !tl2 && type === 'string' && !row.pattern && !row.enum) notes.push('No length given');
  return row;
}

export interface InterpretOptions {
  inputOnly?: boolean;
  bodyOnly?: boolean;
}

/** `skip` = number of leading rows to skip (header rows). `true` = auto-detect header row, `false` = 0. */
export function interpretTable(rows: string[][], map: ColMap, skip: number | boolean = true, opts: InterpretOptions | boolean = true): SpecRow[] {
  const options: InterpretOptions = typeof opts === 'boolean' ? { inputOnly: opts, bodyOnly: true } : { inputOnly: true, bodyOnly: true, ...opts };
  const n = typeof skip === 'number' ? skip : skip ? detectHeaderRow(rows) + 1 : 0;
  const dataRows = rows.slice(n);
  const hasJsonPaths = map.path >= 0 && dataRows.some((r) => /^\$|^\/|\./.test((r[map.path] ?? '').trim()));
  const hasDollarPaths = map.path >= 0 && dataRows.some((r) => /^\$/.test((r[map.path] ?? '').trim()));

  const seen = new Map<string, { row: SpecRow; count: number }>();
  let inResponseSection = false;

  for (const r of dataRows) {
    const rawPath = map.path >= 0 ? (r[map.path] ?? '').trim() : '';
    const rawType = map.type >= 0 ? (r[map.type] ?? '').trim() : '';
    const rawLen = map.length >= 0 ? (r[map.length] ?? '').trim() : '';
    const rawReq = map.required >= 0 ? (r[map.required] ?? '').trim() : '';
    // Detect section divider banners like "Response Data for Success" / "OUTPUT" / "Request Data"
    if (!rawPath && !rawType) {
      if (r.some((c) => /^(response\s*(data|header|body|parameter)?|output|transaction\s*status)\b/i.test(c.trim()))) {
        inResponseSection = true;
        continue;
      }
      if (r.some((c) => /^request\s*(data|header|body|parameter)?\b/i.test(c.trim()))) {
        inResponseSection = false;
        continue;
      }
    }
    // Skip container-only banner rows (e.g. "$.system" or "$.pagination" with no type, length, or M/O)
    if (!rawType && !rawLen && !rawReq) continue;
    if (options.inputOnly) {
      if (inResponseSection) continue;
      if (map.io >= 0) {
        const io = (r[map.io] ?? '').trim();
        if (io && !/^in/i.test(io)) continue;
      }
    }
    if (options.bodyOnly) {
      if (map.location >= 0) {
        const loc = (r[map.location] ?? '').trim().toLowerCase();
        if (loc && loc !== 'body' && !/^\$\./.test(rawPath)) continue;
      }
      if (hasJsonPaths && !rawPath) continue;
      if (hasDollarPaths && !/^\$|^\/|\./.test(rawPath)) continue;
    }
    const row = interpretRow(r, map);
    if (!row) continue;
    const prev = seen.get(row.path);
    if (prev) {
      prev.count++;
      const isIndexedArray = /\[(\d+|\*)\]/.test(rawPath);
      const msg = isIndexedArray ? `Merged ${prev.count} array index rows` : 'Duplicate path — replaces earlier row';
      row.notes = [...row.notes.filter((x) => !x.startsWith('Merged ') && !x.startsWith('Duplicate ')), msg];
      seen.set(row.path, { row, count: prev.count });
    } else {
      seen.set(row.path, { row, count: 1 });
    }
  }
  return [...seen.values()].map((x) => x.row);
}

function rowToField(r: SpecRow, name: string): Field {
  const rules: Field['rules'] = {};
  if (r.minLength !== undefined) rules.minLength = r.minLength;
  if (r.maxLength !== undefined) rules.maxLength = r.maxLength;
  if (r.pattern) rules.pattern = r.pattern;
  if (r.format) rules.format = r.format;
  if (r.enum?.length) rules.enum = r.type === 'string' ? r.enum : r.enum.map((x) => (isNaN(+x) ? x : +x));
  if ((r as any).maximum !== undefined) rules.maximum = (r as any).maximum;
  return newField({ name, type: r.type, required: r.required, nullable: r.nullable, description: r.description, rules });
}

/** Build a tree from interpreted rows using dotted paths and [] for arrays */
export function rowsToTree(rows: SpecRow[]): Field {
  const root = newField({ type: 'object' });
  const ensure = (parent: Field, seg: string, last: SpecRow | null): Field => {
    const isArr = seg.endsWith('[]');
    const name = isArr ? seg.slice(0, -2) : seg;
    const list = parent.type === 'array' ? parent.items!.children : parent.children;
    let f = list.find((c) => c.name === name);
    if (!f) {
      f = newField({ name, type: isArr ? 'array' : 'object' });
      if (isArr) f.items = newField({ type: 'object' });
      list.push(f);
    } else if (isArr && f.type !== 'array') {
      f.type = 'array';
      f.items = newField({ type: 'object' });
    } else if (!isArr && f.type !== 'object' && !last) {
      f.type = 'object';
    }
    if (isArr && f.items && f.items.type !== 'object') f.items = newField({ type: 'object' });
    return f;
  };
  for (const r of rows) {
    const segs = r.path.split('.').filter(Boolean);
    let cur = root;
    for (let i = 0; i < segs.length - 1; i++) {
      const f = ensure(cur, segs[i], null);
      if (r.required) f.required = true;
      cur = f;
      if (f.type === 'array') cur = f; // array → children live in items
    }
    const last = segs[segs.length - 1];
    const isArr = last.endsWith('[]');
    const name = isArr ? last.slice(0, -2) : last;
    const list = cur.type === 'array' ? cur.items!.children : cur.children;
    const built = rowToField(r, name);
    const idx = list.findIndex((c) => c.name === name);
    if (isArr) {
      const arr = newField({ name, type: 'array', required: r.required, description: r.description, items: { ...built, name: '', required: false, description: '' } });
      if (idx >= 0) { arr.items = list[idx].type === 'array' && list[idx].items?.children.length ? list[idx].items : arr.items; list[idx] = { ...arr, id: list[idx].id }; }
      else list.push(arr);
    } else if (idx >= 0) {
      const old = list[idx];
      list[idx] = { ...built, id: old.id, children: old.children, items: old.items, type: old.children.length && built.type !== 'object' ? 'object' : built.type };
      if (old.type === 'array' && built.type === 'array') list[idx].items = old.items;
    } else {
      if (built.type === 'array') built.items = newField({ type: 'string' });
      list.push(built);
    }
  }
  return root;
}

/** Parse a full CSV/TSV/Markdown text directly into SpecRows + tree */
export function parseSpecDocument(text: string, opts?: InterpretOptions) {
  const { rows, format } = parseTable(text);
  if (!rows.length) return { rows: [], headerRow: 0, map: detectColumns([]).map, ok: false, specRows: [] as SpecRow[], format };
  const headerRow = detectHeaderRow(rows);
  const { map, ok } = detectColumns(rows[headerRow]);
  const specRows = ok ? interpretTable(rows, map, headerRow + 1, opts) : [];
  return { rows, headerRow, map, ok, specRows, format };
}
