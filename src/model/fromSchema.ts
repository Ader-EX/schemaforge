import { Field, FieldType, FIELD_TYPES, newField, newRoot, Rules } from './types';

export class Unsupported extends Error {}

const UNSUPPORTED = ['$ref', 'oneOf', 'anyOf', 'allOf', 'not', 'patternProperties', 'dependencies', 'definitions', '$defs'];
const CONSUMED = new Set(['type', 'properties', 'required', 'items', 'description']);
const RULE_CHECK: Record<string, (v: any) => boolean> = {
  minLength: (v) => typeof v === 'number',
  maxLength: (v) => typeof v === 'number',
  pattern: (v) => typeof v === 'string',
  format: (v) => typeof v === 'string',
  enum: (v) => Array.isArray(v),
  minimum: (v) => typeof v === 'number',
  maximum: (v) => typeof v === 'number',
  exclusiveMinimum: (v) => typeof v === 'boolean',
  exclusiveMaximum: (v) => typeof v === 'boolean',
  multipleOf: (v) => typeof v === 'number',
  minItems: (v) => typeof v === 'number',
  maxItems: (v) => typeof v === 'number',
  uniqueItems: (v) => typeof v === 'boolean',
  additionalProperties: (v) => typeof v === 'boolean',
};

function conv(s: any, name: string, required: boolean, path: string): Field {
  if (typeof s !== 'object' || s === null || Array.isArray(s)) throw new Unsupported(`${path} is not an object schema`);
  for (const k of UNSUPPORTED) if (k in s) throw new Unsupported(`"${k}" is used at ${path} and cannot be shown in the visual builder`);
  let types: string[] = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  const nullable = types.includes('null');
  types = types.filter((t) => t !== 'null');
  let type: FieldType;
  if (types.length > 1) throw new Unsupported(`multiple types ${JSON.stringify(s.type)} at ${path}`);
  if (types.length === 1) type = types[0] as FieldType;
  else if (s.properties) type = 'object';
  else if (s.items) type = 'array';
  else if (Array.isArray(s.enum) && s.enum.some((v: any) => v !== null)) {
    const v = s.enum.find((x: any) => x !== null);
    type = typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v === 'boolean' ? 'boolean' : 'string';
  } else throw new Unsupported(`no "type" at ${path}`);
  if (!FIELD_TYPES.includes(type)) throw new Unsupported(`type "${type}" at ${path}`);

  const rules: Rules = {};
  const extra: Record<string, any> = {};
  for (const [k, v] of Object.entries(s)) {
    if (CONSUMED.has(k)) continue;
    if (k in RULE_CHECK) {
      if (RULE_CHECK[k](v)) (rules as any)[k] = v;
      else if (k === 'additionalProperties') throw new Unsupported(`additionalProperties schema at ${path}`);
      else extra[k] = v;
    } else extra[k] = v;
  }
  if (rules.enum && nullable) rules.enum = rules.enum.filter((v) => v !== null);
  const f = newField({ name, type, required, nullable, rules });
  if (typeof s.description === 'string') f.description = s.description;
  else if ('description' in s) extra.description = s.description;

  if (type === 'object') {
    const props = s.properties && typeof s.properties === 'object' ? s.properties : {};
    const req: string[] = Array.isArray(s.required) ? s.required.filter((x: any) => typeof x === 'string') : [];
    if ('required' in s && !Array.isArray(s.required)) extra.required = s.required;
    for (const [k, v] of Object.entries(props)) f.children.push(conv(v, k, req.includes(k), `${path}/properties/${k}`));
    const missing = req.filter((r) => !(r in props));
    if (missing.length) f.extraRequired = missing;
  } else {
    if ('properties' in s) extra.properties = s.properties;
    if ('required' in s) extra.required = s.required;
  }
  if (type === 'array' && s.items !== undefined) {
    if (Array.isArray(s.items)) throw new Unsupported(`tuple-style "items" array at ${path}`);
    f.items = conv(s.items, '', false, `${path}/items`);
  } else if (type !== 'array' && 'items' in s) extra.items = s.items;
  if (Object.keys(extra).length) f.extra = extra;
  return f;
}

/** Convert a Draft-04 JSON object into the tree. Throws Unsupported when it cannot be represented. */
export function fromSchema(schema: any): { root: Field; title: string } {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) throw new Unsupported('schema must be a JSON object');
  const { $schema: _s, title, ...rest } = schema;
  if (!rest.type && !rest.properties) rest.type = 'object';
  const root = conv(rest, '', false, '#');
  if (root.type !== 'object') throw new Unsupported('root type is not "object"');
  return { root: root ?? newRoot(), title: typeof title === 'string' ? title : '' };
}
