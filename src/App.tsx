import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, MessageSquarePlus } from 'lucide-react';
import Intro from './components/Intro';
import LockPanel from './components/LockPanel';
import MapView, { type Tool } from './components/MapView';
import RequestPanel from './components/RequestPanel';
import SetupGuide from './components/SetupGuide';
import TextDialog from './components/TextDialog';
import Toolbar from './components/Toolbar';
import { EDIT_KEY, Norm } from './config';
import { fetchMap, type MapData } from './lib/api';
import {
  MarkColor,
  Shape,
  SpotDoc,
  SpotRequest,
  emptyDoc,
  loadDoc,
  loadRequests,
  newId,
  rejectAllRequests,
  rejectRequest,
  removeRequest,
  saveDoc,
  submitRequest,
} from './lib/spots';
import { pushPreview } from './lib/renderPreview';

type Mode = 'view' | 'edit' | 'request';

export default function App() {
  const [map, setMap] = useState<MapData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [imgBroken, setImgBroken] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);

  const [doc, setDoc] = useState<SpotDoc>(emptyDoc());
  const [history, setHistory] = useState<Shape[][]>([]);
  const savedShapes = useRef<Shape[]>([]);

  const [mode, setMode] = useState<Mode>('view');
  const [tool, setTool] = useState<Tool>('pan');
  const [color, setColor] = useState<MarkColor>('yellow');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textAt, setTextAt] = useState<Norm | null>(null);

  // Request-Modus
  const [draftShapes, setDraftShapes] = useState<Shape[]>([]);
  const [draftHistory, setDraftHistory] = useState<Shape[][]>([]);
  const [noteOpen, setNoteOpen] = useState(false);

  // Anfragen-Verwaltung
  const [requests, setRequests] = useState<SpotRequest[]>([]);
  const [reqOpen, setReqOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [reqBusy, setReqBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  /** aktuelle Karten-URL (auch in Callbacks nutzbar) */
  const currentMapUrl = () =>
    !map || imgBroken ? null : imgIdx === 0 ? map.images.blank : map.images.pois;

  /** Discord-Vorschau manuell hochladen */
  const uploadPreview = useCallback(async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const ok = await pushPreview(doc.shapes, currentMapUrl(), EDIT_KEY);
      flash(ok ? 'Karte an Discord gesendet' : 'Upload fehlgeschlagen');
    } catch {
      flash('Upload fehlgeschlagen');
    }
    setUploading(false);
  }, [doc, uploading]);

  useEffect(() => {
    const ac = new AbortController();
    setErr(null);
    fetchMap(ac.signal)
      .then(setMap)
      .catch(() => {
        if (!ac.signal.aborted) setErr('Karte nicht erreichbar');
      });
    return () => ac.abort();
  }, [attempt]);

  const refreshDoc = useCallback(async () => {
    const { doc: fresh } = await loadDoc();
    setDoc(fresh);
    savedShapes.current = fresh.shapes;
    setHistory([]);
  }, []);

  useEffect(() => {
    refreshDoc();
  }, [refreshDoc]);

  // Besucher sehen veroeffentlichte Aenderungen ohne Neuladen. Waehrend des
  // Bearbeitens wird nicht aktualisiert, damit nichts ueberschrieben wird.
  useEffect(() => {
    if (mode !== 'view') return;
    const timer = window.setInterval(refreshDoc, 20000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshDoc();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mode, refreshDoc]);

  useEffect(() => {
    if (map) {
      const t = setTimeout(() => setIntroVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [map]);

  const refreshRequests = useCallback(async () => {
    setReqBusy(true);
    const result = await loadRequests();
    setRequests(result.requests);
    if (result.error) {
      setToast(result.error);
      setTimeout(() => setToast(null), 5000);
    }
    setReqBusy(false);
  }, []);

  useEffect(() => {
    if (mode === 'edit') refreshRequests();
  }, [mode, refreshRequests]);

  // Neue Anfragen anderer Besucher erscheinen automatisch. Auch nach dem
  // Zurueckkehren in den Tab wird sofort aktualisiert.
  useEffect(() => {
    if (mode !== 'edit') return;
    const timer = window.setInterval(refreshRequests, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshRequests();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mode, refreshRequests]);

  const isRequest = mode === 'request';
  const editing = mode === 'edit' || isRequest;

  // ── Formen bearbeiten ──
  const mutate = useCallback(
    (fn: (shapes: Shape[]) => Shape[], group = false) => {
      if (isRequest) {
        setDraftShapes((cur) => {
          setDraftHistory((h) => (group && h.length && h[h.length - 1] === cur ? h : [...h.slice(-99), cur]));
          return fn(cur);
        });
        return;
      }
      setDoc((d) => {
        setHistory((h) => (group && h.length && h[h.length - 1] === d.shapes ? h : [...h.slice(-99), d.shapes]));
        return { ...d, shapes: fn(d.shapes) };
      });
      setDirty(true);
      setSaved(false);
    },
    [isRequest]
  );

  const addShape = useCallback((s: Shape) => mutate((sh) => [...sh, s]), [mutate]);

  const moveShape = useCallback(
    (id: string, dx: number, dy: number, continuing = false) =>
      mutate(
        (sh) =>
          sh.map((s) => {
            if (s.id !== id) return s;
            if (s.type === 'rect' || s.type === 'text') return { ...s, x: s.x + dx, y: s.y + dy };
            return { ...s, points: s.points.map((q) => ({ x: q.x + dx, y: q.y + dy })) };
          }),
        continuing
      ),
    [mutate]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    mutate((sh) => sh.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, mutate]);

  const undo = useCallback(() => {
    if (isRequest) {
      setDraftHistory((h) => {
        if (!h.length) return h;
        setDraftShapes(h[h.length - 1]);
        setSelectedId(null);
        return h.slice(0, -1);
      });
      return;
    }
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setDoc((d) => ({ ...d, shapes: prev }));
      setSelectedId(null);
      setSaved(false);
      setDirty(prev !== savedShapes.current);
      return h.slice(0, -1);
    });
  }, [isRequest]);

  const resetUnsaved = useCallback(() => {
    if (isRequest) {
      setDraftShapes([]);
      setDraftHistory([]);
    } else {
      setDoc((d) => ({ ...d, shapes: savedShapes.current }));
      setHistory([]);
      setDirty(false);
    }
    setSelectedId(null);
    setSaved(false);
  }, [isRequest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editing) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, deleteSelected, undo]);

  // ── Speichern / Abschicken ──
  const onSave = useCallback(async () => {
    if (isRequest) {
      setNoteOpen(true);
      return;
    }
    setSaving(true);
    const res = await saveDoc(doc, EDIT_KEY);
    setSaving(false);
    setSaved(res.ok);
    setDirty(!res.ok);
    if (res.ok) {
      // Den vom Server bestaetigten Stand uebernehmen — genau das sehen alle
      const published = res.doc ?? doc;
      setDoc(published);
      savedShapes.current = published.shapes;
      setHistory([]);
    }
    flash(res.message);
    setTimeout(() => setSaved(false), 2500);
  }, [doc, isRequest]);

  const sendRequest = useCallback(
    async (note: string) => {
      setNoteOpen(false);
      setSaving(true);
      const res = await submitRequest(draftShapes, note);
      setSaving(false);
      flash(res.message);
      if (!res.ok) return;
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setDraftShapes([]);
        setDraftHistory([]);
        setMode('view');
        setTool('pan');
      }, 900);
    },
    [draftShapes]
  );

  // ── Anfragen verwalten ──
  const acceptRequest = useCallback(
    async (r: SpotRequest) => {
      setReqBusy(true);
      const merged = [...doc.shapes, ...r.shapes.map((s) => ({ ...s, id: newId() }))];
      const next = { ...doc, shapes: merged };
      const res = await saveDoc(next, EDIT_KEY);
      if (res.ok) {
        const published = res.doc ?? next;
        setDoc(published);
        savedShapes.current = published.shapes;
        setHistory([]);
        setDirty(false);
        const removed = await removeRequest(r.id, EDIT_KEY);
        if (removed) {
          setRequests((list) => list.filter((x) => x.id !== r.id));
          if (previewId === r.id) setPreviewId(null);
          flash('Anfrage übernommen');
        } else {
          flash('Änderung gespeichert · Anfrage konnte nicht entfernt werden');
        }
      } else {
        flash(res.message);
      }
      setReqBusy(false);
    },
    [doc, previewId]
  );

  const declineRequest = useCallback(
    async (r: SpotRequest) => {
      setReqBusy(true);
      const ok = await rejectRequest(r.id, EDIT_KEY);
      if (!ok) {
        setReqBusy(false);
        flash('Anfrage konnte nicht abgelehnt werden');
        return;
      }
      setRequests((list) => list.filter((x) => x.id !== r.id));
      if (previewId === r.id) setPreviewId(null);
      setReqBusy(false);
      flash('Anfrage abgelehnt');
    },
    [previewId]
  );

  const declineAll = useCallback(async () => {
    setReqBusy(true);
    const ok = await rejectAllRequests(EDIT_KEY);
    if (!ok) {
      setReqBusy(false);
      flash('Anfragen konnten nicht abgelehnt werden');
      return;
    }
    setRequests([]);
    setPreviewId(null);
    setReqBusy(false);
    flash('Alle Anfragen abgelehnt');
  }, []);

  const retry = useCallback(() => {
    setIntroVisible(true);
    setMap(null);
    setErr(null);
    setAttempt((a) => a + 1);
  }, []);

  // ── Was wird angezeigt? ──
  const preview = requests.find((r) => r.id === previewId) ?? null;
  const editShapes = preview ? preview.shapes : isRequest ? draftShapes : doc.shapes;
  const baseShapes = preview ? [] : isRequest ? doc.shapes : [];
  const interactive = editing && !preview;

  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <MapView
        mapUrl={currentMapUrl()}
        onImgError={() => (imgIdx === 0 ? setImgIdx(1) : setImgBroken(true))}
        baseShapes={baseShapes}
        shapes={editShapes}
        editing={interactive}
        tool={tool}
        color={color}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addShape}
        onMove={moveShape}
        onRequestText={setTextAt}
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2.5"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-volt/15 bg-abyss/90">
          <svg viewBox="0 0 64 64" className="h-5 w-5">
            <path d="M32 8 C22 8 15 15 15 25 C15 37 32 56 32 56 C32 56 49 37 49 25 C49 15 42 8 32 8 Z" fill="#45ff8f" />
            <circle cx="32" cy="25" r="7" fill="#02100a" />
          </svg>
        </div>
        <div className="font-disp text-sm font-semibold tracking-[0.2em] text-haze">DROPSPOTS</div>
      </motion.div>

      {/* Rechte Buttons */}
      <div className="absolute right-4 top-4 z-30 flex flex-col items-end gap-1.5">
        {/* Request-Button für Besucher */}
        {mode !== 'edit' && (
          <div className="relative">
            <button
              type="button"
              title={isRequest ? 'Anfrage-Modus beenden' : 'Änderung vorschlagen'}
              onClick={() => {
                if (isRequest) {
                  setMode('view');
                  setTool('pan');
                  setDraftShapes([]);
                  setDraftHistory([]);
                } else {
                  setMode('request');
                  setTool('rect');
                }
                setSelectedId(null);
              }}
              className={`flex h-9 items-center gap-2 rounded-md border px-3 transition-colors ${
                isRequest
                  ? 'cursor-pointer border-volt/60 bg-volt/10 text-volt'
                  : 'cursor-pointer border-volt/15 bg-abyss/90 text-haze/80 hover:border-volt/50 hover:text-volt'
              }`}
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span className="num text-[10px] uppercase tracking-[0.16em]">Request</span>
            </button>
          </div>
        )}

        {/* Anfragen-Posteingang für Editoren */}
        {mode === 'edit' && (
          <div className="relative">
            <RequestPanel
              open={reqOpen}
              onToggle={() => setReqOpen((v) => !v)}
              requests={requests}
              previewId={previewId}
              onPreview={setPreviewId}
              onAccept={acceptRequest}
              onReject={declineRequest}
              onRejectAll={declineAll}
              onRefresh={refreshRequests}
              busy={reqBusy}
            />
          </div>
        )}

        {/* Lock unterhalb */}
        <div className="relative">
          <LockPanel
            editing={mode === 'edit'}
            onUnlock={() => {
              setMode('edit');
              setDraftShapes([]);
              setDraftHistory([]);
              setSelectedId(null);
            }}
            onLock={() => {
              setMode('view');
              setTool('pan');
              setSelectedId(null);
              setPreviewId(null);
              setReqOpen(false);
            }}
          />
        </div>

        {/* Setup-Tutorial */}
        <button
          type="button"
          title="Setup Tutorial öffnen"
          onClick={() => setGuideOpen(true)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-volt/15 bg-abyss/90 text-haze/80 transition-colors hover:border-volt/50 hover:text-volt"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      <SetupGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      <Toolbar
        visible={editing && !preview}
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        selectedId={selectedId}
        onDelete={deleteSelected}
        onUndo={undo}
        canUndo={(isRequest ? draftHistory : history).length > 0}
        onReset={resetUnsaved}
        onSave={onSave}
        saving={saving}
        saved={saved}
        dirty={isRequest ? draftShapes.length > 0 : dirty}
        count={editShapes.length}
        onUpload={uploadPreview}
        uploading={uploading}
        requestMode={isRequest}
        onCancelRequest={() => {
          setMode('view');
          setTool('pan');
          setDraftShapes([]);
          setDraftHistory([]);
          setSelectedId(null);
        }}
      />

      {/* Hinweisleiste */}
      {(isRequest || preview) && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-md border border-volt/25 bg-abyss/95 px-3 py-2">
          <span className="num text-[10px] uppercase tracking-[0.16em] text-haze/85">
            {preview
              ? `Vorschau: ${preview.note || 'Anfrage'} · nur diese Änderung`
              : 'Anfrage-Modus · deine Änderungen werden erst nach Freigabe sichtbar'}
          </span>
        </div>
      )}

      {textAt && (
        <TextDialog
          onConfirm={(text) => {
            addShape({ id: newId(), type: 'text', color, x: textAt.x, y: textAt.y, text });
            setTextAt(null);
          }}
          onCancel={() => setTextAt(null)}
        />
      )}

      {noteOpen && (
        <TextDialog
          title="Beschreibung der Anfrage"
          placeholder="z. B. Neuer Chest-Spot am Turm"
          confirmLabel="Abschicken"
          allowEmpty
          onConfirm={sendRequest}
          onCancel={() => setNoteOpen(false)}
        />
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute bottom-4 left-4 z-40 rounded-md border border-volt/25 bg-abyss/95 px-3 py-2"
        >
          <span className="num text-[10px] uppercase tracking-[0.16em] text-haze/85">{toast}</span>
        </motion.div>
      )}

      <Intro show={introVisible} error={err} onRetry={retry} />
    </div>
  );
}
