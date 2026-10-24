import { Severity } from './lint';

export interface LintGlossaryEntry {
  code: string;
  severity: Severity;
  title: string;
  when: string;
  whyItMatters: string;
  autoFix: string;
  exampleBad?: string;
  exampleGood?: string;
}

export const LINT_GLOSSARY: LintGlossaryEntry[] = [
  // ---- ERRORS ----
  {
    code: 'missing-$schema',
    severity: 'error',
    title: 'Missing "$schema" declaration',
    when: 'The root schema object does not have a "$schema" property.',
    whyItMatters: 'webMethods API Gateway 11.1 requires schemas to explicitly declare JSON Schema Draft-04 so the gateway knows which specification version to apply.',
    autoFix: 'Adds "$schema": "http://json-schema.org/draft-04/schema#" at the root.',
    exampleBad: '{ "type": "object", "properties": { ... } }',
    exampleGood: '{ "$schema": "http://json-schema.org/draft-04/schema#", "type": "object", ... }',
  },
  {
    code: 'wrong-$schema',
    severity: 'error',
    title: 'Non-Draft-04 "$schema" URI',
    when: '"$schema" is set to Draft-07, Draft 2019-09, Draft 2020-12, or another URI instead of Draft-04.',
    whyItMatters: 'webMethods API Gateway 11.1 validates JSON schemas against Draft-04. Using a newer "$schema" URI can cause policy upload or runtime validation failures.',
    autoFix: 'Replaces "$schema" with "http://json-schema.org/draft-04/schema#".',
    exampleBad: '"$schema": "http://json-schema.org/draft-07/schema#"',
    exampleGood: '"$schema": "http://json-schema.org/draft-04/schema#"',
  },
  {
    code: 'unsupported-keyword',
    severity: 'error',
    title: 'Unsupported Draft-06+ / OpenAPI keyword',
    when: 'A field uses keywords not in Draft-04: "nullable", "const", "$id", "$defs", "examples", "if/then/else", "contains", "propertyNames", "readOnly", "writeOnly", etc.',
    whyItMatters: 'Draft-04 validators either reject these keywords outright or silently ignore them (which means a "const" or "if/then" rule would not validate anything at runtime!).',
    autoFix: 'Converts "nullable": true -> "type": ["T", "null"] (and adds null to enum), "const": "X" -> "enum": ["X"], "$id" -> "id", "$defs" -> "definitions", or removes unsupported keywords.',
    exampleBad: '{ "type": "string", "nullable": true, "const": "IDR" }',
    exampleGood: '{ "type": ["string", "null"], "enum": ["IDR", null] }',
  },
  {
    code: 'numeric-exclusive',
    severity: 'error',
    title: 'Numeric exclusiveMinimum / exclusiveMaximum (Draft-07 style)',
    when: '"exclusiveMinimum" or "exclusiveMaximum" is set to a number instead of a boolean.',
    whyItMatters: 'In Draft-04, "exclusiveMinimum" and "exclusiveMaximum" MUST be booleans (true/false) that modify a companion "minimum" or "maximum" number.',
    autoFix: 'Converts "exclusiveMinimum": 0 into "minimum": 0, "exclusiveMinimum": true.',
    exampleBad: '{ "type": "number", "exclusiveMinimum": 0 }',
    exampleGood: '{ "type": "number", "minimum": 0, "exclusiveMinimum": true }',
  },
  {
    code: 'required-undefined',
    severity: 'error',
    title: 'Property in "required" is not defined in "properties"',
    when: 'An object\'s "required" array lists a field name that does not exist in its "properties" map (often caused by a typo or renaming a field).',
    whyItMatters: 'Wait-time / runtime requests may fail unpredictably or require an undocumented property that has no type/rules defined.',
    autoFix: 'Removes the orphaned property name from the "required" array.',
    exampleBad: '"properties": { "acctNo": { "type": "string" } }, "required": ["accountNo"]',
    exampleGood: '"properties": { "acctNo": { "type": "string" } }, "required": ["acctNo"]',
  },
  {
    code: 'invalid-regex',
    severity: 'error',
    title: 'Invalid regular expression syntax',
    when: 'The "pattern" string fails to compile with new RegExp(pattern) (e.g. unclosed parenthesis or bracket).',
    whyItMatters: 'A broken regex prevents the entire schema from compiling in both ajv-draft-04 and webMethods API Gateway.',
    autoFix: 'Manual fix required in the field\'s pattern input.',
    exampleBad: '"pattern": "^[0-9+{1,10}$"',
    exampleGood: '"pattern": "^[0-9]{1,10}$"',
  },
  {
    code: 'non-ecma-regex',
    severity: 'error',
    title: 'Non-ECMA-262 regex feature (or ES2018+ lookbehind warning)',
    when: 'The "pattern" uses PCRE/Java/Python-only constructs like inline flags (?i), atomic groups (?>...), possessive quantifiers ++, \\A / \\Z, POSIX classes [[:alpha:]], or lookbehinds (?<=...).',
    whyItMatters: 'JSON Schema Draft-04 specifies ECMA-262 regular expressions. Engine-specific PCRE syntax fails or behaves differently across gateways.',
    autoFix: 'Rewrite using standard ECMA-262 character classes and quantifiers (e.g. replace (?i)^[a-z]+$ with ^[A-Za-z]+$).',
    exampleBad: '"pattern": "(?i)^[a-z0-9]+$"',
    exampleGood: '"pattern": "^[A-Za-z0-9]+$"',
  },
  {
    code: 'range-conflict',
    severity: 'error',
    title: 'Impossible min/max range (min > max or negative length)',
    when: 'minLength > maxLength, minimum > maximum, minItems > maxItems, minProperties > maxProperties, or a length/item bound is negative.',
    whyItMatters: 'No value can ever satisfy the field, causing 100% of requests to fail validation.',
    autoFix: 'Swaps the min and max values (or resets negative bounds to 0).',
    exampleBad: '{ "type": "string", "minLength": 20, "maxLength": 5 }',
    exampleGood: '{ "type": "string", "minLength": 5, "maxLength": 20 }',
  },

  // ---- WARNINGS ----
  {
    code: 'unanchored-pattern',
    severity: 'warning',
    title: 'Regex pattern is not anchored with ^ and $',
    when: 'A "pattern" (or one of its top-level "|" branches) does not start with ^ and end with $.',
    whyItMatters: 'In JSON Schema, "pattern" performs a substring search unless anchored! Without ^ and $, "[0-9]{5}" will happily accept "DROP TABLE 12345 --".',
    autoFix: 'Wraps each top-level alternation branch with ^ and $.',
    exampleBad: '"pattern": "[0-9]{1,19}"',
    exampleGood: '"pattern": "^[0-9]{1,19}$"',
  },
  {
    code: 'empty-required',
    severity: 'warning',
    title: 'Required string allows empty string ""',
    when: 'A field is marked "required" and typed "string", but has no minLength >= 1, no enum, and no pattern that rejects "".',
    whyItMatters: 'JSON Schema "required" only checks that the key is present in the JSON object. Without minLength: 1 (or a non-empty pattern), {"accountNo": ""} passes validation!',
    autoFix: 'Sets "minLength": 1 on the field.',
    exampleBad: '{ "type": "string", "maxLength": 19 } (in required)',
    exampleGood: '{ "type": "string", "minLength": 1, "maxLength": 19 }',
  },
  {
    code: 'desc-enum',
    severity: 'warning',
    title: 'Description mentions allowed values, but "enum" is missing',
    when: 'The field\'s description contains phrases like "Valid values: CDA, SDA", "Allowed values: Y/N", or "\'C\' - Credit, \'D\' - Debit", but the schema has no "enum".',
    whyItMatters: 'Spec authors often write allowed codes in the Remarks/Description column instead of the Format column. Extracting them into "enum" enforces the restriction at the gateway.',
    autoFix: 'Extracts the values into "enum": [...] (and automatically appends null if the field is nullable).',
    exampleBad: '{ "type": "string", "description": "Valid values: CDA, SDA" }',
    exampleGood: '{ "type": "string", "enum": ["CDA", "SDA"], "description": "Valid values: CDA, SDA" }',
  },
  {
    code: 'desc-required',
    severity: 'warning',
    title: 'Description Required/Optional conflicts with schema "required"',
    when: 'The description says "(Required)" or "Mandatory" when the field is optional in the schema, OR says "(Optional)" when the field is in "required".',
    whyItMatters: 'Catches mismatches between the human documentation and the actual validation rule.',
    autoFix: 'Adds the field to (or removes it from) the parent object\'s "required" array.',
  },
  {
    code: 'desc-length',
    severity: 'warning',
    title: 'Description states a length that disagrees with maxLength / minLength',
    when: 'The description says e.g. "length: 19" or "length 1-19", but the field\'s maxLength/minLength is unset or set to a different number.',
    whyItMatters: 'Ensures length constraints documented in prose are actually enforced by the schema.',
    autoFix: 'Sets maxLength (and minLength if a range was stated) to match the description.',
  },
  {
    code: 'pattern-length',
    severity: 'warning',
    title: 'minLength / maxLength duplicates or conflicts with pattern quantifier',
    when: 'A field has both a bounded regex like "^[0-9]{1,19}$" and minLength/maxLength keywords that either duplicate {1,19} or contradict it (e.g. maxLength: 25).',
    whyItMatters: 'Conflicting bounds confuse readers (the stricter bound wins at runtime), while duplicate bounds are redundant.',
    autoFix: 'Removes redundant minLength/maxLength or syncs conflicting bounds to the regex quantifier.',
  },
  {
    code: 'numeric-string',
    severity: 'warning',
    title: 'Numeric string vs. integer type reminder',
    when: 'The description mentions "numeric" or "digits only" on an unrestricted string (no pattern), OR on a field typed "integer" / "number".',
    whyItMatters: 'In banking APIs (SNAP BI / ESB), account numbers, branch IDs, and card numbers are almost always sent as JSON strings ("00123") to preserve leading zeros and >53-bit precision. Typing them as "integer" will reject quoted strings!',
    autoFix: 'For unrestricted strings, offers one-click Fix to add "pattern": "^[0-9]+$".',
  },
  {
    code: 'date-pattern',
    severity: 'warning',
    title: 'Date regex cannot reject impossible calendar dates',
    when: 'A field uses a YYYY-MM-DD regex pattern.',
    whyItMatters: 'A regular expression checks format (01-12 month, 01-31 day) but cannot reject calendar-invalid dates like "2026-02-31". The backend service must still validate calendar dates.',
    autoFix: 'Informational warning — no schema change required.',
  },
  {
    code: 'ignored-keyword',
    severity: 'warning',
    title: 'Keyword placed on incompatible type (silently ignored)',
    when: 'A string keyword (minLength, maxLength, pattern) is on an integer/boolean/object, or a numeric keyword (minimum, maximum) is on a string.',
    whyItMatters: 'JSON Schema silently ignores type-mismatched keywords! For example, "maxLength": 10 on an "integer" does NOT limit the integer to 10 digits.',
    autoFix: 'Removes the ignored keyword from the field.',
  },
  {
    code: 'no-additionalProperties',
    severity: 'warning',
    title: 'Missing "additionalProperties" on object',
    when: 'An object schema (warning on root, info on nested objects) does not specify "additionalProperties".',
    whyItMatters: 'By default in JSON Schema, "additionalProperties" defaults to true — meaning callers can send arbitrary unknown or misspelled fields without triggering a validation error.',
    autoFix: 'Sets "additionalProperties": false on the object (or use "Forbid extra props (recursive)" in the Tree toolbar).',
  },

  // ---- INFO ----
  {
    code: 'nullable-pattern',
    severity: 'info',
    title: 'Nullable field has a regex pattern',
    when: 'A field has "type": ["string", "null"] together with a "pattern".',
    whyItMatters: 'In Draft-04, "pattern" only applies when the runtime value is a string. Sending null will still pass validation as intended.',
    autoFix: 'Informational note — no change needed.',
  },
  {
    code: 'no-required',
    severity: 'info',
    title: 'Object has no "required" array',
    when: 'An object defines "properties" but has no "required" array.',
    whyItMatters: 'Every property inside this object is currently optional (an empty object {} will pass). Mark mandatory fields with the * toggle if required.',
    autoFix: 'Toggle * (Required) on any child field in the Tree builder.',
  },
];
