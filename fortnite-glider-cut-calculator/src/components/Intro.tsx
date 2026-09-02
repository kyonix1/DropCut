import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

export default function Intro({
  show,
  error,
  onRetry,
}: {
  show: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-abyss"
        >
          <div className="flex flex-col items-center px-6 text-center">
            <svg viewBox="0 0 64 64" className="mb-6 h-12 w-12">
              <path d="M12 37 L32 21 L52 37 L32 31 Z" fill="#45ff8f" />
              <path d="M32 31 L32 49" stroke="#a9ffcd" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="4 5" />
              <circle cx="32" cy="53" r="3.5" fill="#45ff8f" />
            </svg>

            <div className="font-disp text-2xl font-semibold tracking-[0.28em] text-haze">
              DROP<span className="text-volt">CUT</span>
            </div>
            <p className="num mt-2 text-[10px] uppercase tracking-[0.3em] text-sage">
              Spot · Bus-Route · Glider-Cut
            </p>

            <div className="panel mt-8 flex min-w-[280px] items-center justify-center gap-3 rounded-md px-5 py-3">
              {error ? (
                <>
                  <TriangleAlert className="h-4 w-4 text-redx" />
                  <span className="num text-[11px] uppercase tracking-[0.16em] text-redx">{error}</span>
                  <button
                    onClick={onRetry}
                    className="ml-1 flex cursor-pointer items-center gap-1 rounded border border-volt/40 px-2 py-1 text-volt transition-colors hover:bg-volt/10"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="num text-[10px] uppercase tracking-widest">Retry</span>
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-volt" />
                  <span className="num text-[11px] uppercase tracking-[0.16em] text-sage">
                    Lade Karte von fortnite-api.com
                  </span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
