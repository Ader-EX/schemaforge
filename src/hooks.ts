import { useMemo } from 'react';
import { useActive, useStore } from './store';
import { buildSchema } from './model/toSchema';

/** Current schema derived from the active project's tree (or raw text). */
export function useSchema() {
  const p = useActive();
  const rawDraft = useStore((s) => s.rawDraft);
  const rawEdit = useStore((s) => s.rawEdit);
  return useMemo(() => {
    if (!p) return { schema: null as any, text: '', error: undefined as string | undefined };
    const { schema, error } = buildSchema(p);
    return { schema, text: schema ? JSON.stringify(schema, null, 2) : p.raw ?? '', error };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.root, p?.raw, p?.title, rawEdit ? rawDraft : null]);
}
