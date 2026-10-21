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
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">WhatsApp</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Aggiungi i numeri in Persone, personalizza i messaggi e inviali con un
          clic. Segnaposto:{" "}
          <code className="text-xs">
            {"{{nome}} {{destinatario}} {{settimana}} {{tipo}} {{compagno}} {{link_calendario}}"}
          </code>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-3">
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
                className="input min-h-[110px] font-mono text-xs"
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

        <div className="panel space-y-3">
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
          <pre className="whitespace-pre-wrap rounded-md bg-[var(--sand)] p-3 text-sm">
            {preview}
          </pre>
        </div>
      </div>

      <div className="panel">
        <h2 className="font-display mb-3 text-lg">Invio rapido per giovane</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Giovane</th>
                <th>Telefono</th>
                <th>Turni nel programma</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
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
                  const payload = buildEventPayload(
                    first,
                    week,
                    data.people
                  );
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
                  <tr key={g.id}>
                    <td className="font-medium">{g.name}</td>
                    <td className="font-mono text-xs">{g.phone || "—"}</td>
                    <td>{turns.length}</td>
                    <td>
                      <WhatsAppButton
                        person={g}
                        message={message}
                        countryCode={data.settings.defaultCountryCode}
                        label={
                          first
                            ? "Invia primo turno"
                            : "Messaggio vuoto"
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Per ogni turno singolo usa i pulsanti WA nella pagina Programma: lì il
          messaggio include destinatario, settimana e link calendario di quel
          turno.
        </p>
      </div>
    </div>
  );
}
