import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, MSSQL } from '@codemirror/lang-sql';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';

interface Props {
  value: string;
  onChange: (val: string) => void;
  availableParams: string[]; // e.g. ["@branchID", "@startDate", "@limit"]
}

// Matches the "linear-dark" Monaco theme this replaces, built from the same
// surface/accent tokens used across the rest of the app (tailwind.config.js).
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
  // "@" triggers a completion list of every param mapped in URL/Query/Body,
  // same UX as the previous Monaco provideCompletionItems implementation.
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

  return (
    <div className="rounded-lg overflow-hidden border border-surface-border">
      <CodeMirror
        value={value}
        height="320px"
        theme={editorTheme}
        extensions={[
          sql({ dialect: MSSQL, upperCaseKeywords: true }),
          autocompletion({ override: [paramCompletionSource] }),
        ]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          autocompletion: true,
        }}
        onChange={(v) => onChange(v)}
      />
    </div>
  );
}
