import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    CodeMirror: any;
  }
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  availableParams: string[];
  autoFocus?: boolean;
  height?: string;
}

export function CodeMirrorSqlEditor({
  value,
  onChange,
  availableParams,
  autoFocus,
  height = '100%',
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cmRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const paramsRef = useRef(availableParams);
  paramsRef.current = availableParams;
  const [ready, setReady] = useState(!!window.CodeMirror);

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

    const CM = window.CodeMirror;

    // Hint helper for @params
    if (CM.hint && !CM.hint.mssqlParams) {
      CM.hint.mssqlParams = (cm: any) => {
        const cur = cm.getCursor();
        const token = cm.getTokenAt(cur);
        const start = token.start;
        const end = cur.ch;
        const word = token.string.slice(0, end - start);
        const list = (paramsRef.current || [])
          .filter((p) => p.toLowerCase().includes(word.replace(/^@/, '').toLowerCase()) || p.startsWith('@') && word.startsWith('@'))
          .map((p) => (p.startsWith('@') ? p : `@${p}`));
        // Also common SQL keywords
        const kws = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ORDER BY', 'GROUP BY', 'INSERT', 'UPDATE', 'DELETE'];
        const filtered = [
          ...list,
          ...kws.filter((k) => k.toLowerCase().startsWith(word.toLowerCase())),
        ];
        return {
          list: filtered.length ? filtered : list.concat(kws),
          from: CM.Pos(cur.line, start),
          to: CM.Pos(cur.line, end),
        };
      };
    }

    const cm = CM.fromTextArea(textareaRef.current, {
      mode: 'text/x-mssql',
      theme: 'material-darker',
      lineNumbers: true,
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: true,
      matchBrackets: true,
      autofocus: !!autoFocus,
      // Important for clipboard in Electron
      inputStyle: 'textarea',
      extraKeys: {
        'Ctrl-Space': 'autocomplete',
        'Cmd-Space': 'autocomplete',
        'Ctrl-A': 'selectAll',
        'Cmd-A': 'selectAll',
        // Explicit copy/paste bindings (Electron sometimes needs these)
        'Ctrl-C': (cmInstance: any) => {
          const text = cmInstance.getSelection() || cmInstance.getValue();
          navigator.clipboard?.writeText(text);
          return true; // don't prevent default fully — allow native too
        },
        'Cmd-C': (cmInstance: any) => {
          const text = cmInstance.getSelection() || cmInstance.getValue();
          navigator.clipboard?.writeText(text);
        },
        'Ctrl-V': async (cmInstance: any) => {
          try {
            const text = await navigator.clipboard.readText();
            if (text) cmInstance.replaceSelection(text);
          } catch {
            // fall through to native paste
            return CM.Pass;
          }
        },
        'Cmd-V': async (cmInstance: any) => {
          try {
            const text = await navigator.clipboard.readText();
            if (text) cmInstance.replaceSelection(text);
          } catch {
            return CM.Pass;
          }
        },
        'Ctrl-X': (cmInstance: any) => {
          const text = cmInstance.getSelection();
          if (text) {
            navigator.clipboard?.writeText(text);
            cmInstance.replaceSelection('');
          }
        },
        'Cmd-X': (cmInstance: any) => {
          const text = cmInstance.getSelection();
          if (text) {
            navigator.clipboard?.writeText(text);
            cmInstance.replaceSelection('');
          }
        },
      },
      hintOptions: {
        completeSingle: false,
        hint: CM.hint?.mssqlParams,
      },
    });

    cm.setValue(value ?? '');
    cm.on('change', (instance: any) => {
      onChangeRef.current(instance.getValue());
    });

    // Trigger hints when typing @
    cm.on('inputRead', (instance: any, change: any) => {
      if (change.text[0] === '@' || (change.text[0] && change.text[0].includes('@'))) {
        CM.showHint?.(instance, CM.hint.mssqlParams, { completeSingle: false });
      }
    });

    cmRef.current = cm;
    requestAnimationFrame(() => {
      cm.refresh();
      cm.focus();
    });

    return () => {
      cmRef.current = null;
      try {
        cm.toTextArea();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const cm = cmRef.current;
    if (!cm) return;
    if (cm.getValue() !== value) {
      const cursor = cm.getCursor();
      cm.setValue(value ?? '');
      try {
        cm.setCursor(cursor);
      } catch {
        /* ignore */
      }
    }
  }, [value]);

  useEffect(() => {
    const cm = cmRef.current;
    if (!cm) return;
    const el = cm.getWrapperElement?.();
    if (el) {
      el.style.height = height;
      cm.refresh();
    }
  }, [height, ready]);

  return (
    <div className="h-full w-full relative" style={{ minHeight: 180 }}>
      <textarea
        ref={textareaRef}
        defaultValue={value}
        className="w-full h-full bg-surface-raised text-neutral-100 font-mono text-sm p-3"
        spellCheck={false}
        // Native fallback when CodeMirror not ready — allows paste
        onChange={(e) => {
          if (!cmRef.current) onChange(e.target.value);
        }}
        onPaste={(e) => {
          // Ensure paste works on fallback textarea
          if (!cmRef.current) {
            const text = e.clipboardData.getData('text');
            if (text) {
              // let default happen
            }
          }
        }}
      />
      {!ready && (
        <p className="absolute bottom-2 right-2 text-[10px] text-neutral-600">CodeMirror ýüklenýär…</p>
      )}
    </div>
  );
}
