import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function TextDialog({
  onConfirm,
  onCancel,
  title = 'Text',
  placeholder = 'z. B. Chest Spot',
  confirmLabel = 'Setzen',
  allowEmpty = false,
}: {
  onConfirm: (text: string) => void;
  onCancel: () => void;
  title?: string;
  placeholder?: string;
  confirmLabel?: string;
  allowEmpty?: boolean;
}) {
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => input.current?.focus(), 50);
  }, []);

  const submit = () => {
    const t = value.trim();
    if (t || allowEmpty) onConfirm(t);
    else onCancel();
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-abyss/60" onPointerDown={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="w-[300px] rounded-lg border border-volt/20 bg-abyss p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="num mb-2 text-[9px] uppercase tracking-[0.2em] text-sage">{title}</div>
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={placeholder}
          className="w-full rounded border border-volt/20 bg-deep px-2.5 py-2 text-[13px] text-haze outline-none focus:border-volt/60"
        />
        <div className="mt-3 flex gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="num flex-1 cursor-pointer rounded border border-volt/20 py-1.5 text-[10px] uppercase tracking-[0.16em] text-haze/80 transition-colors hover:border-volt/50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            className="num flex-1 cursor-pointer rounded border border-volt/50 bg-volt/10 py-1.5 text-[10px] uppercase tracking-[0.16em] text-volt transition-colors hover:bg-volt/20"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
