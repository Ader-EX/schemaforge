import { Field, newField, Rules } from './types';

export interface PresetParam {
  key: string;
  label: string;
  kind: 'number' | 'bool' | 'text';
  default: any;
}
export type FieldPatch = Partial<Omit<Field, 'id' | 'name'>>;
export interface Preset {
  id: string;
  name: string;
  group: string;
  description: string;
  /** suggested field name when added as a new field */
  fieldName: string;
  params: PresetParam[];
  build: (p: Record<string, any>) => FieldPatch;
  valid: any[];
  invalid: any[];
  warning?: string;
  builtin: boolean;
}

export const PATTERNS = {
  date: '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$',
  datetime:
    '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$',
  time: '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
  amount: '^[0-9]+(\\.[0-9]{1,2})?$',
  email: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$',
  uuid: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  url: '^https?://[^\\s/$.?#][^\\s]*$',
  ipv4: '^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$',
};
export const numericPattern = (n?: number) => (n && n > 0 ? `^[0-9]{1,${n}}$` : '^[0-9]+$');
const withBlank = (p: string, blank: boolean) => (blank ? `^$|${p}` : p);
const maxP: PresetParam = { key: 'maxLength', label: 'Max length', kind: 'number', default: 100 };
const blankP = (d = false): PresetParam => ({ key: 'allowBlank', label: 'Allow empty string', kind: 'bool', default: d });
const nullP: PresetParam = { key: 'nullable', label: 'Nullable', kind: 'bool', default: false };

function P(x: Omit<Preset, 'builtin' | 'params' | 'warning'> & { params?: PresetParam[]; warning?: string }): Preset {
  return { params: [], builtin: true, ...x };
}

const strRules = (r: Rules): FieldPatch => ({ type: 'string', rules: r });

export const BUILTIN_PRESETS: Preset[] = [
  P({
    id: 'alnum', name: 'Alphanumeric only', group: 'Text', fieldName: 'code', description: 'Letters and digits only, no spaces or symbols.',
    params: [maxP, nullP], valid: ['ABC123', 'a1'], invalid: ['ABC 123', 'abc-1', ''],
    build: (p) => ({ ...strRules({ pattern: '^[A-Za-z0-9]+$', minLength: 1, ...(p.maxLength ? { maxLength: +p.maxLength } : {}) }), nullable: !!p.nullable }),
  }),
  P({
    id: 'numeric', name: 'Numeric string only', group: 'Text', fieldName: 'numericValue', description: 'Digits only, carried as a STRING (the integer type would reject "123"). Max length configurable.',
    params: [{ key: 'maxLength', label: 'Max length (N)', kind: 'number', default: 20 }, nullP], valid: ['0', '1234567890'], invalid: ['12a', '-1', '1.5', ''],
    build: (p) => ({ ...strRules({ pattern: numericPattern(+p.maxLength), minLength: 1, ...(p.maxLength ? { maxLength: +p.maxLength } : {}) }), nullable: !!p.nullable }),
  }),
  P({
    id: 'alpha', name: 'Alphabetic only', group: 'Text', fieldName: 'name', description: 'Letters A–Z / a–z only.',
    params: [maxP, nullP], valid: ['Abc'], invalid: ['Abc1', 'A b', ''],
    build: (p) => ({ ...strRules({ pattern: '^[A-Za-z]+$', minLength: 1, ...(p.maxLength ? { maxLength: +p.maxLength } : {}) }), nullable: !!p.nullable }),
  }),
  P({
    id: 'alnumSpace', name: 'Alphanumeric with spaces / hyphens / underscores', group: 'Text', fieldName: 'label', description: 'Letters, digits, space, hyphen and underscore.',
    params: [maxP, nullP], valid: ['Ab 12-x_y'], invalid: ['a@b', 'a.b', ''],
    build: (p) => ({ ...strRules({ pattern: '^[A-Za-z0-9 _-]+$', minLength: 1, ...(p.maxLength ? { maxLength: +p.maxLength } : {}) }), nullable: !!p.nullable }),
  }),
  P({
    id: 'date', name: 'Date YYYY-MM-DD', group: 'Date & time', fieldName: 'date', description: 'Calendar date, ISO format. Optionally accepts an empty string.',
    params: [blankP(true)], valid: ['2026-01-31', '1999-12-01'], invalid: ['2026-13-01', '26-1-1', '2026/01/01', 'abc'],
    warning: 'A regex cannot reject impossible dates such as 2026-02-31 — validate the calendar date in the backend.',
    build: (p) => ({ ...strRules({ pattern: withBlank(PATTERNS.date, !!p.allowBlank), maxLength: 10 }), description: 'Date. Format YYYY-MM-DD' }),
  }),
  P({
    id: 'datetime', name: 'Datetime ISO 8601', group: 'Date & time', fieldName: 'timestamp', description: 'e.g. 2026-01-31T10:20:30Z or 2026-01-31T10:20:30.123+07:00.',
    params: [blankP(false)], valid: ['2026-01-31T10:20:30Z', '2026-01-31T10:20:30.123+07:00'], invalid: ['2026-01-31 10:20:30', '2026-01-31T25:00:00Z', 'abc'],
    warning: 'A regex cannot reject impossible dates such as 2026-02-31T00:00:00Z.',
    build: (p) => ({ ...strRules({ pattern: withBlank(PATTERNS.datetime, !!p.allowBlank) }), description: 'Datetime, ISO 8601' }),
  }),
  P({
    id: 'time', name: 'Time HH:mm:ss', group: 'Date & time', fieldName: 'time', description: '24-hour time with seconds.',
    params: [blankP(false)], valid: ['00:00:00', '23:59:59'], invalid: ['24:00:00', '1:2:3', '12:60:00'],
    build: (p) => ({ ...strRules({ pattern: withBlank(PATTERNS.time, !!p.allowBlank), maxLength: 8 }), description: 'Time. Format HH:mm:ss' }),
  }),
  P({
    id: 'flag', name: 'Y/N flag', group: 'Codes', fieldName: 'flag', description: 'enum ["Y","N"], optionally allowing blank.',
    params: [blankP(false), nullP], valid: ['Y', 'N'], invalid: ['y', 'X', 'Yes'],
    build: (p) => ({ ...strRules({ enum: p.allowBlank ? ['Y', 'N', ''] : ['Y', 'N'], maxLength: 1 }), nullable: !!p.nullable, description: 'Flag. Y - Yes, N - No' }),
  }),
  P({
    id: 'codeEnum', name: 'Blank-or-single-character code', group: 'Codes', fieldName: 'code', description: 'Configurable list of allowed codes (e.g. A, or C/D), with blank optionally allowed.',
    params: [{ key: 'values', label: 'Allowed values (comma separated)', kind: 'text', default: 'C,D' }, blankP(true), nullP], valid: ['C', 'D', ''], invalid: ['X', 'CD'],
    build: (p) => {
      const vals = String(p.values ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return { ...strRules({ enum: p.allowBlank ? [...vals, ''] : vals, maxLength: Math.max(1, ...vals.map((v) => v.length)) }), nullable: !!p.nullable };
    },
  }),
  P({
    id: 'bankId', name: 'Bank ID (integer 0-99)', group: 'Banking', fieldName: 'bankId', description: 'Integer between 0 and 99.',
    valid: [0, 14, 99], invalid: [100, -1, '12', 1.5],
    build: () => ({ type: 'integer', rules: { minimum: 0, maximum: 99 }, description: 'Bank number, length: 2' }),
  }),
  P({
    id: 'branchId', name: 'Branch ID (numeric string, ≤5 digits)', group: 'Banking', fieldName: 'branchId', description: 'Digits as string, 1–5 characters.',
    valid: ['1', '00123'], invalid: ['123456', 'AB', ''],
    build: () => ({ ...strRules({ pattern: numericPattern(5), minLength: 1, maxLength: 5 }), description: '(Numeric Only) Branch number, length: 5' }),
  }),
  P({
    id: 'accountNo', name: 'Account number (numeric string, ≤19 digits)', group: 'Banking', fieldName: 'accountNo', description: 'Digits as string, 1–19 characters.',
    valid: ['1234567890', '1234567890123456789'], invalid: ['12345678901234567890', '12-34', ''],
    build: () => ({ ...strRules({ pattern: numericPattern(19), minLength: 1, maxLength: 19 }), description: '(Numeric Only) Account Number, length: 19' }),
  }),
  P({
    id: 'amount', name: 'Amount (decimal string, ≤2 places)', group: 'Banking', fieldName: 'amount', description: 'Non-negative decimal carried as a string, up to 2 decimal places.',
    params: [{ key: 'maxLength', label: 'Max length', kind: 'number', default: 20 }], valid: ['100', '100.5', '100.50', '0.01'], invalid: ['100.555', '-1', 'abc', '1,000.00', '.5'],
    build: (p) => ({ ...strRules({ pattern: PATTERNS.amount, minLength: 1, ...(p.maxLength ? { maxLength: +p.maxLength } : {}) }), description: 'Amount, up to 2 decimal places' }),
  }),
  P({
    id: 'email', name: 'Email', group: 'Contact & network', fieldName: 'email', description: 'Pragmatic email pattern (no format keyword, so behaviour is identical on every validator).',
    params: [{ key: 'maxLength', label: 'Max length', kind: 'number', default: 254 }, nullP], valid: ['a.b@cimb.com'], invalid: ['a@b', 'a b@c.com', '@c.com'],
    build: (p) => ({ ...strRules({ pattern: PATTERNS.email, ...(p.maxLength ? { maxLength: +p.maxLength } : {}) }), nullable: !!p.nullable }),
  }),
  P({
    id: 'phone', name: 'Phone number (numeric, max 30)', group: 'Contact & network', fieldName: 'phoneNumber', description: 'Digits only as string.',
    params: [{ key: 'maxLength', label: 'Max length', kind: 'number', default: 30 }, { ...nullP, default: true }], valid: ['081234567890'], invalid: ['+62812', '08 12', ''],
    build: (p) => ({ ...strRules({ pattern: '^[0-9]+$', minLength: 1, ...(p.maxLength ? { maxLength: +p.maxLength } : {}) }), nullable: !!p.nullable, description: 'Phone number, numeric only' }),
  }),
  P({
    id: 'uuid', name: 'UUID', group: 'Contact & network', fieldName: 'uuid', description: 'Canonical 8-4-4-4-12 hexadecimal UUID.',
    valid: ['123e4567-e89b-12d3-a456-426614174000'], invalid: ['123e4567e89b12d3a456426614174000', 'not-a-uuid'],
    build: () => strRules({ pattern: PATTERNS.uuid, minLength: 36, maxLength: 36 }),
  }),
  P({
    id: 'url', name: 'URL (http/https)', group: 'Contact & network', fieldName: 'url', description: 'http:// or https:// URL without whitespace.',
    valid: ['https://cimb.com/a?b=1'], invalid: ['ftp://x.com', 'cimb.com', 'http://a b'],
    build: () => strRules({ pattern: PATTERNS.url }),
  }),
  P({
    id: 'ipv4', name: 'IPv4', group: 'Contact & network', fieldName: 'ipAddress', description: 'Dotted-quad IPv4 address.',
    valid: ['10.0.0.1', '255.255.255.255'], invalid: ['256.1.1.1', '1.2.3', '1.2.3.4.5'],
    build: () => strRules({ pattern: PATTERNS.ipv4 }),
  }),
  P({
    id: 'freeText', name: 'Free text with max length', group: 'Text', fieldName: 'additionalData', description: 'Any string up to N characters.',
    params: [{ key: 'maxLength', label: 'Max length', kind: 'number', default: 4000 }], valid: ['hello'], invalid: ['x'.repeat(4001), 123],
    build: (p) => ({ ...strRules({ maxLength: +p.maxLength || 4000 }), description: 'Additional data' }),
  }),
  P({
    id: 'nullableText', name: 'Nullable free text', group: 'Text', fieldName: 'additionalData', description: '["string","null"] with max length.',
    params: [{ key: 'maxLength', label: 'Max length', kind: 'number', default: 4000 }], valid: ['hello', null], invalid: ['x'.repeat(4001), 123],
    build: (p) => ({ ...strRules({ maxLength: +p.maxLength || 4000 }), nullable: true, description: 'Additional data' }),
  }),
  P({
    id: 'pagination', name: 'Pagination block', group: 'Blocks', fieldName: 'pagination', description: 'Object with optional `flag` (Y/N) and nullable `key`.',
    valid: [{ flag: 'Y', key: null }, {}, { key: 'abc' }], invalid: [{ flag: 'X' }, { key: 123 }],
    build: () => ({
      type: 'object',
      description: 'Pagination',
      rules: {},
      children: [
        newField({ name: 'flag', type: 'string', rules: { enum: ['Y', 'N'], maxLength: 1 }, description: 'More Records Flag. Y - Yes, N - No' }),
        newField({ name: 'key', type: 'string', nullable: true, rules: { maxLength: 100 }, description: 'Key for the next page from previous response' }),
      ],
    }),
  }),
  P({
    id: 'stdHeader', name: 'Standard header block', group: 'Blocks', fieldName: 'header', description: 'channelId (required) plus requestId and timestamp.',
    valid: [{ channelId: 'MB' }, { channelId: 'MB', requestId: 'abc-1', timestamp: '2026-01-01T00:00:00Z' }], invalid: [{}, { channelId: '' }],
    build: () => ({
      type: 'object',
      description: 'Standard header',
      rules: {},
      children: [
        newField({ name: 'channelId', type: 'string', required: true, rules: { minLength: 1, maxLength: 100 }, description: 'Channel ID (Required)' }),
        newField({ name: 'requestId', type: 'string', rules: { pattern: '^[A-Za-z0-9_-]+$', minLength: 1, maxLength: 64 }, description: 'Request ID' }),
        newField({ name: 'timestamp', type: 'string', rules: { pattern: PATTERNS.datetime }, description: 'Request timestamp, ISO 8601' }),
      ],
    }),
  }),
  P({
    id: 'finSvcHeaderInfo', name: 'Financial header block (finSvcHeaderInfo)', group: 'Blocks', fieldName: 'finSvcHeaderInfo',
    description: 'Standard RMLOG financial service header block shared across SKN, RTGS, SWIFT and fund transfers.',
    valid: [{ tellerId: 'TL01', controlUnit: 'CU1', journalSeqNum: '123456789', glReconNumber: 'GL1', agentCode: 'SKN' }],
    invalid: [{}, { tellerId: 'TL01', controlUnit: 'CU1', journalSeqNum: 'ABC', glReconNumber: 'GL1', agentCode: 'SKN' }],
    build: () => ({
      type: 'object',
      description: 'Financial service header info (RMLOG)',
      rules: {},
      children: [
        newField({ name: 'chequeNo', type: 'string', rules: { maxLength: 15 }, description: 'Cheque number' }),
        newField({ name: 'tellerId', type: 'string', required: true, rules: { minLength: 1, maxLength: 10 }, description: 'Teller ID (Required)' }),
        newField({ name: 'controlUnit', type: 'string', required: true, rules: { minLength: 1, maxLength: 7 }, description: 'Control unit (Required)' }),
        newField({ name: 'supervisorOverrideID', type: 'string', rules: { maxLength: 10 }, description: 'Supervisor override ID' }),
        newField({ name: 'rebidRequest', type: 'integer', rules: { maximum: 999 }, description: 'Rebid request, length: 3' }),
        newField({ name: 'journalSeqNum', type: 'string', required: true, rules: { pattern: numericPattern(9), minLength: 1, maxLength: 9 }, description: '(Numeric Only) Journal sequence number, length: 9 (Required)' }),
        newField({ name: 'forwardedItem', type: 'string', rules: { maxLength: 1 }, description: 'Forwarded item flag, length: 1' }),
        newField({ name: 'correction', type: 'string', rules: { maxLength: 1 }, description: 'Error correction flag, length: 1' }),
        newField({ name: 'overrideRequest', type: 'string', rules: { maxLength: 1 }, description: 'Override request (T/S), length: 1' }),
        newField({ name: 'glReconNumber', type: 'string', required: true, rules: { minLength: 1, maxLength: 20 }, description: 'GL reconciliation number, length: 20 (Required)' }),
        newField({ name: 'originalJournalSeqNum', type: 'string', rules: { pattern: numericPattern(9), maxLength: 9 }, description: '(Numeric Only) Original journal sequence number, length: 9' }),
        newField({ name: 'tellerBranch', type: 'string', rules: { pattern: numericPattern(5), maxLength: 5 }, description: '(Numeric Only) Teller branch, length: 5' }),
        newField({ name: 'releaseAcctRequest', type: 'string', rules: { maxLength: 1 }, description: 'Release account request flag, length: 1' }),
        newField({ name: 'ourRef', type: 'string', rules: { maxLength: 20 }, description: 'Reference number, length: 20' }),
        newField({ name: 'remarks', type: 'string', rules: { maxLength: 120 }, description: 'Remarks, length: 120' }),
        newField({ name: 'agentCode', type: 'string', required: true, rules: { minLength: 1, maxLength: 15 }, description: 'Agent code, length: 15 (Required)' }),
      ],
    }),
  }),
  P({
    id: 'sofInfo', name: 'Source of funds block (sofInfo)', group: 'Blocks', fieldName: 'sofInfo',
    description: 'Standard debit account / amount / currency block (sofInfo).',
    valid: [{ accountNo: '1234567890', accountType: 'CDA', amount: '150000.00', currency: 'IDR' }],
    invalid: [{}, { accountNo: 'ABC', accountType: 'CDA', amount: '150000.00', currency: 'IDR' }],
    build: () => ({
      type: 'object',
      description: 'Source of funds info',
      rules: {},
      children: [
        newField({ name: 'accountNo', type: 'string', required: true, rules: { pattern: numericPattern(19), minLength: 1, maxLength: 19 }, description: '(Numeric Only) Account Number, length: 19 (Required)' }),
        newField({ name: 'accountType', type: 'string', required: true, rules: { enum: ['CDA', 'SDA'], minLength: 1, maxLength: 3 }, description: "Account Type. Valid values: 'CDA', 'SDA', length: 3 (Required)" }),
        newField({ name: 'amount', type: 'string', required: true, rules: { pattern: PATTERNS.amount, minLength: 1, maxLength: 18 }, description: 'Debit Amount, up to 2 decimal places, length: 18 (Required)' }),
        newField({ name: 'currency', type: 'string', required: true, rules: { pattern: '^[A-Z]{3}$', minLength: 3, maxLength: 3 }, description: 'ISO currency code, length: 3 (Required)' }),
      ],
    }),
  }),
];

export interface CustomPreset {
  id: string;
  name: string;
  description: string;
  patch: FieldPatch & { type: Field['type'] };
}

export function customToPreset(c: CustomPreset): Preset {
  return {
    id: c.id, name: c.name, group: 'Custom', description: c.description || 'Custom preset', fieldName: 'field', params: [], valid: [], invalid: [], builtin: false,
    build: () => structuredClone(c.patch),
  };
}

/** Serialize a field (without ids/name) as a reusable patch */
export function fieldToPatch(f: Field): CustomPreset['patch'] {
  const strip = (x: Field): any => ({
    name: x.name, type: x.type, required: x.required, nullable: x.nullable, description: x.description, rules: x.rules, extra: x.extra,
    children: x.children.map(strip), items: x.items ? strip(x.items) : undefined,
  });
  const s = strip(f);
  delete s.name;
  return structuredClone(s);
}

const reId = (x: any): Field => newField({ ...x, children: (x.children ?? []).map(reId), items: x.items ? reId(x.items) : undefined });

/** Apply a preset patch to an existing field, keeping its identity (name/required) */
export function applyPatch(field: Field, patch: FieldPatch): Field {
  const type = patch.type ?? field.type;
  const fresh = (patch.children ?? []).map((c) => reId(c));
  return {
    ...field,
    type,
    rules: structuredClone(patch.rules ?? {}),
    nullable: patch.nullable ?? field.nullable,
    description: field.description || patch.description || '',
    children: type === 'object' ? (patch.children ? fresh : field.children) : [],
    items: type === 'array' ? (patch.items ? reId(patch.items) : field.items) : undefined,
    extra: patch.extra ?? field.extra,
  };
}

export function defaultParams(p: Preset): Record<string, any> {
  return Object.fromEntries(p.params.map((x) => [x.key, x.default]));
}
