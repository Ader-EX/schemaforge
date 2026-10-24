import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { decodeBytes } from '../src/model/decode';
import { detectColumns, detectHeaderRow, interpretTable, parseTable, rowsToTree } from '../src/model/specTable';
import { fieldToSchema } from '../src/model/toSchema';
import { lintSchema } from '../src/lint/lint';
import { genCases, genValid } from '../src/engine/generate';
import { validatePayload } from '../src/engine/validator';

const FILES = ['InterbankSKNLCY.csv', 'InterbankSKNFCY.csv', 'IntraFTransfer.csv', 'CASATransactionHist.csv', 'RealtimeFundTransfer.csv', 'VAINQ.csv', 'TransferVA.csv', 'TopupEWaller.csv', 'chargesInq.csv'];

function build(file: string) {
  const { rows } = parseTable(decodeBytes(readFileSync('../' + file)));
  const h = detectHeaderRow(rows);
  const { map, ok } = detectColumns(rows[h]);
  const spec = interpretTable(rows, map, h + 1);
  const root = rowsToTree(spec);
  const schema = { $schema: 'http://json-schema.org/draft-04/schema#', ...fieldToSchema(root) };
  return { ok, spec, schema, h };
}

describe('real spec files', () => {
  for (const f of FILES) {
    it.skipIf(!existsSync('../' + f))(`${f}: parses, lints, generates`, () => {
      const { ok, spec, schema, h } = build(f);
      console.log(f, 'header row', h, 'ok', ok, 'fields', spec.length, 'lint', lintSchema(schema).length);
      expect(ok).toBe(true);
      expect(spec.length).toBeGreaterThan(3);
      expect(validatePayload(schema, genValid(schema, { optional: true })).valid).toBe(true);
      const cases = genCases(schema);
      expect(cases.length).toBeGreaterThan(10);
    });
  }
  it.skipIf(!existsSync('../InterbankSKNLCY.csv'))('SKN specifics', () => {
    const { spec, schema } = build('InterbankSKNLCY.csv');
    expect(spec.length).toBeGreaterThan(150);
    expect(schema.properties.finSvcHeaderInfo.properties.chequeNo.maxLength).toBe(15);
    expect(schema.properties.sofInfo.properties.accountNo.pattern).toBe('^[0-9]{1,19}$');
    expect(schema.properties.finSvcHeaderInfo.properties.rebidRequest.type).toBe('integer');
  });
});
