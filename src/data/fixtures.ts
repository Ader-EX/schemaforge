export const CASA_TRANSACTION_HISTORY = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  title: 'CASATransactionHistoryRequest',
  type: 'object',
  required: ['nonFinSvcHeaderInfo', 'accountInfo'],
  properties: {
    nonFinSvcHeaderInfo: {
      type: 'object',
      required: ['bankId', 'branchId'],
      properties: {
        bankId: { type: 'integer', maximum: 99, description: 'Bank number, length: 2 (Required)' },
        branchId: { type: 'string', pattern: '^[0-9]{1,5}$', minLength: 1, maxLength: 5, description: '(Numeric Only) Branch number, length: 5 (Required)' },
      },
    },
    pagination: {
      type: 'object',
      properties: {
        flag: { type: 'string', maxLength: 1, description: 'More Records Flag (Mandatory if Inquiry) “Y” – Yes , “N” – No. Front end defaults to “N”, length: 1' },
        key: { type: 'string', maxLength: 100, description: 'Key for the next page from previous response, length: 100', nullable: true },
      },
    },
    accountInfo: {
      type: 'object',
      required: ['accountNo', 'accountType'],
      properties: {
        accountNo: { type: 'string', pattern: '^[0-9]{1,19}$', minLength: 1, maxLength: 19, description: '(Numeric Only) Account Number, length: 19 (Required)' },
        accountType: { type: 'string', minLength: 1, maxLength: 3, description: "Account Type. Valid values: 'CDA', 'SDA'. Refer to LOV CIMB_ACCTTYPE_CODE, length: 3 (Required)" },
      },
    },
    startDate: { type: 'string', pattern: '^$|^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$', maxLength: 10, description: '(Date) Transaction Start Date. Format YYYY-MM-DD, length: 10' },
    endDate: { type: 'string', pattern: '^$|^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$', maxLength: 10, description: '(Date) Transaction End Date. Format: YYYY-MM-DD, length: 10' },
    transactionType: { type: 'string', maxLength: 1, description: 'Expected Value: C - Credit, D - Debit, *Blanks - Both, length: 1' },
    sortBy: { type: 'string', maxLength: 1, description: 'Expected Value: A - Ascending, *Blanks - Descending' },
  },
};

export const ACCT_BINDING_INQ = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  title: 'AcctBindingInq',
  type: 'object',
  required: ['channelId', 'payeeCode', 'custPermId'],
  properties: {
    channelId: { type: 'string', minLength: 1, maxLength: 100, description: 'Channel ID (Required)' },
    payeeCode: { type: 'string', pattern: '^[A-Za-z0-9]+$', minLength: 1, maxLength: 100, description: 'Payee code, alphanumeric only, length: 1-100 (Required)' },
    custPermId: { type: 'string', pattern: '^[0-9]{1,20}$', minLength: 1, maxLength: 20, description: 'custPermId, numeric only, length: 1-20 (Required)' },
    phoneNumber: { type: ['string', 'null'], pattern: '^[0-9]+$', maxLength: 30, description: 'Phone number, numeric only, length: 1-30' },
    additionalData: { type: ['string', 'null'], maxLength: 4000, description: 'Additional data' },
  },
};

export interface Template {
  id: string;
  name: string;
  schema: any;
  tests: { name: string; payload: any; expect: 'pass' | 'fail' }[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'casa', name: 'CASATransactionHistoryRequest', schema: CASA_TRANSACTION_HISTORY,
    tests: [
      { name: 'valid happy path', expect: 'pass', payload: { nonFinSvcHeaderInfo: { bankId: 14, branchId: '1' }, accountInfo: { accountNo: '1234567890', accountType: 'SDA' }, startDate: '2026-01-01', endDate: '2026-01-31' } },
      { name: 'missing accountInfo', expect: 'fail', payload: { nonFinSvcHeaderInfo: { bankId: 14, branchId: '1' } } },
      { name: 'bankId sent as string', expect: 'fail', payload: { nonFinSvcHeaderInfo: { bankId: '14', branchId: '1' }, accountInfo: { accountNo: '1', accountType: 'CDA' } } },
    ],
  },
  {
    id: 'acct', name: 'AcctBindingInq', schema: ACCT_BINDING_INQ,
    tests: [
      { name: 'valid happy path', expect: 'pass', payload: { channelId: 'MB', payeeCode: 'PAY01', custPermId: '12345', phoneNumber: null } },
      { name: 'missing channelId', expect: 'fail', payload: { payeeCode: 'PAY01', custPermId: '12345' } },
      { name: 'custPermId not numeric', expect: 'fail', payload: { channelId: 'MB', payeeCode: 'PAY01', custPermId: '12A45' } },
    ],
  },
];
