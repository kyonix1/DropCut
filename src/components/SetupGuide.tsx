import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Database,
  ExternalLink,
  HelpCircle,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  X,
} from 'lucide-react';

type Step = {
  title: string;
  target: string;
  action: string;
  warning?: string;
};

const STEPS: Step[] = [
  {
    title: '1. Discord-Webhook erstellen',
    target: 'https://discord.com/api/webhooks/...',
    action:
      'Discord öffnen → Channel-Zahnrad → Integrations → Webhooks → "New Webhook" → Name wählen → "Copy Webhook URL". Danach "Save Changes". Der neue Webhook muss genau in den gewünschten Text-Channel zeigen.',
    warning:
      'Wenn du "Integrations" nicht siehst, fehlt die Berechtigung "Manage Webhooks". Ein Admin muss dir sie geben oder den Webhook für dich anlegen.',
  },
  {
    title: '2. Blob Store mit Vercel verbinden',
    target: 'Vercel → Storage → Create Database → Blob',
    action:
      'Vercel-Projekt öffnen → links "Storage" → "Create Database" → "Blob" → Access auf "Public" stellen → Store erstellen. Danach beim Store den Tab "Projects" → "Connect to Project" → dein Dropspots-Projekt auswählen → Production und Preview aktivieren.',
    warning:
      'Ohne diese Verbindung zeigt die Website bei /api/spots und /api/requests "Vercel Blob ist nicht verbunden".',
  },
  {
    title: '3. Secrets in Vercel eintragen',
    target: 'DISCORD_WEBHOOK_URL, CRON_SECRET, EDIT_KEY',
    action:
      'Project → Settings → Environment Variables. Folgende drei Werte für Production und Preview anlegen: DISCORD_WEBHOOK_URL (komplette Webhook-URL), CRON_SECRET (längeres Passwort nur mit Buchstaben und Zahlen), EDIT_KEY (I6295jn).',
    warning:
      'Den Webhook niemals in Code, README, GitHub oder Chat veröffentlichen. Dein alter Webhook wurde bereits geteilt und muss in Discord gelöscht werden.',
  },
  {
    title: '4. Neu deployen',
    target: 'Deployments → Redeploy',
    action:
      'Nach allen Änderungen an Environment Variables oder Storage-Verbindungen unbedingt neu deployen: Deployments → neuestes Deployment → Menü (⋯) → Redeploy. Alte Deployments erhalten neue Variablen nicht nachträglich.',
  },
  {
    title: '5. Endpoint testen',
    target: 'force=1 + key',
    action:
      'Nach dem Redeploy diese Adresse öffnen: https://DEINE-DOMAIN.vercel.app/api/discord-preview?force=1&key=DEIN_CRON_SECRET. Erwartet beim ersten Mal: { "ok": true, "edited": false }. Danach muss die erste Bild-Nachricht in Discord stehen.',
  },
  {
    title: '6. Minütliche Aktualisierung starten',
    target: 'cron-job.org → Create Cronjob',
    action:
      'Auf cron-job.org kostenlos registrieren → "Create Cronjob" → URL: https://DEINE-DOMAIN.vercel.app/api/discord-preview?key=DEIN_CRON_SECRET → Request Method: GET → Schedule: Every Minute → Save.',
    warning:
      'Vercel Hobby bietet keine minütlichen Cron-Jobs. Der externe Dienst funktioniert hier völlig kostenlos und die Discord-Nachricht wird weiterhin nur bearbeitet.',
  },
];

function TutorialContent({ domain }: { domain: string }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  return (
    <div className="flex max-h-[82vh] flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="num mb-1 text-[9px] uppercase tracking-[0.24em] text-sage">
            Setup-Tutorial
          </div>
          <h2 className="m-0 text-xl font-semibold text-haze">
            Discord Map Preview einrichten
          </h2>
        </div>
        <div className="num rounded-full border border-volt/20 px-2.5 py-1 text-[10px] text-volt">
          {index + 1}/{STEPS.length}
        </div>
      </div>

      <motion.div
        key={step.title}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22 }}
        className="rounded-lg border border-volt/15 bg-deep/70 p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          {index === 0 && <MessageSquare className="h-4 w-4 text-volt" />}
          {index === 1 && <Database className="h-4 w-4 text-volt" />}
          {index === 2 && <KeyRound className="h-4 w-4 text-volt" />}
          {index === 3 && <ShieldCheck className="h-4 w-4 text-volt" />}
          {index === 4 && <Check className="h-4 w-4 text-volt" />}
          {index === 5 && <Clock className="h-4 w-4 text-volt" />}
          <span className="text-[13px] font-semibold text-haze">{step.title}</span>
        </div>

        <div className="num mb-3 overflow-x-auto rounded border border-volt/20 bg-abyss px-2.5 py-2 text-[11px] leading-relaxed text-voltsoft">
          {step.target}
        </div>
        <p className="m-0 text-[12.5px] leading-relaxed text-haze/85">{step.action}</p>

        {step.warning && (
          <div className="mt-3 rounded border border-amberx/35 bg-amberx/5 px-3 py-2.5 text-[12px] leading-relaxed text-amberx">
            Hinweis: {step.warning}
          </div>
        )}
      </motion.div>

      <div className="num mt-3 overflow-x-auto rounded border border-volt/10 bg-abyss/70 px-2.5 py-2 text-[10px] text-sage">
        Domain eingesetzt:{' '}
        {domain ? `https://${domain}` : 'https://DEINE-DOMAIN.vercel.app'}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-volt/20 px-3 py-2 text-haze/80 transition-colors hover:border-volt/50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="num text-[10px] uppercase tracking-[0.16em]">Zurück</span>
        </button>

        <button
          type="button"
          onClick={() => setIndex((value) => Math.min(STEPS.length - 1, value + 1))}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-volt/60 bg-volt/10 px-3 py-2 text-volt transition-colors hover:bg-volt/20 disabled:cursor-not-allowed disabled:border-volt/25 disabled:text-sage"
          disabled={isLast}
        >
          <span className="num text-[10px] uppercase tracking-[0.16em]">
            {isLast ? 'Fertig' : 'Weiter'}
          </span>
          {!isLast && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function SetupGuide({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [domain, setDomain] = useState('');

  useEffect(() => {
    if (!open) return;
    setDomain(window.location.host);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-abyss/85 p-4"
          onPointerDown={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="panel w-[min(760px,100%)] rounded-xl p-5"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-volt">
                <HelpCircle className="h-4 w-4" />
                <span className="num text-[9px] uppercase tracking-[0.24em]">
                  Alles im richtigen Ablauf
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex cursor-pointer items-center justify-center rounded-md border border-volt/20 p-1.5 text-haze/80 transition-colors hover:border-volt/60"
                title="Tutorial schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <TutorialContent domain={domain} />

            <a
              href="https://cron-job.org"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-volt transition-colors hover:underline"
            >
              Externen Minuten-Cron auf cron-job.org öffnen <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
