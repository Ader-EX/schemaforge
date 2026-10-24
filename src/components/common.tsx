import { forwardRef, ReactNode, useEffect, useImperativeHandle, useRef, useState } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { useStore } from '../store';

export interface EditorHandle {
  /** select + scroll to the line containing offset `from` */
  select: (from: number, to: number) => void;
}
interface Props {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  label: string;
}

export const CodeEditor = forwardRef<EditorHandle, Props>(({ value, onChange, readOnly, label }, ref) => {
  const view = useRef<EditorView | null>(null);
  const theme = useStore((s) => s.theme);
  useImperativeHandle(ref, () => ({
    select(from, to) {
      const v = view.current;
      if (!v) return;
      const a = v.state.doc.lineAt(Math.min(from, v.state.doc.length));
      const b = v.state.doc.lineAt(Math.min(to, v.state.doc.length));
      v.dispatch({ selection: { anchor: a.from, head: b.to }, effects: EditorView.scrollIntoView(a.from, { y: 'center' }) });
      v.focus();
    },
  }));
  return (
    <div className="h-full min-h-0" role="group" aria-label={label}>
      <CodeMirror
        value={value}
        height="100%"
        style={{ height: '100%' }}
        theme={theme}
        readOnly={readOnly}
        editable={!readOnly}
        onChange={onChange}
        extensions={[json(), EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': label })]}
        onCreateEditor={(v) => { view.current = v; }}
        basicSetup={{ foldGutter: true, highlightActiveLine: !readOnly }}
      />
    </div>
  );
});

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[90vh] w-full flex-col rounded-lg border border-slate-300 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        <div className="min-h-0 overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function NumInput({ value, onChange, label, placeholder }: { value: number | undefined; onChange: (v: number | undefined) => void; label: string; placeholder?: string }) {
  return (
    <input
      className="input" type="number" aria-label={label} placeholder={placeholder ?? label} value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

export function Check({ checked, onChange, label, className = '' }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-1 text-xs ${className}`}>
      <input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** text input that commits on blur/Enter (for values needing parsing) */
export function CommitInput({ value, onCommit, label, placeholder, mono }: { value: string; onCommit: (v: string) => void; label: string; placeholder?: string; mono?: boolean }) {
  const [t, setT] = useState(value);
  useEffect(() => setT(value), [value]);
  return (
    <input
      className={`input ${mono ? 'font-mono' : ''}`} aria-label={label} placeholder={placeholder} value={t}
      onChange={(e) => setT(e.target.value)} onBlur={() => t !== value && onCommit(t)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function download(name: string, text: string, mime = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function copy(text: string, toast: (m: string, k?: any) => void) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch {
    toast('Copy failed — select the text manually', 'err');
  }
}

export function readFile(accept: string, cb: (text: string) => void) {
  const i = document.createElement('input');
  i.type = 'file';
  i.accept = accept;
  i.onchange = () => i.files?.[0]?.text().then(cb);
  i.click();
}
