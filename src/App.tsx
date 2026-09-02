import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Intro from './components/Intro';
import LockPanel from './components/LockPanel';
import MapView, { type Tool } from './components/MapView';
import TextDialog from './components/TextDialog';
import Toolbar from './components/Toolbar';
import { Norm } from './config';
import { fetchMap, type MapData } from './lib/api';
import {
  MarkColor,
  Shape,
  SpotDoc,
  downloadDoc,
  emptyDoc,
  loadDoc,
  newId,
  saveDoc,
} from './lib/spots';

export default function App() {
  const [map, setMap] = useState<MapData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [imgBroken, setImgBroken] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);

  const [doc, setDoc] = useState<SpotDoc>(emptyDoc());
  /** Verlauf der Formen-Stände seit dem letzten Speichern (für Undo) */
  const [history, setHistory] = useState<Shape[][]>([]);
  /** Stand beim letzten Speichern/Laden — Ziel des Reset-Buttons */
  const savedShapes = useRef<Shape[]>([]);
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState<Tool>('pan');
  const [color, setColor] = useState<MarkColor>('yellow');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textAt, setTextAt] = useState<Norm | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Karte laden
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

  // Markierungen laden
  useEffect(() => {
    loadDoc().then(({ doc }) => {
      setDoc(doc);
      savedShapes.current = doc.shapes;
      setHistory([]);
    });
  }, []);

  useEffect(() => {
    if (map) {
      const t = setTimeout(() => setIntroVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [map]);

  /** Änderung anwenden und für Undo festhalten */
  const mutate = useCallback((fn: (shapes: Shape[]) => Shape[], group = false) => {
    setDoc((d) => {
      setHistory((h) => {
        // Beim Ziehen nur den Stand vor der Geste festhalten
        if (group && h.length > 0 && h[h.length - 1] === d.shapes) return h;
        return [...h.slice(-99), d.shapes];
      });
      return { ...d, shapes: fn(d.shapes) };
    });
    setDirty(true);
    setSaved(false);
  }, []);

  const addShape = useCallback((s: Shape) => mutate((sh) => [...sh, s]), [mutate]);

  const moveShape = useCallback(
    (id: string, dx: number, dy: number, continuing = false) =>
      mutate(
        (sh) =>
          sh.map((s) => {
            if (s.id !== id) return s;
            if (s.type === 'rect') return { ...s, x: s.x + dx, y: s.y + dy };
            if (s.type === 'text') return { ...s, x: s.x + dx, y: s.y + dy };
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

  /** Letzte Änderung rückgängig machen */
  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setDoc((d) => ({ ...d, shapes: prev }));
      setSelectedId(null);
      setSaved(false);
      setDirty(prev !== savedShapes.current);
      return h.slice(0, -1);
    });
  }, []);

  /** Alle ungespeicherten Änderungen verwerfen */
  const resetUnsaved = useCallback(() => {
    setDoc((d) => ({ ...d, shapes: savedShapes.current }));
    setHistory([]);
    setSelectedId(null);
    setDirty(false);
    setSaved(false);
  }, []);

  // Strg+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editing) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, undo]);

  // Entf-Taste
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editing) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, deleteSelected]);

  const onSave = useCallback(async () => {
    setSaving(true);
    const res = await saveDoc(doc);
    if (!res.remote) downloadDoc(doc);
    setSaving(false);
    setSaved(res.ok);
    setDirty(!res.ok);
    if (res.ok) {
      savedShapes.current = doc.shapes;
      setHistory([]);
    }
    setToast(res.message);
    setTimeout(() => setToast(null), 4000);
    setTimeout(() => setSaved(false), 2500);
  }, [doc]);

  const retry = useCallback(() => {
    setIntroVisible(true);
    setMap(null);
    setErr(null);
    setAttempt((a) => a + 1);
  }, []);

  const mapUrl = !map || imgBroken ? null : imgIdx === 0 ? map.images.blank : map.images.pois;

  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <MapView
        mapUrl={mapUrl}
        onImgError={() => (imgIdx === 0 ? setImgIdx(1) : setImgBroken(true))}
        shapes={doc.shapes}
        editing={editing}
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

      {/* Lock rechts */}
      <div className="absolute right-4 top-4 z-30">
        <LockPanel
          editing={editing}
          onUnlock={() => setEditing(true)}
          onLock={() => {
            setEditing(false);
            setTool('pan');
            setSelectedId(null);
          }}
        />
      </div>

      <Toolbar
        visible={editing}
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        selectedId={selectedId}
        onDelete={deleteSelected}
        onUndo={undo}
        canUndo={history.length > 0}
        onReset={resetUnsaved}
        onSave={onSave}
        saving={saving}
        saved={saved}
        dirty={dirty}
        count={doc.shapes.length}
      />

      {textAt && (
        <TextDialog
          onConfirm={(text) => {
            addShape({ id: newId(), type: 'text', color, x: textAt.x, y: textAt.y, text });
            setTextAt(null);
          }}
          onCancel={() => setTextAt(null)}
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
