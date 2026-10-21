"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { DEFAULT_RULES, type ScheduleRules } from "@/lib/types";
import {
  describeCycleStart,
  sortDestinatari,
} from "@/lib/schedule";

export default function GeneraPage() {
  const {
    ready,
    data,
    createProgramFromGenerator,
    regenerateAssignments,
    activeProgram,
  } = useStore();
  const router = useRouter();
  const [title, setTitle] = useState("Programma di Visite e Incoraggiamento");
  const [monthsLabel, setMonthsLabel] = useState(
    "Dicembre 2026 - Febbraio 2027"
  );
  const [startDate, setStartDate] = useState("2026-11-30");
  const [weekCount, setWeekCount] = useState(13);
  const [rules, setRules] = useState<ScheduleRules>({ ...DEFAULT_RULES });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previousProgramId, setPreviousProgramId] = useState<string>("");

  const giovani = useMemo(
    () => data.people.filter((p) => p.role === "giovane" && p.active),
    [data.people]
  );
  const destinatari = useMemo(
    () =>
      sortDestinatari(
        data.people.filter((p) => p.role === "destinatario" && p.active)
      ),
    [data.people]
  );

  const previousProgram =
    data.programs.find((p) => p.id === previousProgramId) ??
    activeProgram ??
    null;

  const visitStart = describeCycleStart(
    destinatari.filter(
      (d) => d.duties?.visiteCasa || d.duties?.visiteStruttura
    ),
    previousProgram?.visits,
    rules.continueRecipientCycle
  );
  const contactStart = describeCycleStart(
    destinatari.filter((d) => d.duties?.contatti),
    previousProgram?.contacts,
    rules.continueRecipientCycle
  );

  if (!ready) return <p>Caricamento…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Genera programma</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Usa gli incarichi definiti in Persone, continua il ciclo dei
          destinatari e abbina i giovani a caso rispettando le regole.
        </p>
      </div>

      <div className="panel space-y-4">
        <label className="grid gap-1">
          <span className="label">Titolo</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="label">Etichetta mesi</span>
          <input
            className="input"
            value={monthsLabel}
            onChange={(e) => setMonthsLabel(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="label">Data inizio (lunedì consigliato)</span>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="label">Numero settimane</span>
            <input
              type="number"
              min={1}
              max={26}
              className="input"
              value={weekCount}
              onChange={(e) => setWeekCount(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="panel space-y-3">
        <h2 className="font-display text-xl">Chi fa cosa (da Persone)</h2>
        <p className="text-sm text-[var(--muted)]">
          Modifica queste preferenze nella scheda di ogni persona. Qui vedi solo
          il riepilogo usato dal generatore.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <DutySummary
            title="Visite a casa"
            names={giovani
              .filter((g) => g.duties?.visiteCasa)
              .map((g) => g.name)}
          />
          <DutySummary
            title="Visite in struttura"
            names={giovani
              .filter((g) => g.duties?.visiteStruttura)
              .map((g) => g.name)}
          />
          <DutySummary
            title="Contatti alternativi"
            names={giovani
              .filter((g) => g.duties?.contatti)
              .map((g) => g.name)}
          />
        </div>
      </div>

      <div className="panel space-y-3">
        <h2 className="font-display text-xl">Ciclo destinatari</h2>
        <Rule
          checked={rules.continueRecipientCycle}
          onChange={(v) => setRules({ ...rules, continueRecipientCycle: v })}
          label="Continua dal primo destinatario non ancora visitato / sentito nel programma di riferimento"
        />
        <label className="grid gap-1">
          <span className="label">Programma di riferimento (ciclo precedente)</span>
          <select
            className="input"
            value={previousProgramId || activeProgram?.id || ""}
            onChange={(e) => setPreviousProgramId(e.target.value)}
          >
            {data.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.monthsLabel}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-md bg-[var(--teal-soft)] px-3 py-2 text-sm">
          <div>
            Prossima visita partirà da: <strong>{visitStart}</strong>
          </div>
          <div>
            Prossimo contatto partirà da: <strong>{contactStart}</strong>
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Ordine destinatari (cycleOrder)
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--muted)]">
            {destinatari.map((d) => (
              <li key={d.id}>
                {d.name}
                {d.cycleOrder != null ? ` (#${d.cycleOrder})` : ""}
                {" — "}
                {[
                  (d.duties?.visiteCasa || d.duties?.visiteStruttura) &&
                    "visite",
                  d.duties?.contatti && "contatti",
                ]
                  .filter(Boolean)
                  .join(", ") || "nessun tipo"}
              </li>
            ))}
          </ol>
        </details>
      </div>

      <div className="panel space-y-3">
        <h2 className="font-display text-xl">Regole di abbinamento</h2>
        <Rule
          checked={rules.randomizeYouth}
          onChange={(v) => setRules({ ...rules, randomizeYouth: v })}
          label="Combina i giovani in modo casuale (sempre rispettando le regole sotto)"
        />
        <Rule
          checked={rules.noDoubleDutySameWeek}
          onChange={(v) => setRules({ ...rules, noDoubleDutySameWeek: v })}
          label="Niente due incarichi nella stessa settimana (visita e contatto)"
        />
        <Rule
          checked={rules.skipConsecutiveWeeks}
          onChange={(v) => setRules({ ...rules, skipConsecutiveWeeks: v })}
          label="Dove possibile, salta almeno una settimana tra un incarico e il successivo"
        />
        <Rule
          checked={rules.femaleYouthOnlyVisitFemales}
          onChange={(v) =>
            setRules({ ...rules, femaleYouthOnlyVisitFemales: v })
          }
          label="Le giovani femmine visitano solo destinatari femmine"
        />
        <Rule
          checked={rules.maleYouthOnlyVisitMales}
          onChange={(v) => setRules({ ...rules, maleYouthOnlyVisitMales: v })}
          label="I giovani maschi visitano solo destinatari maschi"
        />
        <Rule
          checked={rules.sameGenderPairs}
          onChange={(v) => setRules({ ...rules, sameGenderPairs: v })}
          label="Le coppie di incaricati sono sempre stesso sesso (uomini+uomini / donne+donne) — mai misti"
        />
        <Rule
          checked={rules.malePairsForCoupleRecipients}
          onChange={(v) =>
            setRules({ ...rules, malePairsForCoupleRecipients: v })
          }
          label="Per destinatari-coppia (coniugi) preferisci due incaricati maschi"
        />
        <Rule
          checked={rules.balanceWorkload}
          onChange={(v) => setRules({ ...rules, balanceWorkload: v })}
          label="Bilancia il carico tra i giovani"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const { warnings: w } = createProgramFromGenerator({
              title,
              monthsLabel,
              startDate,
              weekCount,
              rules,
              previousProgramId:
                previousProgramId || activeProgram?.id || null,
            });
            setWarnings(w);
            router.push("/programma");
          }}
        >
          Genera e apri
        </button>
        {activeProgram && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const w = regenerateAssignments(activeProgram.id, rules, {
                previousProgramId:
                  previousProgramId ||
                  data.programs.find((p) => p.id !== activeProgram.id)?.id ||
                  null,
              });
              setWarnings(w);
              alert(
                w.length
                  ? `Rigenerato con avvisi:\n${w.join("\n")}`
                  : "Turni rigenerati sul programma attivo."
              );
              router.push("/programma");
            }}
          >
            Rigenera programma attivo
          </button>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <strong>Avvisi:</strong>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DutySummary({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </div>
      <div className="mt-1 text-sm">
        {names.length ? names.join(", ") : "Nessuno"}
      </div>
    </div>
  );
}

function Rule({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
