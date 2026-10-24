import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';

export interface Issue {
  path: string; // JSON pointer of the failing value, e.g. /accountInfo/accountNo
  pointer: string; // pointer to highlight in the payload (parent for "required")
  keyword: string;
  explain: string;
  hint?: string;
  value?: unknown;
}
export interface ValidationResult {
  valid: boolean;
  issues: Issue[];
  missing: { parent: string; property: string }[];
  compileError?: string;
}

const cache = new Map<string, { validate?: any; error?: string }>();

export function compile(schema: any): { validate?: any; error?: string } {
  const key = JSON.stringify(schema);
  const hit = cache.get(key);
  if (hit) return hit;
  let res: { validate?: any; error?: string };
  try {
    const ajv = new (Ajv as any)({ allErrors: true, strict: false, unicodeRegExp: false });
    (addFormats as any)(ajv);
    res = { validate: ajv.compile(schema) };
  } catch (e: any) {
    res = { error: String(e.message ?? e) };
  }
  if (cache.size > 50) cache.clear();
  cache.set(key, res);
  return res;
}

const typeOf = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v === 'number' ? 'number' : typeof v);
const show = (v: unknown) => (typeof v === 'string' ? `'${v.length > 60 ? v.slice(0, 57) + '…' : v}'` : JSON.stringify(v)?.slice(0, 60));

export function getPointer(data: any, ptr: string): unknown {
  if (!ptr) return data;
  let cur = data;
  for (const raw of ptr.split('/').slice(1)) {
    if (cur == null) return undefined;
    cur = cur[raw.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return cur;
}

function explainError(e: any, data: any): Issue {
  const value = getPointer(data, e.instancePath);
  const p = e.params ?? {};
  let path = e.instancePath || '';
  let pointer = path;
  let explain: string = e.message ?? 'is invalid';
  let hint: string | undefined;
  const got = show(value);
  switch (e.keyword) {
    case 'type': {
      const want = Array.isArray(p.type) ? p.type.join(' | ') : String(p.type);
      explain = `must be ${want}, got ${typeOf(value)} ${got}`;
      const t = typeOf(value);
      if (want.includes('string') && (t === 'integer' || t === 'number' || t === 'boolean'))
        hint = `Expected string but got ${t}: wrap the value in quotes ("${String(value)}").`;
      else if ((want === 'integer' || want === 'number') && t === 'string')
        hint = `Expected ${want} but got string: remove the quotes. (If this field must stay a string, use the numeric-string preset instead of ${want}.)`;
      else if (want === 'integer' && t === 'number') hint = 'Value must be a whole number without decimals.';
      else if (t === 'null') hint = `The field is not nullable. Send a value, or mark it nullable ("type": ["${want.split(' | ')[0]}", "null"]).`;
      else if (want === 'object' && t === 'array') hint = 'Send a single object, not an array.';
      else if (want === 'array' && t !== 'array') hint = 'Wrap the value in [ ].';
      break;
    }
    case 'pattern':
      explain = `must match pattern ${p.pattern}, got ${got}`;
      hint = 'Check the allowed characters/format for this field (see the preset or description).';
      break;
    case 'minLength':
      explain = `must have at least ${p.limit} character(s), got ${(value as string)?.length} (${got})`;
      if (value === '') hint = 'Empty string is not allowed. Omit the field or send a value.';
      break;
    case 'maxLength':
      explain = `must have at most ${p.limit} character(s), got ${(value as string)?.length}`;
      hint = `Shorten the value to ${p.limit} characters or fewer.`;
      break;
    case 'enum':
      explain = `must be one of: ${(p.allowedValues as any[]).map((v) => JSON.stringify(v)).join(', ')} — got ${got}`;
      hint = 'Values are case-sensitive.';
      break;
    case 'required':
      path = `${path}/${p.missingProperty}`;
      explain = `missing required property '${p.missingProperty}'`;
      hint = `Add "${p.missingProperty}" to the object.`;
      break;
    case 'additionalProperties':
      path = `${path}/${p.additionalProperty}`;
      pointer = path;
      explain = `unexpected property '${p.additionalProperty}' (additionalProperties is false)`;
      hint = 'Remove the property or allow additional properties in the schema.';
      break;
    case 'minimum':
    case 'maximum':
      explain = `must be ${p.comparison} ${p.limit}, got ${got}`;
      break;
    case 'multipleOf':
      explain = `must be a multiple of ${p.multipleOf}, got ${got}`;
      break;
    case 'minItems':
    case 'maxItems':
      explain = `array must have ${e.keyword === 'minItems' ? 'at least' : 'at most'} ${p.limit} item(s), got ${(value as any[])?.length}`;
      break;
    case 'uniqueItems':
      explain = `items at index ${p.j} and ${p.i} are identical (items must be unique)`;
      break;
    case 'format':
      explain = `must match format "${p.format}", got ${got}`;
      break;
    default:
      explain = `${e.message}${value !== undefined ? ` (got ${got})` : ''}`;
  }
  return { path: path || '/', pointer, keyword: e.keyword, explain, hint, value };
}

export function validatePayload(schema: any, data: any): ValidationResult {
  const c = compile(schema);
  if (!c.validate) return { valid: false, issues: [], missing: [], compileError: c.error };
  const ok = c.validate(data) as boolean;
  const errs: any[] = ok ? [] : c.validate.errors ?? [];
  const issues = errs.map((e) => explainError(e, data));
  const missing = errs.filter((e) => e.keyword === 'required').map((e) => ({ parent: e.instancePath || '/', property: e.params.missingProperty }));
  return { valid: ok, issues, missing };
}

/** locate JSON pointers in raw text → [start,end] offsets */
export function locatePointers(text: string): Map<string, [number, number]> | null {
  const map = new Map<string, [number, number]>();
  let i = 0;
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const str = (): string => {
    const start = i;
    i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    i++;
    return JSON.parse(text.slice(start, i));
  };
  const val = (ptr: string): void => {
    ws();
    const start = i;
    const c = text[i];
    if (c === '{') {
      i++;
      ws();
      while (text[i] !== '}') {
        ws();
        if (text[i] !== '"') throw new Error('bad');
        const ks = i;
        const k = str();
        ws();
        if (text[i] !== ':') throw new Error('bad');
        i++;
        const childPtr = `${ptr}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`;
        val(childPtr);
        const r = map.get(childPtr)!;
        map.set(childPtr, [ks, r[1]]);
        ws();
        if (text[i] === ',') i++;
        else if (text[i] !== '}') throw new Error('bad');
        ws();
      }
      i++;
    } else if (c === '[') {
      i++;
      ws();
      let n = 0;
      while (text[i] !== ']') {
        val(`${ptr}/${n++}`);
        ws();
        if (text[i] === ',') i++;
        else if (text[i] !== ']') throw new Error('bad');
        ws();
      }
      i++;
    } else if (c === '"') str();
    else {
      const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
      if (!m) throw new Error('bad');
      i += m[0].length;
    }
    map.set(ptr, [start, i]);
  };
  try {
    val('');
    return map;
  } catch {
    return null;
  }
}
