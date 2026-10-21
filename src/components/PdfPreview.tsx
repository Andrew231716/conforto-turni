"use client";

import { useMemo } from "react";
import type { AppSettings, Person, Program } from "@/lib/types";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
  recipientDisplayName,
} from "@/lib/calendar";
import { monthGroups } from "@/lib/schedule";
import { downloadProgramPdf } from "@/lib/pdf";

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
  const groups = useMemo(() => monthGroups(program.weeks), [program.weeks]);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/45 p-4">
      <div className="my-6 w-full max-w-5xl rounded-xl border border-[var(--line)] bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
          <div>
            <h2 className="font-display text-xl">Anteprima PDF</h2>
            <p className="text-xs text-[var(--muted)]">
              Controlla il risultato prima di scaricare.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                downloadProgramPdf(program, people, settings, origin);
              }}
            >
              Scarica PDF
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Chiudi
            </button>
          </div>
        </div>

        <div className="space-y-8 p-4 sm:p-6">
          <header className="text-center">
            <h3 className="font-display text-2xl">{program.title}</h3>
            <p className="mt-1 text-[var(--muted)]">{program.monthsLabel}</p>
            <p className="mx-auto mt-2 max-w-3xl text-xs text-[var(--muted)]">
              Pulsante calendario: apre una pagina per aggiungere l&apos;evento
              al calendario personale (Apple, Google, Outlook o altro). L&apos;evento
              rimane presente per tutta la settimana indicata.
            </p>
          </header>

          {groups.map((group) => (
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
                headers={[
                  "Data",
                  "Giovani Incaricati",
                  "Destinatario",
                  "Tipo di Visita",
                  "Calendario",
                ]}
                rows={group.weeks.map((week) => {
                  const a = program.visits.find((v) => v.weekId === week.id);
                  return rowCells(a, week, people, program, settings, origin);
                })}
              />

              <PreviewTable
                title="Contatti Alternativi"
                headTone="contact"
                headers={[
                  "Data",
                  "Giovane",
                  "Destinatario",
                  "Tipo di Incoraggiamento",
                  "Calendario",
                ]}
                rows={group.weeks.map((week) => {
                  const a = program.contacts.find((v) => v.weekId === week.id);
                  return rowCells(a, week, people, program, settings, origin);
                })}
              />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function rowCells(
  a: Program["visits"][number] | undefined,
  week: Program["weeks"][number],
  people: Person[],
  program: Program,
  settings: AppSettings,
  origin: string
) {
  if (!a) {
    return {
      cells: [week.label, "—", "—", "—", "—"],
      url: "",
    };
  }
  const recipient = people.find((p) => p.id === a.recipientId);
  const assignees = a.assigneeIds
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const payload = buildEventPayload(a, week, people);
  const url = buildCalendarLinkUrl(payload, settings, origin);
  return {
    cells: [
      week.label,
      assignees || "—",
      recipientDisplayName(recipient),
      a.visitType,
      "Aggiungi al calendario",
    ],
    url,
  };
}

function PreviewTable({
  title,
  headers,
  rows,
  headTone,
}: {
  title: string;
  headers: string[];
  rows: { cells: string[]; url: string }[];
  headTone: "visit" | "contact";
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)]">
      <div className="border-b border-[var(--line)] bg-[var(--teal-soft)] px-3 py-2 text-sm font-semibold">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr
              className={
                headTone === "visit" ? "bg-[#1e5a78] text-white" : "bg-[#466e5a] text-white"
              }
            >
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[var(--line)]">
                {row.cells.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-top">
                    {j === 4 && row.url ? (
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
