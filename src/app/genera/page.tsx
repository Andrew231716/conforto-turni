"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { DEFAULT_RULES, type ScheduleRules } from "@/lib/types";

export default function GeneraPage() {
  const { ready, data, createProgramFromGenerator, regenerateAssignments, activeProgram } =
    useStore();
  const router = useRouter();
  const [title, setTitle] = useState("Programma di Visite e Incoraggiamento");
  const [monthsLabel, setMonthsLabel] = useState("Dicembre 2026 - Febbraio 2027");
  const [startDate, setStartDate] = useState("2026-11-30");
  const [weekCount, setWeekCount] = useState(13);
  const [rules, setRules] = useState<ScheduleRules>({ ...DEFAULT_RULES });
  const [warnings, setWarnings] = useState<string[]>([]);

  if (!ready) return <p>Caricamento…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Genera programma</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Crea un nuovo trimestre con le regole di abbinamento che scegli tu.
          Potrai sempre modificare i turni a mano dopo.
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
        <h2 className="font-display text-xl">Regole di abbinamento</h2>
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
          label="Le coppie di incaricati sono stesso sesso (uomini+uomini / donne+donne)"
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
              const w = regenerateAssignments(activeProgram.id, rules);
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

      <p className="text-xs text-[var(--muted)]">
        Persone attive usate:{" "}
        {data.people.filter((p) => p.active && p.role === "giovane").length}{" "}
        giovani,{" "}
        {data.people.filter((p) => p.active && p.role === "destinatario").length}{" "}
        destinatari.
      </p>
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
