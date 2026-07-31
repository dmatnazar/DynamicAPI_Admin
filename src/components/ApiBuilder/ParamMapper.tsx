import { Plus, Trash2 } from 'lucide-react';
import type { ParamDef } from '../../types/endpoint.types';
import { Button } from '../ui/Button';

interface Props {
  title: string;
  hint: string;
  params: ParamDef[];
  onChange: (params: ParamDef[]) => void;
}

const TYPES: ParamDef['type'][] = ['int', 'bigint', 'date', 'datetime', 'nvarchar', 'bit', 'float'];

export function ParamMapper({ title, hint, params, onChange }: Props) {
  const addParam = () => {
    onChange([...params, { name: '', sqlParam: '@', type: 'nvarchar', required: false }]);
  };

  const updateParam = (idx: number, patch: Partial<ParamDef>) => {
    onChange(params.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removeParam = (idx: number) => {
    onChange(params.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-lg border border-surface-border bg-surface-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-medium text-neutral-100">{title}</h4>
          <p className="text-xs text-neutral-500">{hint}</p>
        </div>
        <Button variant="ghost" onClick={addParam} className="!p-1.5">
          <Plus size={16} />
        </Button>
      </div>

      <div className="space-y-2">
        {params.map((p, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <input
              className="col-span-3 bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-xs text-neutral-100"
              placeholder="paramName"
              value={p.name}
              onChange={(e) => updateParam(idx, { name: e.target.value })}
            />
            <input
              className="col-span-3 bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-xs font-mono text-accent"
              placeholder="@sqlVar"
              value={p.sqlParam}
              onChange={(e) => updateParam(idx, { sqlParam: e.target.value })}
            />
            <select
              className="col-span-2 bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-xs text-neutral-100"
              value={p.type}
              onChange={(e) => updateParam(idx, { type: e.target.value as ParamDef['type'] })}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="col-span-2 flex items-center gap-1.5 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={p.required}
                onChange={(e) => updateParam(idx, { required: e.target.checked })}
              />
              required
            </label>
            <button
              onClick={() => removeParam(idx)}
              className="col-span-2 flex items-center justify-center text-neutral-500 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {params.length === 0 && (
          <p className="text-xs text-neutral-600 italic">No parameters mapped yet.</p>
        )}
      </div>
    </div>
  );
}
