import { Field, Project } from './types';

export const DRAFT4 = 'http://json-schema.org/draft-04/schema#';

export function fieldToSchema(f: Field): any {
  const s: any = {};
  s.type = f.nullable ? [f.type, 'null'] : f.type;
  const r = f.rules;
  const put = (k: string, v: any) => {
    if (v !== undefined && v !== null && v !== '') s[k] = v;
  };
  put('pattern', r.pattern);
  put('minLength', r.minLength);
  put('maxLength', r.maxLength);
  put('format', r.format);
  if (r.enum && r.enum.length) s.enum = f.nullable && !r.enum.includes(null) ? [...r.enum, null] : r.enum;
  put('minimum', r.minimum);
  if (r.minimum !== undefined && r.exclusiveMinimum) s.exclusiveMinimum = true;
  put('maximum', r.maximum);
  if (r.maximum !== undefined && r.exclusiveMaximum) s.exclusiveMaximum = true;
  put('multipleOf', r.multipleOf);
  if (f.type === 'array') {
    if (f.items) s.items = fieldToSchema(f.items);
    put('minItems', r.minItems);
    put('maxItems', r.maxItems);
    if (r.uniqueItems) s.uniqueItems = true;
  }
  if (f.type === 'object') {
    const req = [...f.children.filter((c) => c.required).map((c) => c.name), ...(f.extraRequired ?? [])];
    if (req.length) s.required = req;
    s.properties = {};
    for (const c of f.children) s.properties[c.name] = fieldToSchema(c);
    if (r.additionalProperties !== undefined) s.additionalProperties = r.additionalProperties;
  }
  put('description', f.description);
  if (f.extra) Object.assign(s, f.extra);
  return s;
}

/** Whole-document schema for a project (raw text wins when the project is in raw mode). */
export function buildSchema(p: Project): { schema: any; error?: string } {
  if (p.raw !== null) {
    try {
      return { schema: JSON.parse(p.raw) };
    } catch (e: any) {
      return { schema: null, error: e.message };
    }
  }
  const body = fieldToSchema(p.root);
  const out: any = { $schema: DRAFT4 };
  if (p.title) out.title = p.title;
  Object.assign(out, body);
  return { schema: out };
}
