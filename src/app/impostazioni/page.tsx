"use client";

import { useRef } from "react";
import { useStore } from "@/lib/store";

export default function ImpostazioniPage() {
  const { ready, data, setSettings, exportJson, importJson, resetSeed } =
    useStore();
  const fileRef = useRef<HTMLInputElement>(null);

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
          <input
            className="input"
            value={data.settings.timezone}
            onChange={(e) => setSettings({ timezone: e.target.value })}
          />
        </label>
        <label className="grid gap-1">
          <span className="label">Prefisso paese WhatsApp</span>
          <input
            className="input"
            value={data.settings.defaultCountryCode}
            onChange={(e) =>
              setSettings({ defaultCountryCode: e.target.value.replace(/\D/g, "") })
            }
          />
        </label>
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
