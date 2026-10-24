import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { decodeBytes } from '../src/model/decode';
import { parseLength, parseSpecDocument, rowsToTree } from '../src/model/specTable';
import { fieldToSchema } from '../src/model/toSchema';
import { lintSchema } from '../src/lint/lint';
import { genCases, genValid } from '../src/engine/generate';
import { validatePayload } from '../src/engine/validator';

const FILES = ['InterbankSKNLCY.csv', 'InterbankSKNFCY.csv', 'IntraFTransfer.csv', 'CASATransactionHist.csv', 'RealtimeFundTransfer.csv', 'VAINQ.csv', 'TransferVA.csv', 'TopupEWaller.csv', 'chargesInq.csv'];

function build(file: string) {
  const { ok, specRows, headerRow } = parseSpecDocument(decodeBytes(readFileSync('../' + file)));
  const root = rowsToTree(specRows);
  const schema = { $schema: 'http://json-schema.org/draft-04/schema#', ...fieldToSchema(root) };
  return { ok, spec: specRows, schema, h: headerRow };
}

describe('real spec files', () => {
  for (const f of FILES) {
    it.skipIf(!existsSync('../' + f))(`${f}: parses, lints, generates`, () => {
      const { ok, spec, schema } = build(f);
      expect(ok).toBe(true);
      expect(spec.length).toBeGreaterThan(3);
      expect(validatePayload(schema, genValid(schema, { optional: true })).valid).toBe(true);
      const cases = genCases(schema);
      expect(cases.length).toBeGreaterThan(10);
      lintSchema(schema);
    });
  }
  it.skipIf(!existsSync('../InterbankSKNLCY.csv'))('SKN specifics (147 request body fields, decimal 18,2, no response or header pollution)', () => {
    const { spec, schema } = build('InterbankSKNLCY.csv');
    expect(spec.length).toBe(147);
    expect(schema.properties.finSvcHeaderInfo.properties.chequeNo.maxLength).toBe(15);
    expect(schema.properties.sofInfo.properties.accountNo.pattern).toBe('^[0-9]{1,19}$');
    expect(schema.properties.sofInfo.properties.amount.pattern).toBe('^[0-9]+(\\.[0-9]{1,2})?$');
    expect(schema.properties.sofInfo.properties.amount.maxLength).toBe(18);
    expect(schema.properties.finSvcHeaderInfo.properties.rebidRequest.type).toBe('integer');
    // Response fields and HTTP headers must not leak into the request body schema
    expect(schema.properties.statusCode).toBeUndefined();
    expect(schema.properties.tmqF1).toBeUndefined();
    expect(schema.properties['Request-ID']).toBeUndefined();
  });
  it('parses precision/scale vs min/max length notations', () => {
    expect(parseLength('18,2')).toEqual({ max: 18, decimals: 2 });
    expect(parseLength('18.2')).toEqual({ max: 18, decimals: 2 });
    expect(parseLength('19,0')).toEqual({ max: 19 });
    expect(parseLength('17,2 (18 Inc Decimal)')).toEqual({ max: 18, decimals: 2 });
    expect(parseLength('(1,19)')).toEqual({ min: 1, max: 19 });
    expect(parseLength('1-19')).toEqual({ min: 1, max: 19 });
  });
  it.skipIf(!existsSync('../idms/DefaultAccountModification1.0/DefaultAccountModification_ESB.csv'))('IDMS DefaultAccountModification1.0 ESB & Gateway specs parse, require synthesized parent objects, and validate Excel sample payload', () => {
    const esb = build('idms/DefaultAccountModification1.0/DefaultAccountModification_ESB.csv');
    expect(esb.ok).toBe(true);
    expect(esb.spec.length).toBe(6);
    expect(esb.schema.required).toEqual(['system', 'referenceNumber', 'CIFNumber', 'mobilePhone', 'accountNumber', 'accountType']);
    expect(esb.schema.properties.system.required).toEqual(['channelId']);
    expect(esb.schema.properties.accountType.pattern).toBeUndefined();
    const excelSample = {
      system: { channelId: 'OCTOMOBILE' },
      referenceNumber: 'OCTOMOBILE562625',
      CIFNumber: '11140000467207',
      mobilePhone: '0',
      accountNumber: '6288888888880',
      accountType: 'RPN',
    };
    expect(validatePayload(esb.schema, excelSample).valid).toBe(true);

    const gw = build('idms/DefaultAccountModification1.0/DefaultAccountModification_Gateway.csv');
    expect(gw.ok).toBe(true);
    expect(gw.spec.length).toBe(6);
    expect(gw.schema.required).toEqual(['channelCode', 'referenceNo', 'custPermId', 'mobilePhone', 'accountInfo']);
    expect(gw.schema.properties.accountInfo.required).toEqual(['accountNo', 'accountType']);
  });
});
