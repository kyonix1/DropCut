import { AnimatePresence, motion } from 'framer-motion';
import { Check, Eye, Inbox, RefreshCw, X, XCircle } from 'lucide-react';
import type { SpotRequest } from '../lib/spots';

interface Props {
  open: boolean;
  onToggle: () => void;
  requests: SpotRequest[];
  previewId: string | null;
  onPreview: (id: string | null) => void;
  onAccept: (r: SpotRequest) => void;
  onReject: (r: SpotRequest) => void;
  onRejectAll: () => void;
  onRefresh: () => void;
  busy: boolean;
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export default function RequestPanel(p: Props) {
  return (
    <>
      <button
        type="button"
        title="Änderungsanfragen"
        onClick={p.onToggle}
        className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors ${
          p.open
            ? 'border-volt/60 bg-volt/10 text-volt'
            : 'border-volt/15 bg-abyss/90 text-haze/80 hover:border-volt/50 hover:text-volt'
        }`}
      >
        <Inbox className="h-4 w-4" />
        {p.requests.length > 0 && (
          <span className="num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-volt px-1 text-[9px] font-bold text-abyss">
            {p.requests.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {p.open && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            className="absolute right-12 top-0 max-h-[70vh] w-[262px] overflow-y-auto rounded-lg border border-volt/15 bg-abyss/95 p-3"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="num text-[9px] uppercase tracking-[0.2em] text-sage">
                Anfragen · {p.requests.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={p.onRefresh}
                  title="Neu laden"
                  className="cursor-pointer rounded p-1 text-sage transition-colors hover:text-volt"
                >
                  <RefreshCw className={`h-3 w-3 ${p.busy ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={p.onToggle}
                  className="cursor-pointer rounded p-1 text-sage transition-colors hover:text-haze"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {p.requests.length === 0 ? (
              <div className="num py-6 text-center text-[10px] uppercase tracking-[0.16em] text-sage/70">
                Keine offenen Anfragen
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {p.requests.map((r) => {
                    const active = r.id === p.previewId;
                    return (
                      <div
                        key={r.id}
                        className={`rounded-md border p-2 transition-colors ${
                          active ? 'border-volt/60 bg-volt/5' : 'border-volt/12'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[12px] text-haze/90">
                              {r.note || 'Ohne Beschreibung'}
                            </div>
                            <div className="num mt-0.5 text-[9px] text-sage">
                              {r.shapes.length} Objekt{r.shapes.length === 1 ? '' : 'e'} ·{' '}
                              {fmtDate(r.createdAt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            title={active ? 'Vorschau beenden' : 'Nur diese Anfrage anzeigen'}
                            onClick={() => p.onPreview(active ? null : r.id)}
                            className={`shrink-0 cursor-pointer rounded p-1 transition-colors ${
                              active ? 'text-volt' : 'text-sage hover:text-haze'
                            }`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => p.onAccept(r)}
                            disabled={p.busy}
                            className="num flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-volt/50 bg-volt/10 py-1 text-[9px] uppercase tracking-[0.14em] text-volt transition-colors hover:bg-volt/20 disabled:opacity-40"
                          >
                            <Check className="h-3 w-3" />
                            Annehmen
                          </button>
                          <button
                            type="button"
                            onClick={() => p.onReject(r)}
                            disabled={p.busy}
                            className="num flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-redx/40 py-1 text-[9px] uppercase tracking-[0.14em] text-redx transition-colors hover:bg-redx/10 disabled:opacity-40"
                          >
                            <X className="h-3 w-3" />
                            Ablehnen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={p.onRejectAll}
                  disabled={p.busy}
                  className="num mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-redx/40 py-1.5 text-[9px] uppercase tracking-[0.16em] text-redx transition-colors hover:bg-redx/10 disabled:opacity-40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Alle ablehnen
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
