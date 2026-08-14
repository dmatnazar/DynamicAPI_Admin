import { CodeMirrorSqlEditor } from './CodeMirrorSqlEditor';

interface Props {
  value: string;
  onChange: (val: string) => void;
  availableParams: string[];
}

export function MonacoSqlEditor(props: Props) {
  return <CodeMirrorSqlEditor {...props} />;
}
