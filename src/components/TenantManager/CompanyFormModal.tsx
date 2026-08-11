import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { TenantConfig } from '../../types/endpoint.types';

export interface CompanyFormValues {
  name: string;
  fullName: string;
  phones: string[];
  address: string;
}

interface Props {
  mode: 'create' | 'edit';
  initial?: TenantConfig;
  onClose: () => void;
  onSubmit: (values: CompanyFormValues, slug?: string) => void;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function CompanyFormModal({ mode, initial, onClose, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  // TenantConfig uses legalName / phone; form UI still exposes fullName / phones[]
  const [fullName, setFullName] = useState(initial?.legalName ?? '');
  const [phones, setPhones] = useState<string[]>(initial?.phone ? [initial.phone] : ['']);
  const [address, setAddress] = useState(initial?.address ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');

  const updatePhone = (idx: number, val: string) =>
    setPhones((p) => p.map((ph, i) => (i === idx ? val : ph)));
  const addPhone = () => setPhones((p) => [...p, '']);
  const removePhone = (idx: number) => setPhones((p) => p.filter((_, i) => i !== idx));

  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const cleanedPhones = phones.map((p) => p.trim()).filter(Boolean);
    onSubmit(
      { name: name.trim(), fullName: fullName.trim(), phones: cleanedPhones, address: address.trim() },
      mode === 'create' ? slug.trim() || slugify(name) : undefined
    );
  };

  return (
    <Modal
      title={mode === 'create' ? 'Täze kompaniýa goş' : 'Kompaniýa maglumatyny üýtget'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Ýatyr
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {mode === 'create' ? 'Goş' : 'Ýatda sakla'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Ady (gysga)</label>
          <input
            className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm"
            placeholder="Mysal: Demo Company"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Doly ady</label>
          <input
            className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm"
            placeholder="Mysal: 'Demo Company' Hojalyk jemgyýeti"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
      </div>

      {mode === 'create' && (
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Slug (islege görä, boş goýsaň özi dörär)</label>
          <input
            className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
            placeholder="demo-company"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Telefon belgileri</label>
        <div className="space-y-2">
          {phones.map((ph, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="flex-1 bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
                placeholder="+993 6X XXXXXX"
                value={ph}
                onChange={(e) => updatePhone(idx, e.target.value)}
              />
              <button
                onClick={() => removePhone(idx)}
                className="shrink-0 text-neutral-500 hover:text-red-400 p-1.5"
                title="Aýyr"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={addPhone}>
            <Plus size={13} className="inline -mt-0.5 mr-1" />
            Telefon goş
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Salgysy</label>
        <textarea
          className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm"
          rows={2}
          placeholder="Şäher, köçe, jaý belgisi..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
    </Modal>
  );
}
