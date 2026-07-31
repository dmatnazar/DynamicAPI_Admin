import { useEffect, useRef, useState } from 'react';

// CodeMirror is loaded globally via <script> tags in index.html
// (public/vendor/codemirror/codemirror.min.js + sql.min.js), so we just
// read it off window instead of importing an npm package.
declare global {
  interface Window {
    CodeMirror: any;
  }
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  availableParams: string[]; // e.g. ["@branchID", "@startDate", "@limit"]
  autoFocus?: boolean;
  height?: string; // CSS height, e.g. "100%" or "320px"
}

export function CodeMirrorSqlEditor({ value, onChange, availableParams, autoFocus, height = '100%' }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cmRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(!!window.CodeMirror);

  // CodeMirror + the sql mode attach themselves to window.CodeMirror as soon
  // as their <script> tags execute (see index.html). In the rare case this
  // component mounts before that has happened, poll briefly.
  useEffect(() => {
    if (window.CodeMirror) {
      setReady(true);
      return;
    }
    const id = setInterval(() => {
      if (window.CodeMirror) {
        setReady(true);
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ready || !textareaRef.current || cmRef.current) return;

    const cm = window.CodeMirror.fromTextArea(textareaRef.current, {
      mode: 'text/x-mssql',
      theme: 'material-darker',
      lineNumbers: true,
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: true,
      matchBrackets: true,
      autofocus: !!autoFocus,
    });
    cm.setValue(value ?? '');
    cm.on('change', (instance: any) => {
      onChangeRef.current(instance.getValue());
    });
    cmRef.current = cm;

    // Give the editor its sizing after it's actually in the DOM.
    requestAnimationFrame(() => cm.refresh());

    return () => {
      cmRef.current = null;
      cm.toTextArea();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keep the editor in sync if `value` changes from outside (e.g. switching
  // to a different endpoint) without fighting the user's own typing.
  useEffect(() => {
    const cm = cmRef.current;
    if (!cm) return;
    if (cm.getValue() !== value) {
      const cursor = cm.getCursor();
      cm.setValue(value ?? '');
      cm.setCursor(cursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const insertParam = (param: string) => {
    const cm = cmRef.current;
    if (!cm) return;
    cm.replaceSelection(param);
    cm.focus();
  };

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg overflow-hidden border border-surface-border bg-surface-raised">
      {availableParams.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 border-b border-surface-border bg-surface-card shrink-0">
          <span className="text-[11px] text-neutral-500 mr-1">Insert param:</span>
          {availableParams.map((p) => (
            <button
              key={p}
              onClick={() => insertParam(p)}
              className="text-[11px] font-mono px-2 py-1 rounded-md bg-surface-raised border border-surface-border text-accent hover:bg-surface-border transition"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0" style={{ height }}>
        {!ready && (
          <div className="h-full flex items-center justify-center text-xs text-neutral-500">
            Editor loading…
          </div>
        )}
        <textarea ref={textareaRef} defaultValue={value} className={ready ? '' : 'hidden'} />
      </div>
    </div>
  );
}
