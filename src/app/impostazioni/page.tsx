"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";

export default function ImpostazioniPage() {
  const {
    ready,
    data,
    setSettings,
    exportJson,
    importJson,
    resetSeed,
    setActiveProgram,
    deleteProgram,
    duplicateProgram,
    updateProgram,
  } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  if (!ready) return <p>Caricamento…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Impostazioni</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Calendario, prefisso telefonico e backup dei dati (salvati nel browser).
        </p>
      </div>

      <div className="panel space-y-4">
        <h2 className="font-display text-lg">Calendario</h2>
        <label className="grid gap-1">
          <span className="label">Modalità link</span>
          <select
            className="input"
            value={data.settings.calendarMode}
            onChange={(e) =>
              setSettings({
                calendarMode: e.target.value as "own" | "calendarlink",
              })
            }
          >
            <option value="own">
              Pagina interna dell&apos;app (consigliato)
            </option>
            <option value="calendarlink">
              Smart Link CalendarLink.com
            </option>
          </select>
        </label>
        {data.settings.calendarMode === "calendarlink" && (
          <label className="grid gap-1">
            <span className="label">Collection ID CalendarLink</span>
            <input
              className="input font-mono text-xs"
              value={data.settings.calendarlinkCollectionId}
              onChange={(e) =>
                setSettings({ calendarlinkCollectionId: e.target.value })
              }
            />
          </label>
        )}
        <label className="grid gap-1">
          <span className="label">Timezone</span>
          <select
            className="input"
            value={data.settings.timezone}
            onChange={(e) => setSettings({ timezone: e.target.value })}
          >
            {[
              "Europe/Rome",
              "Europe/Zurich",
              "Europe/Paris",
              "Europe/Berlin",
              "Europe/London",
              "UTC",
            ].map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--muted)]">
            Usata nei link calendario e nei file .ics.
          </span>
        </label>
        <label className="grid gap-1">
          <span className="label">Prefisso paese WhatsApp</span>
          <input
            className="input"
            value={data.settings.defaultCountryCode}
            onChange={(e) =>
              setSettings({
                defaultCountryCode: e.target.value.replace(/\D/g, ""),
              })
            }
          />
        </label>
      </div>

      <div className="panel space-y-3">
        <h2 className="font-display text-lg">Programmi salvati</h2>
        {data.programs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nessun programma.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
            {data.programs.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  {renamingId === p.id ? (
                    <input
                      className="input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      aria-label="Nuovo nome programma"
                    />
                  ) : (
                    <>
                      <div className="font-medium">
                        {p.monthsLabel || p.title}
                        {p.id === data.activeProgramId && (
                          <span className="ml-2 text-xs text-[var(--teal)]">
                            (attivo)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {p.title} · {p.weeks.length} periodi
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {renamingId === p.id ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary !px-2 !py-1 text-xs"
                        onClick={() => {
                          const label = renameValue.trim();
                          if (!label) return;
                          updateProgram(p.id, { monthsLabel: label });
                          setRenamingId(null);
                        }}
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs"
                        onClick={() => setRenamingId(null)}
                      >
                        Annulla
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs"
                        onClick={() => setActiveProgram(p.id)}
                        disabled={p.id === data.activeProgramId}
                      >
                        Attiva
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs"
                        onClick={() => {
                          setRenamingId(p.id);
                          setRenameValue(p.monthsLabel || p.title);
                        }}
                      >
                        Rinomina
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs"
                        onClick={() => {
                          duplicateProgram(p.id);
                        }}
                      >
                        Duplica
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs text-red-700"
                        onClick={() => {
                          if (
                            confirm(
                              `Eliminare «${p.monthsLabel || p.title}»?`
                            )
                          ) {
                            deleteProgram(p.id);
                          }
                        }}
                      >
                        Elimina
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel space-y-3">
        <h2 className="font-display text-lg">Backup</h2>
        <p className="text-sm text-[var(--muted)]">
          I dati restano in questo browser. Esporta un JSON per spostarli su un
          altro PC o dopo il deploy su Vercel.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const blob = new Blob([exportJson()], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `conforto-turni-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Esporta JSON
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => fileRef.current?.click()}
          >
            Importa JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                importJson(text);
                alert("Dati importati.");
              } catch (err) {
                alert(`Import fallito: ${(err as Error).message}`);
              }
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn-ghost text-red-700"
            onClick={() => {
              if (
                confirm(
                  "Ripristinare il programma seed Set–Ott–Nov 2026? I dati attuali verranno sostituiti."
                )
              ) {
                resetSeed();
              }
            }}
          >
            Ripristina esempio PDF
          </button>
        </div>
      </div>
    </div>
  );
}
