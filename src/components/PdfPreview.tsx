"use client";

import { useMemo, useState } from "react";
import type { AppSettings, Person, Program } from "@/lib/types";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
} from "@/lib/calendar";
import { downloadProgramPdf, type ExportLayout } from "@/lib/pdf";
import {
  copyProgramPlainText,
  downloadProgramExcel,
  downloadProgramWord,
} from "@/lib/officeExport";
import {
  buildProgramTables,
  fullHeaders,
  rowCells,
  simpleHeaders,
} from "@/lib/programTables";
import { Modal } from "./Modal";

export function PdfPreviewModal({
  program,
  people,
  settings,
  onClose,
}: {
  program: Program;
  people: Person[];
  settings: AppSettings;
  onClose: () => void;
}) {
  const [layout, setLayout] = useState<ExportLayout>("simple");
  const [busy, setBusy] = useState<string | null>(null);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const tables = useMemo(
    () =>
      buildProgramTables(program, people, (a) => {
        const week = program.weeks.find((w) => w.id === a.weekId);
        if (!week) return "";
        const payload = buildEventPayload(
          a,
          week,
          people,
          settings.timezone || "Europe/Rome"
        );
        return buildCalendarLinkUrl(payload, settings, origin);
      }),
    [program, people, settings, origin]
  );

  const run = async (label: string, fn: () => void | Promise<void>) => {
    try {
      setBusy(label);
      await fn();
    } catch (err) {
      alert(`Export non riuscito: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Anteprima e download" onClose={onClose} wide>
      <div className="mb-4 space-y-3">
        <p className="text-xs text-[var(--muted)]">
          Anteprima e download del programma. Premi Esc per chiudere.
        </p>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--sand)] p-3 space-y-2">
          <div className="text-sm font-medium">Da condividere / modificare</div>
          <p className="text-xs text-[var(--muted)]">
            Senza colonne Stato e Calendario. PDF per inviare; Excel e Word per
            modificare in Office / LibreOffice / Google.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!!busy}
              onClick={() =>
                run("pdf-simple", () =>
                  downloadProgramPdf(
                    program,
                    people,
                    settings,
                    origin,
                    "simple"
                  )
                )
              }
            >
              {busy === "pdf-simple" ? "…" : "PDF senza Stato/Calendario"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!!busy}
              onClick={() =>
                run("excel", () => downloadProgramExcel(program, people))
              }
            >
              {busy === "excel" ? "…" : "Excel editabile"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!!busy}
              onClick={() =>
                run("word", () => downloadProgramWord(program, people))
              }
            >
              {busy === "word" ? "…" : "Word editabile"}
            </button>
            <button
              type="button"
              className="btn-wa"
              disabled={!!busy}
              onClick={() =>
                run("copy", async () => {
                  const ok = await copyProgramPlainText(program, people);
                  if (ok) {
                    alert(
                      "Testo copiato (senza Stato/Calendario). Incollalo in WhatsApp o email."
                    );
                  } else {
                    alert("Impossibile copiare negli appunti.");
                  }
                })
              }
            >
              {busy === "copy" ? "…" : "Copia per inviare"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() =>
              run("pdf-full", () =>
                downloadProgramPdf(program, people, settings, origin, "full")
              )
            }
          >
            {busy === "pdf-full" ? "…" : "PDF completo (con Stato e Calendario)"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--line)] p-0.5 text-sm w-fit">
          <button
            type="button"
            className={`rounded-md px-3 py-1 ${
              layout === "simple" ? "bg-[var(--teal-soft)] font-medium" : ""
            }`}
            onClick={() => setLayout("simple")}
          >
            Anteprima senza Stato/Calendario
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1 ${
              layout === "full" ? "bg-[var(--teal-soft)] font-medium" : ""
            }`}
            onClick={() => setLayout("full")}
          >
            Anteprima completa
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <header className="text-center">
          <h3 className="font-display text-3xl">{program.title}</h3>
          <p className="mt-1 text-base text-[var(--muted)]">
            {program.monthsLabel}
          </p>
          {layout === "full" ? (
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
              Pulsante calendario: apre una pagina per aggiungere l&apos;evento
              al calendario personale (Apple, Google, Outlook o altro).
            </p>
          ) : (
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
              Anteprima versione da condividere: senza colonne Stato e
              Calendario.
            </p>
          )}
        </header>

        {tables.map((group) => (
          <section
            key={group.label}
            className="space-y-4 border-t border-[var(--line)] pt-6 first:border-t-0 first:pt-0"
          >
            <h4 className="font-display text-2xl text-[var(--teal)]">
              {group.label}
            </h4>

            <PreviewTable
              title="Visite a Casa o in Struttura (una visita a settimana)"
              headTone="visit"
              headers={
                layout === "simple"
                  ? simpleHeaders("visita")
                  : fullHeaders("visita")
              }
              linkColumn={layout === "full" ? 5 : -1}
              rows={group.visits.map((r) => ({
                cells: rowCells(r, layout),
                url: r.calendarUrl,
              }))}
            />

            <PreviewTable
              title="Contatti Alternativi"
              headTone="contact"
              headers={
                layout === "simple"
                  ? simpleHeaders("contatto")
                  : fullHeaders("contatto")
              }
              linkColumn={layout === "full" ? 5 : -1}
              rows={group.contacts.map((r) => ({
                cells: rowCells(r, layout),
                url: r.calendarUrl,
              }))}
            />
          </section>
        ))}
      </div>
    </Modal>
  );
}

function PreviewTable({
  title,
  headers,
  rows,
  headTone,
  linkColumn,
}: {
  title: string;
  headers: string[];
  rows: { cells: string[]; url: string }[];
  headTone: "visit" | "contact";
  linkColumn: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)]">
      <div className="border-b border-[var(--line)] bg-[var(--teal-soft)] px-3 py-2 text-sm font-semibold">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table
          className={`w-full text-left text-base ${
            linkColumn >= 0 ? "min-w-[44rem]" : "min-w-[32rem]"
          }`}
        >
          <thead>
            <tr
              className={
                headTone === "visit"
                  ? "bg-[#1e5a78] text-white"
                  : "bg-[#466e5a] text-white"
              }
            >
              {headers.map((h) => (
                <th key={h} className="px-3 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[var(--line)]">
                {row.cells.map((cell, j) => (
                  <td key={j} className="px-3 py-3 align-top leading-snug">
                    {j === linkColumn && row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[#2563a8] underline"
                      >
                        {cell}
                      </a>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
