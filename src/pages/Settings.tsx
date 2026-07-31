import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';

export function SettingsPage() {
  const [version, setVersion] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:4000');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.appAPI.getVersion().then(setVersion);
    window.vaultAPI.get('gatewayUrl').then((v) => v && setGatewayUrl(v));
  }, []);

  const save = async () => {
    await window.vaultAPI.set('gatewayUrl', gatewayUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <h2 className="text-lg font-semibold text-neutral-100">Settings</h2>

      <div className="space-y-2">
        <label className="text-sm text-neutral-300">VPS Gateway URL</label>
        <input
          className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
        />
        <Button onClick={save}>{saved ? 'Saved ✓' : 'Save'}</Button>
      </div>

      <div className="pt-4 border-t border-surface-border">
        <p className="text-xs text-neutral-500">App version: {version || '—'}</p>
      </div>
    </div>
  );
}
