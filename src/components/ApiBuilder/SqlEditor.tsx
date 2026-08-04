import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, MSSQL } from '@codemirror/lang-sql';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Copy, ClipboardPaste } from 'lucide-react';
import { copyText } from '../../lib/apiUrl';

interface Props {
  value: string;
  onChange: (val: string) => void;
  availableParams: string[];
}

const editorTheme = EditorView.theme(
  {
    '&': {
      fontSize: '13px',
      backgroundColor: '#0D0F14',
      color: '#E5E7EB',
    },
    '.cm-content': {
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      padding: '12px 0',
      caretColor: '#22D3EE',
    },
    '.cm-gutters': {
      backgroundColor: '#0D0F14',
      color: '#3F3F46',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: '#161922' },
    '.cm-activeLineGutter': { backgroundColor: '#161922' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#22D3EE' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: '#1E293B !important',
    },
    '.cm-tooltip': {
      backgroundColor: '#161922',
      border: '1px solid #22252E',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: '#1E293B',
      color: '#22D3EE',
    },
  },
  { dark: true }
);

export function SqlEditor({ value, onChange, availableParams }: Props) {
  const paramCompletionSource = useMemo(() => {
    return (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/@[\w]*/);
      if (!word || (word.from === word.to && !context.explicit)) return null;
      return {
        from: word.from,
        options: availableParams.map((p) => ({
          label: p,
          type: 'variable',
          detail: 'Mapped API parameter',
        })),
        validFor: /^@[\w]*$/,
      };
    };
  }, [availableParams]);

  const clipboardKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: 'Mod-v',
          run: (view) => {
            navigator.clipboard
              .readText()
              .then((text) => {
                if (!text) return;
                view.dispatch(view.state.replaceSelection(text));
              })
              .catch(() => {
                /* native paste may still work */
              });
            return true;
          },
        },
        {
          key: 'Mod-c',
          run: (view) => {
            const sel = view.state.sliceDoc(
              view.state.selection.main.from,
              view.state.selection.main.to
            );
            const text = sel || view.state.doc.toString();
            void navigator.clipboard.writeText(text);
            return true;
          },
        },
        {
          key: 'Mod-x',
          run: (view) => {
            const { from, to } = view.state.selection.main;
            const text = view.state.sliceDoc(from, to);
            if (!text) return false;
            void navigator.clipboard.writeText(text);
            view.dispatch({ changes: { from, to, insert: '' } });
            return true;
          },
        },
      ]),
    []
  );

  const handleCopy = async () => {
    await copyText(value);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange(value ? `${value}\n${text}` : text);
    } catch {
      /* user may use Ctrl+V */
    }
  };

  return (
    <div className="rounded-lg overflow-hidden border border-surface-border">
      <div className="flex items-center gap-1 px-2 py-1 bg-surface-raised border-b border-surface-border">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-surface-card"
          title="Copy SQL"
        >
          <Copy size={12} /> Copy
        </button>
        <button
          type="button"
          onClick={() => void handlePaste()}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-surface-card"
          title="Paste SQL"
        >
          <ClipboardPaste size={12} /> Paste
        </button>
        <span className="text-[10px] text-neutral-600 ml-auto">Ctrl+C / Ctrl+V</span>
      </div>
      <CodeMirror
        value={value}
        height="320px"
        theme={editorTheme}
        extensions={[
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          clipboardKeymap,
          sql({ dialect: MSSQL, upperCaseKeywords: true }),
          autocompletion({ override: [paramCompletionSource] }),
        ]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          autocompletion: true,
          history: true,
        }}
        onChange={(v) => onChange(v)}
      />
    </div>
  );
}
