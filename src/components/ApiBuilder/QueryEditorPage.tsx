import { useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Save, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { CodeMirrorSqlEditor } from './CodeMirrorSqlEditor';
import type { EndpointConfig } from '../../types/endpoint.types';

interface Props {
  endpoint: EndpointConfig;
  availableParams: string[];
  onSave: (sqlQuery: string) => void;
  onClose: () => void;
}

export function QueryEditorPage({ endpoint, availableParams, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(endpoint.sqlQuery);
  const [fullscreen, setFullscreen] = useState(false);
  const dirty = draft !== endpoint.sqlQuery;

  const save = () => {
    onSave(draft);
    onClose();
  };

  const requestClose = () => {
    if (dirty && !window.confirm('Ýazylan üýtgeşmeler ýitirilsin? (Save basmadyň)')) return;
    onClose();
  };

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 bg-surface flex flex-col'
          : 'flex flex-col h-full min-h-0 p-4 sm:p-6'
      }
    >
      <div className="flex flex-wrap items-center gap-2 pb-3 shrink-0">
        <Button variant="ghost" className="!px-2" onClick={requestClose} title="Yza">
          <ArrowLeft size={16} />
        </Button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-100 truncate">
            {endpoint.name || 'Adyňy ýok endpoint'} — MSSQL Query
          </h2>
          <p className="text-[11px] text-neutral-500 font-mono truncate">
            {endpoint.method} {endpoint.pathTemplate}
          </p>
        </div>
        <div className="flex-1" />
        {dirty && <span className="text-[11px] text-amber-400">Saklanmadyk üýtgeşme bar</span>}
        <Button
          variant="ghost"
          className="!px-2"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? 'Kiçelt' : 'Doly ekran'}
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </Button>
        <Button variant="secondary" onClick={requestClose}>
          <X size={14} className="inline -mt-0.5 mr-1" />
          Ýatyr
        </Button>
        <Button onClick={save} disabled={!dirty}>
          <Save size={14} className="inline -mt-0.5 mr-1" />
          Ýaz we ýap
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <CodeMirrorSqlEditor
          value={draft}
          onChange={setDraft}
          availableParams={availableParams}
          autoFocus
          height="100%"
        />
      </div>
    </div>
  );
}
