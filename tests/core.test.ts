import { describe, expect, it } from 'vitest';
import { ACCT_BINDING_INQ, CASA_TRANSACTION_HISTORY } from '../src/data/fixtures';
import { fromSchema, Unsupported } from '../src/model/fromSchema';
import { buildSchema } from '../src/model/toSchema';
import { newProject } from '../src/model/types';
import { BUILTIN_PRESETS, defaultParams } from '../src/model/presets';
import { applyLintFix, extractEnum, lintSchema } from '../src/lint/lint';
import { compile, validatePayload } from '../src/engine/validator';
import { genCases, genValid } from '../src/engine/generate';
import { inferFromSample } from '../src/model/infer';
import { detectColumns, interpretTable, parseAllowed, parseLength, parseTable, rowsToTree } from '../src/model/specTable';
import { fieldToSchema } from '../src/model/toSchema';

const FORBIDDEN = ['const', 'if', 'then', 'else', 'contains', 'propertyNames', 'examples', 'nullable', '$id', '$defs'];
const keys = (o: any, acc: string[] = []): string[] => {
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { acc.push(k); if (k !== 'properties') keys(v, acc); else for (const p of Object.values(v as any)) keys(p, acc); }
  return acc;
};

describe('draft-04 validator', () => {
  it('uses a real draft-04 validator (boolean exclusiveMinimum)', () => {
    const s = { $schema: 'http://json-schema.org/draft-04/schema#', type: 'integer', minimum: 5, exclusiveMinimum: true };
    expect(validatePayload(s, 5).valid).toBe(false);
    expect(validatePayload(s, 6).valid).toBe(true);
    // numeric exclusiveMinimum is invalid in draft-04 → compile error
    expect(compile({ $schema: 'http://json-schema.org/draft-04/schema#', type: 'integer', exclusiveMinimum: 5 }).error).toBeTruthy();
  });
});

describe('round trip', () => {
  for (const [n, fx] of [['casa', CASA_TRANSACTION_HISTORY], ['acct', ACCT_BINDING_INQ]] as const) {
    it(`fixture ${n} survives import → tree → schema`, () => {
      const { root, title } = fromSchema(fx);
      const p = newProject(title, { root, title });
      expect(buildSchema(p).schema).toEqual(fx);
    });
  }
  it('rejects $ref', () => {
    expect(() => fromSchema({ type: 'object', properties: { a: { $ref: '#/definitions/x' } } })).toThrow(Unsupported);
  });
});

describe('lint on fixtures', () => {
  const issues = lintSchema(CASA_TRANSACTION_HISTORY);
  const has = (code: string, path: string) => issues.find((i) => i.code === code && i.path === path);
  it('flags nullable and offers type array', () => {
    const i = has('unsupported-keyword', '#/properties/pagination/properties/key')!;
    expect(i.severity).toBe('error');
    const fixed = applyLintFix(CASA_TRANSACTION_HISTORY, i);
    expect(fixed.properties.pagination.properties.key.type).toEqual(['string', 'null']);
    expect(fixed.properties.pagination.properties.key.nullable).toBeUndefined();
  });
  it('flags missing enums with extractable values', () => {
    for (const [f, vals] of [['accountInfo/properties/accountType', ['CDA', 'SDA']], ['transactionType', ['C', 'D', '']], ['sortBy', ['A', '']], ['pagination/properties/flag', ['Y', 'N']]] as const) {
      const path = '#/properties/' + f.replace(/\//g, '/');
      const i = has('desc-enum', path)!;
      expect(i, path).toBeTruthy();
      expect(applyLintFix(CASA_TRANSACTION_HISTORY, i).properties).toBeTruthy();
      expect(extractEnum((i as any).message ? getDesc(CASA_TRANSACTION_HISTORY, path) : '')).toEqual(vals);
    }
  });
  it('flags date, anchoring, pattern length', () => {
    expect(has('date-pattern', '#/properties/startDate')).toBeTruthy();
    expect(has('pattern-length', '#/properties/accountInfo/properties/accountNo')).toBeTruthy();
    expect(issues.some((i) => i.code === 'unanchored-pattern')).toBe(false);
  });
  it('fixture 2 has no errors', () => {
    expect(lintSchema(ACCT_BINDING_INQ).filter((i) => i.severity === 'error')).toEqual([]);
    expect(lintSchema(ACCT_BINDING_INQ).some((i) => i.code === 'nullable-pattern')).toBe(true);
  });
  it('detects conflicts', () => {
    const l = lintSchema({ $schema: 'x', type: 'object', required: ['q'], properties: { a: { type: 'string', minLength: 5, maxLength: 2, pattern: '[a-z', const: 1 }, b: { type: 'integer', maxLength: 3 } } });
    const codes = l.map((i) => i.code);
    for (const c of ['wrong-$schema', 'required-undefined', 'range-conflict', 'invalid-regex', 'unsupported-keyword', 'ignored-keyword']) expect(codes).toContain(c);
  });
});
function getDesc(s: any, path: string) {
  return path.slice(2).split('/').reduce((a, k) => a[k], s).description as string;
}

describe('presets', () => {
  for (const p of BUILTIN_PRESETS) {
    it(`preset ${p.id}: examples behave`, () => {
      const f = p.build(defaultParams(p));
      const schema = { $schema: 'http://json-schema.org/draft-04/schema#', ...fieldToSchema({ id: 'x', name: 'x', required: false, nullable: false, description: '', rules: {}, children: [], ...f } as any) };
      for (const v of p.valid) expect(validatePayload(schema, v).valid, JSON.stringify(v)).toBe(true);
      for (const v of p.invalid) expect(validatePayload(schema, v).valid, JSON.stringify(v)).toBe(false);
      expect(keys(schema).filter((k) => FORBIDDEN.includes(k))).toEqual([]);
    });
  }
});

describe('generator', () => {
  for (const [n, fx] of [['casa', CASA_TRANSACTION_HISTORY], ['acct', ACCT_BINDING_INQ]] as const) {
    it(`valid payload passes (${n})`, () => {
      const { root } = fromSchema(fx);
      const s = buildSchema(newProject('x', { root })).schema;
      for (let i = 0; i < 20; i++) {
        expect(validatePayload(s, genValid(s, { optional: true })).valid).toBe(true);
        expect(validatePayload(s, genValid(s, { optional: false })).valid).toBe(true);
      }
    });
    it(`cases (${n})`, () => {
      const cases = genCases(fx);
      expect(cases.length).toBeGreaterThan(10);
      const bad = cases.filter((c) => c.status === 'mismatch');
      // boundary + required + type cases must all be OK; mismatches are only real schema holes
      expect(bad.filter((c) => c.expect === 'pass' || /missing|wrong type/.test(c.label))).toEqual([]);
    });
  }
});

describe('infer', () => {
  it('infers and suggests', () => {
    const r = inferFromSample({ acc: '12345', d: '2026-01-02', f: 'Y', n: null, o: { x: 1 }, arr: [{ a: 1 }, { a: 2, b: 'z' }] }, true);
    expect(r.suggestions.map((s) => s.presetId).sort()).toEqual(['date', 'flag', 'numeric']);
    const arr = r.root.children.find((c) => c.name === 'arr')!;
    expect(arr.items!.children.find((c) => c.name === 'a')!.required).toBe(true);
    expect(arr.items!.children.find((c) => c.name === 'b')!.required).toBe(false);
    expect(r.root.children.find((c) => c.name === 'n')!.nullable).toBe(true);
  });
});

describe('spec table', () => {
  it('parses TSV with dotted paths, arrays and notations', () => {
    const tsv = 'Field Name\tType\tLength\tM/O\tFormat\tAllowed Values\tDescription\n' +
      'accountInfo.accountNo\tNumeric\t1-19\tM\t\t\tAcct\n' +
      'transactionType\tString\t1\tO\t\tC - Credit, D - Debit\tType\n' +
      'items[].id\tInteger\t2\tY\t\t\tid\n' +
      'startDate\tString\t10\tO\tYYYY-MM-DD\t\td\n' +
      'flag\tString\t(1,1)\tN\t\tY/N\tf';
    const { rows } = parseTable(tsv);
    const { map, ok } = detectColumns(rows[0]);
    expect(ok).toBe(true);
    const tree = rowsToTree(interpretTable(rows, map, true));
    const s = fieldToSchema(tree);
    expect(s.properties.accountInfo.properties.accountNo.pattern).toBe('^[0-9]{1,19}$');
    expect(s.properties.accountInfo.properties.accountNo.minLength).toBe(1);
    expect(s.properties.transactionType.enum).toEqual(['C', 'D']);
    expect(s.properties.items.type).toBe('array');
    expect(s.properties.items.items.properties.id.maximum).toBe(99);
    expect(s.properties.startDate.pattern).toContain('[0-9]{4}');
    expect(s.properties.flag.enum).toEqual(['Y', 'N']);
  });
  it('markdown + helpers', () => {
    const md = '| Field | Type | Required |\n|---|---|---|\n| a | string | Mandatory |';
    const { rows } = parseTable(md);
    expect(rows.length).toBe(2);
    expect(parseLength('max 19')).toEqual({ max: 19 });
    expect(parseLength('(1,19)')).toEqual({ min: 1, max: 19 });
    expect(parseAllowed("'CDA', 'SDA'")).toEqual(['CDA', 'SDA']);
  });
});
