export type FieldType = 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';
export const FIELD_TYPES: FieldType[] = ['string', 'integer', 'number', 'boolean', 'object', 'array'];

export interface Rules {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  /** objects only: undefined = not emitted, true = allow, false = forbid */
  additionalProperties?: boolean;
}

/** One node of the internal tree. The Draft-04 JSON is always derived from this. */
export interface Field {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  description: string;
  rules: Rules;
  /** object children */
  children: Field[];
  /** array item definition */
  items?: Field;
  /** unknown keywords preserved from imports (so the linter can still see them) */
  extra?: Record<string, any>;
  /** names listed in `required` that have no matching property (preserved from imports) */
  extraRequired?: string[];
  /** transient inference data */
  meta?: { n: number; nullOnly?: boolean; samples?: string[] };
}

export interface TestCase {
  id: string;
  name: string;
  payload: string;
  expect: 'pass' | 'fail';
}

export interface Project {
  id: string;
  name: string;
  title: string;
  root: Field;
  /** when non-null the schema could not be represented in the builder and is edited as raw JSON */
  raw: string | null;
  rawReason: string | null;
  payload: string;
  tests: TestCase[];
  versions: { at: number; schema: string }[];
  updatedAt: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export function newField(p: Partial<Field> = {}): Field {
  return {
    id: uid(),
    name: '',
    type: 'string',
    required: false,
    nullable: false,
    description: '',
    rules: {},
    children: [],
    ...p,
  };
}

export function newRoot(): Field {
  return newField({ type: 'object', name: '' });
}

export function newProject(name: string, p: Partial<Project> = {}): Project {
  return {
    id: uid(),
    name,
    title: name,
    root: newRoot(),
    raw: null,
    rawReason: null,
    payload: '{\n  \n}',
    tests: [],
    versions: [],
    updatedAt: Date.now(),
    ...p,
  };
}
