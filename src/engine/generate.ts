import RandExp from 'randexp';
import { clone, delAt, getAt, Ptr, setAt, toPointer } from './jsonptr';
import { validatePayload, ValidationResult } from './validator';

export interface GenCase {
  id: string;
  group: 'invalid' | 'boundary';
  label: string;
  payload: any;
  expect: 'pass' | 'fail';
  /** expected failing pointer (when expect === fail) and acceptable keywords */
  expectedPath?: string;
  keywords?: string[];
  note?: string;
  result?: ValidationResult;
  status?: 'ok' | 'mismatch';
  actual?: string;
}

const types = (n: any): string[] => (Array.isArray(n?.type) ? n.type : n?.type ? [n.type] : []);
const primary = (n: any) => types(n).find((t) => t !== 'null') ?? (n?.properties ? 'object' : n?.items ? 'array' : undefined);
const isNullable = (n: any) => types(n).includes('null');

function rx(pattern: string): RegExp | null {
  try { return new RegExp(pattern); } catch { return null; }
}
function randStr(pattern: string, ok: (s: string) => boolean, tries = 200): string | null {
  const r = rx(pattern);
  if (!r) return null;
  let g: RandExp;
  try { g = new RandExp(pattern); } catch { return null; }
  g.max = 10;
  for (let i = 0; i < tries; i++) {
    const s = g.gen();
    if (r.test(s) && ok(s)) return s;
  }
  return null;
}
const inLen = (n: any, min = 0, max = Infinity) => (s: string) => s.length >= Math.max(min, n.minLength ?? 0) && s.length <= Math.min(max, n.maxLength ?? Infinity);
const word = (len: number) => {
  const a = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from({ length: len }, (_, i) => a[(i * 7 + 3) % 26]).join('');
};

export function genString(n: any, mode: 'valid' | 'min' | 'max' | 'minus' | 'plus' = 'valid'): string {
  const minL = n.minLength ?? 0, maxL = n.maxLength ?? Infinity;
  if (Array.isArray(n.enum)) {
    const c = n.enum.filter((x: any) => typeof x === 'string');
    return c.find((x: string) => x !== '') ?? c[0] ?? 'x';
  }
  const target = mode === 'min' ? minL : mode === 'max' ? (isFinite(maxL) ? maxL : 20) : mode === 'minus' ? minL - 1 : mode === 'plus' ? maxL + 1 : Math.max(1, minL);
  const wantLen = mode === 'valid' ? undefined : target;
  if (typeof n.pattern === 'string') {
    // prefer exact length when asked, else any valid one (non-empty preferred)
    const s: string | null | false =
      (wantLen !== undefined && randStr(n.pattern, (x) => x.length === wantLen, 400)) ||
      (mode === 'valid' && (randStr(n.pattern, (x) => x.length > 0 && inLen(n)(x)) ?? randStr(n.pattern, inLen(n)))) ||
      (mode !== 'valid' ? randStr(n.pattern, () => true, 50) : null);
    if (typeof s === 'string') return s;
  }
  if (n.format === 'email') return 'user@example.com';
  if (n.format === 'date-time') return '2026-01-31T10:20:30Z';
  if (n.format === 'ipv4') return '10.0.0.1';
  if (n.format === 'uri') return 'https://example.com';
  if (n.format === 'hostname') return 'example.com';
  const len = wantLen !== undefined ? Math.max(0, wantLen) : Math.min(Math.max(minL, 6), maxL);
  return word(len);
}

function genNumber(n: any, integer: boolean, mode: 'valid' | 'min' | 'max' = 'valid'): number {
  const step = integer ? 1 : 0.01;
  let lo = typeof n.minimum === 'number' ? n.minimum + (n.exclusiveMinimum ? step : 0) : undefined;
  let hi = typeof n.maximum === 'number' ? n.maximum - (n.exclusiveMaximum ? step : 0) : undefined;
  let v: number;
  if (Array.isArray(n.enum)) return n.enum.find((x: any) => typeof x === 'number') ?? 0;
  if (mode === 'min') v = lo ?? (hi !== undefined ? hi - 10 : 0);
  else if (mode === 'max') v = hi ?? (lo !== undefined ? lo + 10 : 100);
  else v = lo !== undefined && hi !== undefined ? Math.round((lo + hi) / 2) : lo !== undefined ? lo + 1 : hi !== undefined ? hi - 1 : 1;
  if (integer) v = Math.round(v);
  if (n.multipleOf) {
    const m = n.multipleOf;
    v = Math.ceil(v / m) * m;
    if (hi !== undefined && v > hi) v = Math.floor(hi / m) * m;
  }
  return v;
}

export function genValid(schema: any, opts: { optional: boolean }): any {
  const gen = (n: any, depth = 0): any => {
    if (!n || typeof n !== 'object' || depth > 12) return null;
    if (Array.isArray(n.enum) && n.enum.length) {
      const c = n.enum.filter((x: any) => x !== '' && x !== null);
      return c.length ? c[0] : n.enum[0];
    }
    switch (primary(n)) {
      case 'object': {
        const o: any = {};
        const req: string[] = n.required ?? [];
        for (const [k, v] of Object.entries<any>(n.properties ?? {})) if (opts.optional || req.includes(k)) o[k] = gen(v, depth + 1);
        for (const k of req) if (!(k in o)) o[k] = 'x';
        return o;
      }
      case 'array': {
        const cnt = Math.max(n.minItems ?? 0, 1);
        const len = Math.min(cnt, n.maxItems ?? cnt);
        return Array.from({ length: len }, (_, i) => {
          const v = gen(n.items ?? {}, depth + 1);
          return n.uniqueItems && typeof v === 'string' ? v + (i ? i : '') : v;
        });
      }
      case 'integer': return genNumber(n, true);
      case 'number': return genNumber(n, false);
      case 'boolean': return true;
      case 'string': return genString(n);
      default: return 'x';
    }
  };
  return gen(schema);
}

const wrongValue = (n: any): any => {
  switch (primary(n)) {
    case 'string': return 12345;
    case 'integer': case 'number': return 'abc';
    case 'boolean': return 'true';
    case 'object': return 'not-an-object';
    case 'array': return 'not-an-array';
    default: return undefined;
  }
};

export function genCases(schema: any, seedBase?: any): GenCase[] {
  const base = seedBase ?? genValid(schema, { optional: true });
  const cases: GenCase[] = [];
  let seq = 0;
  const add = (c: Omit<GenCase, 'id' | 'payload'> & { mutate: (p: any) => void }) => {
    const p = clone(base);
    c.mutate(p);
    const { mutate: _m, ...rest } = c;
    cases.push({ id: `c${seq++}`, payload: p, ...rest });
  };
  const L = (ptr: Ptr) => (ptr.length ? ptr.filter((x) => x !== 'properties').join('.') : '(root)');

  const walk = (n: any, ptr: Ptr, sp: Ptr) => {
    // ptr = data path, sp unused (kept for clarity)
    if (!n || typeof n !== 'object') return;
    const t = primary(n);
    const path = toPointer(ptr);
    const name = L(ptr);
    if (ptr.length) {
      const w = wrongValue(n);
      if (w !== undefined)
        add({ group: 'invalid', label: `${name}: wrong type (${typeof w === 'number' ? 'integer' : 'string'} instead of ${t})`, expect: 'fail', expectedPath: path, keywords: ['type'], mutate: (p) => setAt(p, ptr, w) });
      if (!isNullable(n))
        add({ group: 'invalid', label: `${name}: null on non-nullable field`, expect: 'fail', expectedPath: path, keywords: ['type'], mutate: (p) => setAt(p, ptr, null) });
    }
    if (t === 'string') {
      if (typeof n.maxLength === 'number') {
        const s = genString(n, 'plus');
        add({ group: 'invalid', label: `${name}: length ${n.maxLength + 1} (maxLength + 1)`, expect: 'fail', expectedPath: path, keywords: ['maxLength', 'pattern', 'enum'], mutate: (p) => setAt(p, ptr, s.length === n.maxLength + 1 ? s : 'x'.repeat(n.maxLength + 1)) });
        add({ group: 'boundary', label: `${name}: exactly maxLength (${n.maxLength})`, expect: 'pass', mutate: (p) => setAt(p, ptr, genString(n, 'max')) });
      }
      if (typeof n.minLength === 'number' && n.minLength >= 1) {
        add({ group: 'invalid', label: `${name}: length ${n.minLength - 1} (minLength - 1)`, expect: 'fail', expectedPath: path, keywords: ['minLength', 'pattern', 'enum'], mutate: (p) => setAt(p, ptr, genString(n, 'minus').slice(0, n.minLength - 1)) });
        add({ group: 'boundary', label: `${name}: exactly minLength (${n.minLength})`, expect: 'pass', mutate: (p) => setAt(p, ptr, genString(n, 'min')) });
      }
      if (!(typeof n.minLength === 'number' && n.minLength - 1 === 0))
        add({ group: 'invalid', label: `${name}: empty string`, expect: 'fail', expectedPath: path, keywords: ['minLength', 'pattern', 'enum'], mutate: (p) => setAt(p, ptr, '') });
      if (typeof n.pattern === 'string') {
        const r = rx(n.pattern);
        const v = String(getAt(base, ptr) ?? 'a');
        const cands = [v + '#', '#' + v, '!!!', 'abc', 'ABC123', '123', ' ', '@@', 'a b', '9999-99-99', '_-_', v.slice(0, -1) + '!'];
        const bad = r ? cands.find((c) => !r.test(c) && (n.maxLength === undefined || c.length <= n.maxLength)) ?? cands.find((c) => !r.test(c)) : undefined;
        if (bad !== undefined)
          add({ group: 'invalid', label: `${name}: violates pattern ${n.pattern.length > 40 ? n.pattern.slice(0, 40) + '…' : n.pattern}`, expect: 'fail', expectedPath: path, keywords: ['pattern', 'maxLength', 'enum'], mutate: (p) => setAt(p, ptr, bad) });
      }
      if (Array.isArray(n.enum))
        add({ group: 'invalid', label: `${name}: value not in enum`, expect: 'fail', expectedPath: path, keywords: ['enum'], mutate: (p) => setAt(p, ptr, 'ZZ_INVALID') });
    }
    if (t === 'integer' || t === 'number') {
      const integer = t === 'integer';
      if (typeof n.maximum === 'number') {
        add({ group: 'invalid', label: `${name}: above maximum (${n.maximum}${n.exclusiveMaximum ? ', exclusive' : ''})`, expect: 'fail', expectedPath: path, keywords: ['maximum'], mutate: (p) => setAt(p, ptr, n.exclusiveMaximum ? n.maximum : n.maximum + (integer ? 1 : 0.01)) });
        if (!n.exclusiveMaximum) add({ group: 'boundary', label: `${name}: exactly maximum (${n.maximum})`, expect: 'pass', mutate: (p) => setAt(p, ptr, n.maximum) });
      }
      if (typeof n.minimum === 'number') {
        add({ group: 'invalid', label: `${name}: below minimum (${n.minimum}${n.exclusiveMinimum ? ', exclusive' : ''})`, expect: 'fail', expectedPath: path, keywords: ['minimum'], mutate: (p) => setAt(p, ptr, n.exclusiveMinimum ? n.minimum : n.minimum - (integer ? 1 : 0.01)) });
        if (!n.exclusiveMinimum) add({ group: 'boundary', label: `${name}: exactly minimum (${n.minimum})`, expect: 'pass', mutate: (p) => setAt(p, ptr, n.minimum) });
      }
      if (integer) add({ group: 'invalid', label: `${name}: decimal where integer expected`, expect: 'fail', expectedPath: path, keywords: ['type', 'multipleOf'], mutate: (p) => setAt(p, ptr, 1.5) });
      if (n.multipleOf) add({ group: 'invalid', label: `${name}: not a multiple of ${n.multipleOf}`, expect: 'fail', expectedPath: path, keywords: ['multipleOf'], mutate: (p) => setAt(p, ptr, n.multipleOf * 3 + n.multipleOf / 2 + (integer ? 0.5 : 0)) });
      if (Array.isArray(n.enum)) add({ group: 'invalid', label: `${name}: value not in enum`, expect: 'fail', expectedPath: path, keywords: ['enum'], mutate: (p) => setAt(p, ptr, 987654) });
    }
    if (t === 'array') {
      if (typeof n.minItems === 'number' && n.minItems >= 1)
        add({ group: 'invalid', label: `${name}: ${n.minItems - 1} item(s) (minItems - 1)`, expect: 'fail', expectedPath: path, keywords: ['minItems'], mutate: (p) => setAt(p, ptr, (getAt(p, ptr) as any[]).slice(0, n.minItems - 1)) });
      if (typeof n.maxItems === 'number')
        add({ group: 'invalid', label: `${name}: ${n.maxItems + 1} items (maxItems + 1)`, expect: 'fail', expectedPath: path, keywords: ['maxItems'], mutate: (p) => { const a = getAt(p, ptr) as any[]; const e = a[0] ?? 'x'; setAt(p, ptr, Array.from({ length: n.maxItems + 1 }, (_, i) => (typeof e === 'string' ? e + i : e))); } });
      if (n.uniqueItems)
        add({ group: 'invalid', label: `${name}: duplicate items`, expect: 'fail', expectedPath: path, keywords: ['uniqueItems'], mutate: (p) => { const a = getAt(p, ptr) as any[]; setAt(p, ptr, [a[0], a[0]]); } });
      if (n.items && typeof n.items === 'object' && !Array.isArray(n.items)) walk(n.items, [...ptr, 0], sp);
    }
    if (t === 'object') {
      const req: string[] = n.required ?? [];
      for (const k of req)
        add({ group: 'invalid', label: `${L([...ptr, k])}: required field missing`, expect: 'fail', expectedPath: toPointer([...ptr, k]), keywords: ['required'], mutate: (p) => delAt(p, [...ptr, k]) });
      const closed = n.additionalProperties === false;
      add({
        group: 'invalid', label: `${name}: unexpected extra property`, expect: 'fail', expectedPath: toPointer([...ptr, '__unexpected__']), keywords: ['additionalProperties'],
        note: closed ? undefined : 'additionalProperties is not false — the gateway will ACCEPT unknown fields.',
        mutate: (p) => setAt(p, [...ptr, '__unexpected__'], 'x'),
      });
      for (const [k, v] of Object.entries<any>(n.properties ?? {})) walk(v, [...ptr, k], [...sp, 'properties', k]);
    }
  };
  walk(schema, [], []);

  const seen = new Set<string>();
  const uniq = cases.filter((c) => {
    const k = c.label;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq.map((c) => runCase(schema, c));
}

export function runCase(schema: any, c: GenCase): GenCase {
  const result = validatePayload(schema, c.payload);
  let status: 'ok' | 'mismatch';
  let actual: string;
  if (c.expect === 'pass') {
    status = result.valid ? 'ok' : 'mismatch';
    actual = result.valid ? 'Valid' : 'Rejected: ' + result.issues.map((i) => `${i.path} ${i.keyword}`).join(', ');
  } else {
    const hit = result.issues.some((i) => i.path === c.expectedPath && (c.keywords ?? []).includes(i.keyword));
    status = hit ? 'ok' : 'mismatch';
    actual = result.valid ? 'ACCEPTED (schema did not reject it)' : (hit ? '' : 'Rejected, but not as expected: ') + result.issues.map((i) => `${i.path} ${i.keyword}`).join(', ');
    if (hit) actual = 'Rejected: ' + result.issues.filter((i) => i.path === c.expectedPath).map((i) => `${i.path} ${i.keyword}`).join(', ');
  }
  return { ...c, result, status, actual };
}
