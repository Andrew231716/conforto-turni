"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
} from "@/lib/calendar";
import { buildAssignmentMessage } from "@/lib/whatsapp";
import type { WhatsAppTemplates } from "@/lib/types";

export default function WhatsAppPage() {
  const { ready, data, activeProgram, updateWhatsAppTemplates } = useStore();
  const [templates, setTemplates] = useState<WhatsAppTemplates | null>(null);
  const [previewPersonId, setPreviewPersonId] = useState<string>("");

  const effective = templates ?? activeProgram?.whatsappTemplates;

  const preview = useMemo(() => {
    if (!activeProgram || !effective) return "";
    const assignment =
      activeProgram.visits[0] || activeProgram.contacts[0];
    if (!assignment) return "Nessun turno per l'anteprima.";
    const week = activeProgram.weeks.find((w) => w.id === assignment.weekId);
    if (!week) return "";
    const payload = buildEventPayload(assignment, week, data.people);
    const link =
      typeof window !== "undefined"
        ? buildCalendarLinkUrl(payload, data.settings, window.location.origin)
        : "";
    const personId = previewPersonId || assignment.assigneeIds[0];
    return buildAssignmentMessage(
      assignment.kind === "visita" ? "visita" : "contatto",
      effective,
      assignment,
      week,
      data.people,
      link,
      personId
    );
  }, [activeProgram, effective, data.people, data.settings, previewPersonId]);

  if (!ready) return <p>Caricamento…</p>;
  if (!activeProgram || !effective) {
    return <p>Crea prima un programma.</p>;
  }

  const giovani = data.people.filter((p) => p.role === "giovane");

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="min-w-0">
        <h1 className="font-display text-3xl">WhatsApp</h1>
        <p className="mt-1 text-sm text-[var(--muted)] break-words">
          Aggiungi i numeri in Persone, personalizza i messaggi e inviali con un
          clic. Segnaposto:{" "}
          <code className="break-all text-xs">
            {"{{nome}} {{destinatario}} {{settimana}} {{tipo}} {{compagno}} {{link_calendario}}"}
          </code>
        </p>
      </div>

      <div className="grid w-full min-w-0 gap-4 lg:grid-cols-2">
        <div className="panel min-w-0 space-y-3">
          <h2 className="font-display text-lg">Modelli messaggio</h2>
          {(
            [
              ["visita", "Visita (coppia)"],
              ["contatto", "Contatto alternativo"],
              ["reminder", "Promemoria"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="grid gap-1">
              <span className="label">{label}</span>
              <textarea
                className="input min-h-[110px] break-words font-mono text-xs"
                value={effective[key]}
                onChange={(e) =>
                  setTemplates({
                    ...(templates ?? activeProgram.whatsappTemplates),
                    [key]: e.target.value,
                  })
                }
              />
            </label>
          ))}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (!templates) return;
              updateWhatsAppTemplates(activeProgram.id, templates);
              setTemplates(null);
              alert("Modelli salvati.");
            }}
            disabled={!templates}
          >
            Salva modelli
          </button>
        </div>

        <div className="panel min-w-0 space-y-3">
          <h2 className="font-display text-lg">Anteprima</h2>
          <label className="grid gap-1">
            <span className="label">Destinatario messaggio (giovane)</span>
            <select
              className="input"
              value={previewPersonId}
              onChange={(e) => setPreviewPersonId(e.target.value)}
            >
              <option value="">Primo incaricato del primo turno</option>
              {giovani.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {!g.phone ? " (senza numero)" : ""}
                </option>
              ))}
            </select>
          </label>
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[var(--sand)] p-3 text-sm [overflow-wrap:anywhere]">
            {preview}
          </pre>
        </div>
      </div>

      <div className="panel w-full min-w-0">
        <h2 className="font-display mb-3 text-lg">Invio rapido per giovane</h2>
        <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
          {giovani.map((g) => {
            const turns = [
              ...activeProgram.visits.filter((v) =>
                v.assigneeIds.includes(g.id)
              ),
              ...activeProgram.contacts.filter((v) =>
                v.assigneeIds.includes(g.id)
              ),
            ];
            const first = turns[0];
            const week = first
              ? activeProgram.weeks.find((w) => w.id === first.weekId)
              : null;
            let message = `Ciao ${g.name}!`;
            if (first && week) {
              const payload = buildEventPayload(first, week, data.people);
              const link =
                typeof window !== "undefined"
                  ? buildCalendarLinkUrl(
                      payload,
                      data.settings,
                      window.location.origin
                    )
                  : "";
              message = buildAssignmentMessage(
                first.kind === "visita" ? "visita" : "contatto",
                activeProgram.whatsappTemplates,
                first,
                week,
                data.people,
                link,
                g.id
              );
            }
            return (
              <li
                key={g.id}
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium">{g.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    <span className="font-mono">{g.phone || "Nessun telefono"}</span>
                    {" · "}
                    {turns.length} turni
                  </div>
                </div>
                <div className="shrink-0">
                  <WhatsAppButton
                    person={g}
                    message={message}
                    countryCode={data.settings.defaultCountryCode}
                    label={first ? "Invia turno" : "Messaggio"}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Per ogni turno singolo usa i pulsanti WA nella pagina Programma: lì il
          messaggio include destinatario, settimana e link calendario di quel
          turno.
        </p>
      </div>
    </div>
  );
}
