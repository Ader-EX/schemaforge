import { clone, getAt, Ptr, toPointer, delAt } from '../engine/jsonptr';

export type Severity = 'error' | 'warning' | 'info';
export interface LintIssue {
  id: string;
  severity: Severity;
  code: string;
  path: string;
  message: string;
  fix?: { label: string; apply: (schema: any) => void };
}

const DRAFT4 = 'http://json-schema.org/draft-04/schema#';
const types = (n: any): string[] => (Array.isArray(n.type) ? n.type : n.type ? [n.type] : []);
const has = (n: any, k: string) => Object.prototype.hasOwnProperty.call(n, k);
const nonNull = (n: any) => types(n).filter((t) => t !== 'null');

/** split a regex on top-level `|` */
export function splitTop(p: string): string[] {
  const out: string[] = [];
  let depth = 0, cls = false, cur = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '\\') { cur += c + (p[i + 1] ?? ''); i++; continue; }
    if (cls) { if (c === ']') cls = false; cur += c; continue; }
    if (c === '[') cls = true;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === '|' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
export const anchorPattern = (p: string) =>
  splitTop(p).map((a) => (a.startsWith('^') ? '' : '^') + a + (/(^|[^\\])\$$/.test(a) ? '' : '$')).join('|');

const QUOTES = `"'“”‘’`;
/** Try to extract allowed values from a human description. */
export function extractEnum(desc: string): string[] | null {
  const m = /(?:valid|expected|allowed|possible|accepted)\s+values?\s*(?:are|is)?\s*[:=-]?\s*([\s\S]+)/i.exec(desc);
  if (m) {
    const rest = m[1].split(/\.\s|\.$|,?\s*length\b|\(\s*(?:required|mandatory|optional)|\brefer\b|\bdefault/i)[0];
    let tokens = rest.split(/[,;|\n]/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 1 && tokens[0].includes('/') && !/\s/.test(tokens[0])) tokens = tokens[0].split('/');
    const vals: string[] = [];
    let ok = tokens.length > 0 && tokens.length <= 30;
    for (const t of tokens) {
      if (/^\*?\s*(blanks?|empty|space)\b/i.test(t)) { vals.push(''); continue; }
      const c = new RegExp(`^[${QUOTES}]?([^\\s${QUOTES}]+)[${QUOTES}]?\\s*[-–—=:]\\s*\\S`).exec(t);
      if (c) { vals.push(c[1]); continue; }
      const s = t.replace(new RegExp(`^[${QUOTES}]+|[${QUOTES}]+$`, 'g'), '');
      if (/^[^\s]{1,40}$/.test(s)) vals.push(s);
      else { ok = false; break; }
    }
    if (ok && vals.length) return [...new Set(vals)];
  }
  const pairs = [...desc.matchAll(new RegExp(`[${QUOTES}]([A-Za-z0-9]{1,10})[${QUOTES}]\\s*[–—-]\\s*[A-Za-z]`, 'g'))].map((x) => x[1]);
  if (pairs.length >= 2) return [...new Set(pairs)];
  const yn = /\b([YN])\s*\/\s*([YN])\b/.exec(desc);
  if (yn && yn[1] !== yn[2]) return [yn[1], yn[2]];
  return null;
}
const mentionsValues = (d: string) => /(?:valid|expected|allowed|possible|accepted)\s+values?/i.test(d) || /\b[YN]\s*\/\s*[YN]\b/.test(d);

const UNSUPPORTED: Record<string, { label: string; fix: (n: any) => void }> = {
  nullable: {
    label: 'Convert to "type": [..., "null"]',
    fix: (n) => {
      if (n.nullable === true) {
        const t = types(n);
        if (t.length) {
          n.type = [...t.filter((x) => x !== 'null'), 'null'];
          if (Array.isArray(n.enum) && !n.enum.includes(null)) n.enum.push(null);
        }
      }
      delete n.nullable;
    },
  },
  const: { label: 'Convert to "enum": [value]', fix: (n) => { n.enum = [n.const]; delete n.const; } },
  $id: { label: 'Rename to "id"', fix: (n) => { n.id = n.$id; delete n.$id; } },
  $defs: { label: 'Rename to "definitions"', fix: (n) => { n.definitions = n.$defs; delete n.$defs; } },
};
const REMOVE_ONLY = ['examples', 'if', 'then', 'else', 'contains', 'propertyNames', 'dependentRequired', 'dependentSchemas', 'unevaluatedProperties', 'unevaluatedItems', 'minContains', 'maxContains', '$anchor', 'deprecated', 'readOnly', 'writeOnly', '$comment', 'contentMediaType', 'contentEncoding', 'prefixItems', '$recursiveRef', '$dynamicRef'];

const GROUPS: { kws: string[]; allow: string[]; name: string }[] = [
  { kws: ['minLength', 'maxLength', 'pattern', 'format'], allow: ['string'], name: 'string' },
  { kws: ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'], allow: ['integer', 'number'], name: 'integer/number' },
  { kws: ['minItems', 'maxItems', 'uniqueItems', 'items'], allow: ['array'], name: 'array' },
  { kws: ['properties', 'required', 'additionalProperties', 'minProperties', 'maxProperties'], allow: ['object'], name: 'object' },
];

interface Ctx { parent?: any; parentPtr?: Ptr; name?: string; root: boolean }

export function lintSchema(schema: any): LintIssue[] {
  const out: LintIssue[] = [];
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return out;
  const add = (severity: Severity, code: string, ptr: Ptr, message: string, fix?: LintIssue['fix'], key = '') =>
    out.push({ id: `${code}|${toPointer(ptr)}|${key}`, severity, code, path: '#' + toPointer(ptr), message, fix });
  const nodeFix = (ptr: Ptr, label: string, fn: (n: any, root: any) => void) => ({
    label,
    apply: (s: any) => { const n = ptr.length ? getAt(s, ptr) : s; if (n) fn(n, s); },
  });

  if (schema.$schema === undefined)
    add('error', 'missing-$schema', [], 'Missing "$schema". The schema must declare Draft-04.', nodeFix([], 'Add Draft-04 $schema', (n) => { n.$schema = DRAFT4; }));
  else if (schema.$schema !== DRAFT4)
    add('error', 'wrong-$schema', [], `"$schema" is "${schema.$schema}" — must be "${DRAFT4}".`, nodeFix([], 'Set Draft-04 $schema', (n) => { n.$schema = DRAFT4; }));

  const visit = (n: any, ptr: Ptr, ctx: Ctx) => {
    if (typeof n !== 'object' || n === null || Array.isArray(n)) return;
    const label = ctx.name ? `"${ctx.name}"` : ctx.root ? 'root' : 'items';
    const t = types(n);
    const stringy = t.includes('string');
    const isReq = !!ctx.parent && Array.isArray(ctx.parent.required) && ctx.name !== undefined && ctx.parent.required.includes(ctx.name);
    const desc: string = typeof n.description === 'string' ? n.description : '';

    // ---- unsupported keywords
    for (const k of Object.keys(n)) {
      if (UNSUPPORTED[k]) {
        if (k === 'nullable' && n[k] !== true && n[k] !== false) continue;
        add('error', 'unsupported-keyword', ptr, `${label}: "${k}" is not supported in Draft-04.`, nodeFix(ptr, UNSUPPORTED[k].label, (x) => UNSUPPORTED[k].fix(x)), k);
      } else if (REMOVE_ONLY.includes(k))
        add('error', 'unsupported-keyword', ptr, `${label}: "${k}" is not supported in Draft-04 and is ignored/rejected by the gateway.`, nodeFix(ptr, `Remove "${k}"`, (x) => { delete x[k]; }), k);
    }
    for (const k of ['exclusiveMinimum', 'exclusiveMaximum'] as const) {
      if (typeof n[k] === 'number') {
        const base = k === 'exclusiveMinimum' ? 'minimum' : 'maximum';
        add('error', 'numeric-exclusive', ptr, `${label}: ${k} must be a boolean in Draft-04 (it modifies "${base}"), not a number.`,
          nodeFix(ptr, `Convert to "${base}": ${n[k]}, "${k}": true`, (x) => { x[base] = x[k]; x[k] = true; }), k);
      }
    }

    // ---- required vs properties
    if (Array.isArray(n.required)) {
      for (const r of n.required) {
        if (!n.properties || !has(n.properties, r))
          add('error', 'required-undefined', ptr, `${label}: "${r}" is listed in "required" but is not defined in "properties".`,
            nodeFix(ptr, `Remove "${r}" from required`, (x) => {
              x.required = x.required.filter((y: string) => y !== r);
              if (!x.required.length) delete x.required;
            }), r);
      }
    }

    // ---- pattern
    const pat = typeof n.pattern === 'string' ? n.pattern : undefined;
    let re: RegExp | null = null;
    if (pat !== undefined) {
      try { re = new RegExp(pat); } catch (e: any) {
        add('error', 'invalid-regex', ptr, `${label}: invalid regular expression ${pat} — ${e.message}`);
      }
      const nonEcma = [
        [/\(\?[imsxuU-]+\)|\(\?[imsxuU-]+:/, 'inline flags like (?i)'], [/\(\?>/, 'atomic groups (?>…)'],
        [/(^|[^\\])[*+?}]\+/, 'possessive quantifiers like ++'], [/\\[AZzhRGK]/, 'escapes like \\A \\Z \\z \\h'],
        [/\(\?P?[<'][A-Za-z]/, 'Python/PCRE-style named groups'], [/\[\[?:[a-z]+:\]\]?/, 'POSIX classes like [[:alpha:]]'],
      ] as const;
      for (const [r, what] of nonEcma)
        if (r.test(pat)) add('error', 'non-ecma-regex', ptr, `${label}: pattern uses ${what}, which is not valid ECMA-262.`, undefined, what);
      if (/\(\?<[=!]/.test(pat)) add('warning', 'non-ecma-regex', ptr, `${label}: lookbehind (?<=…) is only ES2018+ and may not be supported by the gateway's regex engine.`, undefined, 'lookbehind');
      if (re) {
        const alts = splitTop(pat);
        if (!alts.every((a) => a.startsWith('^') && /(^|[^\\])\$$/.test(a)))
          add('warning', 'unanchored-pattern', ptr, `${label}: pattern is not anchored with ^ and $ — it will match substrings.`,
            nodeFix(ptr, 'Anchor with ^ … $', (x) => { x.pattern = anchorPattern(x.pattern); }));
        if (/(\\d|\[0-9\])\{4\}-\(?(0\[1-9\]|\[01\])/.test(pat))
          add('warning', 'date-pattern', ptr, `${label}: a date regex cannot reject impossible calendar dates such as 2026-02-31 — validate in the backend.`);
        if (types(n).includes('null'))
          add('info', 'nullable-pattern', ptr, `${label}: field is nullable and has a pattern. Patterns apply to strings only, so null always passes.`);
        // pattern vs lengths
        const alt = pat.startsWith('^$|') ? pat.slice(3) : pat;
        const blank = alt !== pat;
        const body = '(?:\\[[^\\]]*\\]|\\\\[dwsDWS]|\\.)';
        const q = new RegExp(`^\\^?${body}\\{(\\d+)(?:,(\\d*))?\\}\\$?$`).exec(alt);
        const plus = new RegExp(`^\\^?${body}\\+\\$?$`).exec(alt);
        let lo: number | undefined, hi: number | undefined, isPlus = false;
        if (q) { lo = +q[1]; hi = q[2] === undefined ? lo : q[2] === '' ? undefined : +q[2]; }
        else if (plus) { lo = 1; isPlus = true; }
        if (lo !== undefined) {
          if (hi !== undefined && typeof n.maxLength === 'number') {
            if (n.maxLength === hi)
              add('warning', 'pattern-length', ptr, `${label}: maxLength ${hi} duplicates the pattern's upper bound {…,${hi}} — one of them is redundant.`, nodeFix(ptr, 'Remove redundant maxLength', (x) => { delete x.maxLength; }), 'max');
            else
              add('warning', 'pattern-length', ptr, `${label}: maxLength ${n.maxLength} conflicts with the pattern's upper bound ${hi}; the stricter one wins (${Math.min(n.maxLength, hi)}).`, nodeFix(ptr, `Set maxLength to ${hi}`, (x) => { x.maxLength = hi; }), 'max');
          }
          if (!blank && typeof n.minLength === 'number') {
            if (n.minLength === lo)
              add(isPlus ? 'info' : 'warning', 'pattern-length', ptr, `${label}: minLength ${lo} duplicates the pattern's minimum — one of them is redundant.`, nodeFix(ptr, 'Remove redundant minLength', (x) => { delete x.minLength; }), 'min');
            else
              add('warning', 'pattern-length', ptr, `${label}: minLength ${n.minLength} conflicts with the pattern's minimum ${lo}; the stricter one wins (${Math.max(n.minLength, lo)}).`, nodeFix(ptr, `Set minLength to ${lo}`, (x) => { x.minLength = lo; }), 'min');
          }
        }
      }
    }

    // ---- ranges
    const range = (a: string, b: string, strict = false) => {
      if (typeof n[a] === 'number' && typeof n[b] === 'number' && (strict ? n[a] >= n[b] : n[a] > n[b]))
        add('error', 'range-conflict', ptr, `${label}: ${a} (${n[a]}) is greater than ${b} (${n[b]}) — nothing can pass.`,
          nodeFix(ptr, `Swap ${a} and ${b}`, (x) => { [x[a], x[b]] = [x[b], x[a]]; }), a);
    };
    range('minLength', 'maxLength'); range('minItems', 'maxItems'); range('minProperties', 'maxProperties');
    if (typeof n.minimum === 'number' && typeof n.maximum === 'number') {
      const strict = n.exclusiveMinimum === true || n.exclusiveMaximum === true;
      if (n.minimum > n.maximum || (strict && n.minimum === n.maximum))
        add('error', 'range-conflict', ptr, `${label}: minimum (${n.minimum}) and maximum (${n.maximum}) leave no valid value.`,
          nodeFix(ptr, 'Swap minimum and maximum', (x) => { [x.minimum, x.maximum] = [x.maximum, x.minimum]; }), 'minimum');
    }
    for (const k of ['minLength', 'maxLength', 'minItems', 'maxItems'])
      if (typeof n[k] === 'number' && n[k] < 0) add('error', 'range-conflict', ptr, `${label}: ${k} must not be negative.`, nodeFix(ptr, `Set ${k} to 0`, (x) => { x[k] = 0; }), k);

    // ---- description heuristics
    if (desc) {
      const hasEnum = Array.isArray(n.enum);
      if (!hasEnum && mentionsValues(desc) || (!hasEnum && extractEnum(desc))) {
        const vals = extractEnum(desc);
        add('warning', 'desc-enum', ptr, `${label}: description lists allowed values${vals ? ` (${vals.map((v) => (v === '' ? '""' : v)).join(', ')})` : ''} but the schema has no "enum".`,
          vals ? nodeFix(ptr, `Extract enum [${vals.map((v) => JSON.stringify(v)).join(', ')}]`, (x) => {
            x.enum = [...vals];
            if (types(x).includes('null')) x.enum.push(null);
          }) : undefined);
      }
      if (ctx.parent && ctx.name !== undefined) {
        const notReq = /\bnot\s+required\b|\(\s*optional\s*\)|\boptional\b/i.test(desc);
        const sayReq = !notReq && (/\(\s*required\s*\)/i.test(desc) || /\brequired\b(?!\s+(if|when|for|only))/i.test(desc) || /\bmandatory\b(?!\s+(if|when|for|only))/i.test(desc));
        const pp = ctx.parentPtr!;
        if (sayReq && !isReq)
          add('warning', 'desc-required', ptr, `${label}: description says Required/Mandatory but the field is not in the parent's "required" array.`,
            nodeFix(pp, 'Add to required', (x) => { x.required = [...(x.required ?? []), ctx.name]; }));
        if (notReq && isReq)
          add('warning', 'desc-required', ptr, `${label}: description says Optional but the field is in the parent's "required" array.`,
            nodeFix(pp, 'Remove from required', (x) => { x.required = x.required.filter((y: string) => y !== ctx.name); if (!x.required.length) delete x.required; }));
      }
      const lm = /\blength\s*[:=]?\s*(\d+)(?:\s*[-–]\s*(\d+))?/i.exec(desc);
      if (lm && stringy) {
        const mn = lm[2] ? +lm[1] : undefined;
        const mx = lm[2] ? +lm[2] : +lm[1];
        if (n.maxLength !== mx || (mn !== undefined && (n.minLength ?? 0) !== mn && !(mn === 0 && n.minLength === undefined)))
          add('warning', 'desc-length', ptr, `${label}: description says length ${lm[2] ? `${mn}-${mx}` : mx} but the schema has ${n.maxLength === undefined ? 'no maxLength' : `maxLength ${n.maxLength}`}${mn !== undefined ? ` / minLength ${n.minLength ?? 'unset'}` : ''}.`,
            nodeFix(ptr, `Set maxLength ${mx}${mn !== undefined ? `, minLength ${mn}` : ''}`, (x) => { x.maxLength = mx; if (mn !== undefined) x.minLength = mn; }));
      }
      if (/numeric|digits?\s+only|numbers?\s+only/i.test(desc)) {
        if (stringy && !pat && !hasEnum)
          add('warning', 'numeric-string', ptr, `${label}: looks numeric but is an unrestricted string. Add a digit pattern (numeric-string preset) — or switch to integer, which would reject the string "12".`,
            nodeFix(ptr, 'Add pattern ^[0-9]+$', (x) => { x.pattern = '^[0-9]+$'; }));
        else if (t.includes('integer') || t.includes('number'))
          add('warning', 'numeric-string', ptr, `${label}: described as numeric but typed ${nonNull(n).join('/')}. Remember: integer type rejects the string "12" — clients must send a JSON number (and long ids lose precision above 2^53).`);
      }
    }

    // ---- keywords on wrong types
    const nn = nonNull(n);
    if (nn.length)
      for (const g of GROUPS) {
        if (nn.some((x) => g.allow.includes(x))) continue;
        for (const k of g.kws) if (has(n, k))
          add('warning', 'ignored-keyword', ptr, `${label}: "${k}" is a ${g.name} keyword but type is ${nn.join('/')} — it is silently ignored.`, nodeFix(ptr, `Remove "${k}"`, (x) => { delete x[k]; }), k);
      }

    // ---- empty string for required field
    if (isReq && stringy && !(typeof n.minLength === 'number' && n.minLength >= 1) && !Array.isArray(n.enum) && !(pat && pat.startsWith('^$|'))) {
      let blankOk = true;
      if (re) blankOk = re.test('');
      if (blankOk)
        add('warning', 'empty-required', ptr, `${label}: required, but "" (empty string) would pass because minLength is missing.`, nodeFix(ptr, 'Set minLength 1', (x) => { x.minLength = 1; }));
    }

    // ---- objects
    if (t.includes('object') || n.properties) {
      if (!has(n, 'additionalProperties'))
        add(ctx.root ? 'warning' : 'info', 'no-additionalProperties', ptr, `${label}: no "additionalProperties" set — unknown fields are currently accepted.`,
          nodeFix(ptr, 'Forbid unknown fields', (x) => { x.additionalProperties = false; }));
      if (n.properties && Object.keys(n.properties).length && !Array.isArray(n.required))
        add('info', 'no-required', ptr, `${label}: object has no "required" array — every property is optional.`);
    }

    // ---- recurse
    if (n.properties && typeof n.properties === 'object')
      for (const [k, v] of Object.entries(n.properties)) visit(v, [...ptr, 'properties', k], { parent: n, parentPtr: ptr, name: k, root: false });
    if (n.items) {
      if (Array.isArray(n.items)) n.items.forEach((v: any, i: number) => visit(v, [...ptr, 'items', i], { root: false }));
      else visit(n.items, [...ptr, 'items'], { root: false });
    }
    if (n.additionalProperties && typeof n.additionalProperties === 'object') visit(n.additionalProperties, [...ptr, 'additionalProperties'], { root: false });
    for (const k of ['allOf', 'anyOf', 'oneOf'])
      if (Array.isArray(n[k])) n[k].forEach((v: any, i: number) => visit(v, [...ptr, k, i], { root: false }));
    if (n.not) visit(n.not, [...ptr, 'not'], { root: false });
    for (const k of ['definitions', '$defs'])
      if (n[k] && typeof n[k] === 'object') for (const [dk, v] of Object.entries(n[k])) visit(v, [...ptr, k, dk], { root: false });
  };
  visit(schema, [], { root: true });
  return out;
}

export function summarize(issues: LintIssue[]) {
  const c = (s: Severity) => issues.filter((i) => i.severity === s).length;
  return { errors: c('error'), warnings: c('warning'), infos: c('info') };
}

export function applyLintFix(schema: any, issue: LintIssue): any {
  const s = clone(schema);
  issue.fix?.apply(s);
  return s;
}
export { delAt };
