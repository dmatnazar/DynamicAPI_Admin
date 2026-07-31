import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './ui/Button';

type Phase = 'idle' | 'available' | 'downloading' | 'ready';

export function UpdateModal() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    window.updaterAPI.onAvailable(({ version }) => {
      setVersion(version);
      setPhase('available');
    });
    window.updaterAPI.onProgress(({ percent }) => {
      setPhase('downloading');
      setPercent(percent);
    });
    window.updaterAPI.onDownloaded(() => setPhase('ready'));
  }, []);

  return (
    <AnimatePresence>
      {phase !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed top-4 right-4 z-50 w-96 rounded-xl border border-surface-border bg-surface-raised/95 backdrop-blur p-4 shadow-2xl shadow-black/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-100">
              {phase === 'ready' ? `v${version} ready to install` : `New version v${version} available`}
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
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
              <Button className="!px-3 !py-1.5 !text-xs" onClick={() => window.updaterAPI.download()}>
                Download & Install
              </Button>
            )}
            {phase === 'ready' && (
              <Button className="!px-3 !py-1.5 !text-xs" onClick={() => window.updaterAPI.install()}>
                Restart & Install
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
