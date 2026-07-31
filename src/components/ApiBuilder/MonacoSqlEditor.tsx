import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { useCallback } from 'react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  availableParams: string[]; // e.g. ["@branchID", "@startDate", "@limit"]
}

export function MonacoSqlEditor({ value, onChange, availableParams }: Props) {
  const beforeMount: BeforeMount = useCallback((monaco) => {
    monaco.editor.defineTheme('linear-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.sql', foreground: 'C792EA', fontStyle: 'bold' },
        { token: 'string.sql', foreground: 'ADE787' },
        { token: 'comment.sql', foreground: '6B7280', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#0D0F14',
        'editor.foreground': '#E5E7EB',
        'editorLineNumber.foreground': '#3F3F46',
        'editor.lineHighlightBackground': '#161922',
        'editorCursor.foreground': '#22D3EE',
        'editor.selectionBackground': '#1E293B',
      },
    });
  }, []);

  const onMount: OnMount = useCallback(
    (_editor, monaco) => {
      monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['@'],
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: availableParams.map((p) => ({
              label: p,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: p.replace('@', ''),
              range,
              detail: 'Mapped API parameter',
            })),
          };
        },
      });
    },
    [availableParams]
  );

  return (
    <div className="rounded-lg overflow-hidden border border-surface-border">
      <Editor
        height="320px"
        language="sql"
        theme="linear-dark"
        value={value}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(v) => onChange(v ?? '')}
        options={{
          fontSize: 13,
          fontFamily: 'JetBrains Mono, monospace',
          minimap: { enabled: false },
          padding: { top: 12 },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'gutter',
          automaticLayout: true,
        }}
      />
    </div>
  );
}
