import { beforeAll, describe, expect, it } from 'vitest';

let useStore: typeof import('../src/store').useStore;
let buildSchema: typeof import('../src/model/toSchema').buildSchema;
let lintSchema: typeof import('../src/lint/lint').lintSchema;
let applyLintFix: typeof import('../src/lint/lint').applyLintFix;

beforeAll(async () => {
  const mem: Record<string, string> = {};
  (globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
  (globalThis as any).matchMedia = () => ({ matches: false });
  (globalThis as any).document = { documentElement: { classList: { toggle() {}, add() {} } } };
  ({ useStore } = await import('../src/store'));
  ({ buildSchema } = await import('../src/model/toSchema'));
  ({ lintSchema, applyLintFix } = await import('../src/lint/lint'));
});

const cur = () => { const s = useStore.getState(); return s.projects.find((p) => p.id === s.activeId)!; };

describe('store flows', () => {
  it('loads template, applies lint fix through the tree, undo/redo', () => {
    useStore.getState().loadTemplate('casa');
    expect(cur().raw).toBeNull();
    let schema = buildSchema(cur()).schema;
    const nullable = lintSchema(schema).find((i) => i.code === 'unsupported-keyword' && i.path.endsWith('/key'))!;
    expect(nullable).toBeTruthy();
    useStore.getState().loadSchemaObject(applyLintFix(schema, nullable));
    schema = buildSchema(cur()).schema;
    expect(schema.properties.pagination.properties.key.type).toEqual(['string', 'null']);
    expect(lintSchema(schema).some((i) => i.code === 'unsupported-keyword')).toBe(false);
    useStore.getState().undo();
    expect(buildSchema(cur()).schema.properties.pagination.properties.key.nullable).toBe(true);
    useStore.getState().redo();
    expect(buildSchema(cur()).schema.properties.pagination.properties.key.nullable).toBeUndefined();
  });

  it('required toggle drives parent required array; add/duplicate/move', () => {
    useStore.getState().createProject('t');
    const s = useStore.getState();
    s.addField(cur().root.id);
    s.addField(cur().root.id);
    const [a, b] = cur().root.children;
    s.editRoot((r) => { r.children[0].required = true; });
    expect(buildSchema(cur()).schema.required).toEqual(['newField']);
    useStore.getState().moveField(b.id, a.id, 'before');
    expect(cur().root.children[0].id).toBe(b.id);
    useStore.getState().duplicateField(a.id);
    expect(cur().root.children.length).toBe(3);
  });

  it('raw mode fallback for $ref and raw edit sync', () => {
    useStore.getState().createProject('r');
    const ok = useStore.getState().loadSchemaObject({ type: 'object', properties: { a: { $ref: '#/definitions/x' } }, definitions: { x: { type: 'string' } } }, { toast: false });
    expect(ok).toBe(false);
    expect(cur().raw).toBeTruthy();
    useStore.getState().toggleRawEdit();
    useStore.getState().setRawDraft(JSON.stringify({ $schema: 'http://json-schema.org/draft-04/schema#', type: 'object', properties: { z: { type: 'string' } } }));
    expect(cur().raw).toBeNull();
    expect(cur().root.children[0].name).toBe('z');
  });
});
