import { motion } from 'framer-motion';

export default function TopBar() {
  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2.5"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-volt/15 bg-abyss/90">
        <svg viewBox="0 0 64 64" className="h-5 w-5">
          <path d="M12 37 L32 21 L52 37 L32 31 Z" fill="#45ff8f" />
          <path d="M32 31 L32 49" stroke="#a9ffcd" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="4 5" />
          <circle cx="32" cy="53" r="3.5" fill="#45ff8f" />
        </svg>
      </div>
      <div className="font-disp text-sm font-semibold tracking-[0.2em] text-haze">DROPCUT</div>
    </motion.header>
  );
}
