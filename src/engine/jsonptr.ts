export type Ptr = (string | number)[];
export const getAt = (o: any, ptr: Ptr) => ptr.reduce((a, k) => (a == null ? undefined : a[k]), o);
export const setAt = (o: any, ptr: Ptr, v: any) => {
  const p = getAt(o, ptr.slice(0, -1));
  if (p != null) p[ptr[ptr.length - 1]] = v;
};
export const delAt = (o: any, ptr: Ptr) => {
  const p = getAt(o, ptr.slice(0, -1));
  if (p == null) return;
  const k = ptr[ptr.length - 1];
  if (Array.isArray(p)) p.splice(Number(k), 1);
  else delete p[k];
};
export const clone = <T,>(x: T): T => structuredClone(x);
export const toPointer = (ptr: Ptr) => ptr.map((k) => '/' + String(k).replace(/~/g, '~0').replace(/\//g, '~1')).join('');
export const fromPointer = (s: string): Ptr =>
  s === '' || s === '/' ? [] : s.split('/').slice(1).map((x) => x.replace(/~1/g, '/').replace(/~0/g, '~')).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
