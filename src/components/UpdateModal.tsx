import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/Button';

type Phase = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

export function UpdateModal() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState<string | undefined>();
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.updaterAPI.onAvailable(({ version, releaseNotes }) => {
      setVersion(version);
      setNotes(releaseNotes);
      setPhase('available');
    });
    window.updaterAPI.onProgress(({ percent }) => {
      setPhase('downloading');
      setPercent(percent);
    });
    window.updaterAPI.onDownloaded(({ version, releaseNotes }) => {
      setVersion(version);
      if (releaseNotes) setNotes(releaseNotes);
      setPhase('ready');
    });
    window.updaterAPI.onError?.(({ message }) => {
      setError(message);
      setPhase('error');
    });
  }, []);

  if (phase === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="fixed top-4 right-4 z-50 w-[22rem] rounded-xl border border-surface-border bg-surface-raised/95 backdrop-blur p-4 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-100">
              {phase === 'ready' && `v${version} taýýar — restart gerek`}
              {phase === 'available' && `Täze wersiýa v${version}`}
              {phase === 'downloading' && `Ýüklenýär… ${percent}%`}
              {phase === 'error' && 'Update ýalňyşlygy'}
            </p>
            {notes && phase !== 'error' && (
              <p className="mt-1 text-[11px] text-neutral-400 whitespace-pre-wrap max-h-24 overflow-y-auto">
                {notes}
              </p>
            )}
            {phase === 'error' && error && (
              <p className="mt-1 text-[11px] text-rose-400 break-words">{error}</p>
            )}
          </div>
          <button
            type="button"
            className="text-neutral-500 hover:text-neutral-200 shrink-0"
            onClick={() => setPhase('idle')}
            title="Ýap"
          >
            <X size={14} />
          </button>
        </div>

        {phase === 'downloading' && (
          <div className="mt-3 h-1.5 w-full rounded-full bg-surface-card overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500"
              animate={{ width: `${percent}%` }}
              transition={{ ease: 'easeOut' }}
            />
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2">
          {phase === 'available' && (
            <Button
              className="!px-3 !py-1.5 !text-xs"
              onClick={() => {
                setPhase('downloading');
                setPercent(0);
                void window.updaterAPI.download();
              }}
            >
              <Download size={12} className="inline mr-1 -mt-0.5" />
              Ýükle we install et
            </Button>
          )}
          {phase === 'ready' && (
            <Button className="!px-3 !py-1.5 !text-xs" onClick={() => window.updaterAPI.install()}>
              <RefreshCw size={12} className="inline mr-1 -mt-0.5" />
              Restart & Install
            </Button>
          )}
          {phase === 'error' && (
            <Button
              variant="secondary"
              className="!px-3 !py-1.5 !text-xs"
              onClick={() => {
                setPhase('idle');
                setError(null);
                void window.updaterAPI.check();
              }}
            >
              Täzeden synanyş
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
