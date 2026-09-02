import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, LockOpen, X } from 'lucide-react';
import { EDIT_KEY } from '../config';

export default function LockPanel({
  editing,
  onUnlock,
  onLock,
}: {
  editing: boolean;
  onUnlock: () => void;
  onLock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 60);
  }, [open]);

  const submit = () => {
    if (value.trim() === EDIT_KEY) {
      onUnlock();
      setOpen(false);
      setValue('');
      setError(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 1200);
    }
  };

  return (
    <>
      <button
        type="button"
        title={editing ? 'Bearbeitung sperren' : 'Bearbeitung entsperren'}
        onClick={() => (editing ? onLock() : setOpen((v) => !v))}
        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors ${
          editing
            ? 'border-volt/60 bg-volt/10 text-volt'
            : 'border-volt/15 bg-abyss/90 text-haze/80 hover:border-volt/50 hover:text-volt'
        }`}
      >
        {editing ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {open && !editing && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            className="absolute right-12 top-0 w-[212px] rounded-lg border border-volt/15 bg-abyss/95 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="num text-[9px] uppercase tracking-[0.2em] text-sage">Editor-Key</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded p-0.5 text-sage transition-colors hover:text-haze"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              ref={input}
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Key eingeben"
              className={`num w-full rounded border bg-deep px-2 py-1.5 text-[12px] text-haze outline-none transition-colors ${
                error ? 'border-redx' : 'border-volt/20 focus:border-volt/60'
              }`}
            />
            <button
              type="button"
              onClick={submit}
              className="num mt-2 w-full cursor-pointer rounded border border-volt/50 bg-volt/10 py-1.5 text-[10px] uppercase tracking-[0.16em] text-volt transition-colors hover:bg-volt/20"
            >
              Entsperren
            </button>
            {error && <div className="num mt-1.5 text-[10px] text-redx">Falscher Key</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
