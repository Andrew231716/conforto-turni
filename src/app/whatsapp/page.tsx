"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
} from "@/lib/calendar";
import {
  buildAssignmentMessage,
  openWhatsAppForPerson,
} from "@/lib/whatsapp";
import type { Person, WhatsAppTemplates } from "@/lib/types";

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
    const payload = buildEventPayload(
      assignment,
      week,
      data.people,
      data.settings.timezone
    );
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
  }, [
    activeProgram,
    effective,
    data.people,
    data.settings,
    previewPersonId,
  ]);

  if (!ready) return <p>Caricamento…</p>;
  if (!activeProgram || !effective) {
    return <p>Crea prima un programma.</p>;
  }

  const giovani = data.people.filter((p) => p.role === "giovane");

  const buildAllTurnsMessage = (g: Person) => {
    const turns = [
      ...activeProgram.visits.filter((v) => v.assigneeIds.includes(g.id)),
      ...activeProgram.contacts.filter((v) => v.assigneeIds.includes(g.id)),
    ].sort((a, b) => {
      const wa = activeProgram.weeks.find((w) => w.id === a.weekId)?.startDate ?? "";
      const wb = activeProgram.weeks.find((w) => w.id === b.weekId)?.startDate ?? "";
      return wa.localeCompare(wb);
    });
    if (!turns.length) return `Ciao ${g.name}! Non hai turni in questo programma.`;
    const lines = turns.map((a) => {
      const week = activeProgram.weeks.find((w) => w.id === a.weekId);
      if (!week) return "";
      const payload = buildEventPayload(
        a,
        week,
        data.people,
        data.settings.timezone
      );
      const link =
        typeof window !== "undefined"
          ? buildCalendarLinkUrl(
              payload,
              data.settings,
              window.location.origin
            )
          : "";
      return buildAssignmentMessage(
        a.kind === "visita" ? "visita" : "contatto",
        activeProgram.whatsappTemplates,
        a,
        week,
        data.people,
        link,
        g.id
      );
    });
    return lines.filter(Boolean).join("\n\n———\n\n");
  };

  const sendAllWithPhones = () => {
    const withPhone = giovani.filter((g) => g.phone?.trim());
    if (!withPhone.length) {
      alert("Nessun giovane ha un numero salvato.");
      return;
    }
    if (
      !confirm(
        `Aprire WhatsApp per ${withPhone.length} giovani (tutti i loro turni)? Uno alla volta.`
      )
    ) {
      return;
    }
    for (let i = 0; i < withPhone.length; i++) {
      const g = withPhone[i];
      const message = buildAllTurnsMessage(g);
      const result = openWhatsAppForPerson(
        g,
        message,
        data.settings.defaultCountryCode
      );
      if (!result.ok) {
        alert(result.reason);
        continue;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
      if (i < withPhone.length - 1) {
        if (!confirm(`Aperto WA per ${g.name}. Continuare?`)) break;
      }
    }
  };

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

      <div className="panel w-full min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg">Invio per giovane</h2>
          <button type="button" className="btn-wa" onClick={sendAllWithPhones}>
            Invia a tutti (tutti i turni)
          </button>
        </div>
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
            const allMsg = buildAllTurnsMessage(g);
            const first = turns[0];
            const week = first
              ? activeProgram.weeks.find((w) => w.id === first.weekId)
              : null;
            let firstMsg = `Ciao ${g.name}!`;
            if (first && week) {
              const payload = buildEventPayload(
                first,
                week,
                data.people,
                data.settings.timezone
              );
              const link =
                typeof window !== "undefined"
                  ? buildCalendarLinkUrl(
                      payload,
                      data.settings,
                      window.location.origin
                    )
                  : "";
              firstMsg = buildAssignmentMessage(
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
                    <span className="font-mono">
                      {g.phone || "Nessun telefono"}
                    </span>
                    {" · "}
                    {turns.length} turni
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <WhatsAppButton
                    person={g}
                    message={firstMsg}
                    countryCode={data.settings.defaultCountryCode}
                    label={first ? "Primo turno" : "Messaggio"}
                  />
                  <WhatsAppButton
                    person={g}
                    message={allMsg}
                    countryCode={data.settings.defaultCountryCode}
                    label="Tutti i turni"
                    className="btn-ghost"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-[var(--muted)]">
          Per un singolo turno usa i pulsanti WA nella pagina Programma. Da lì
          puoi anche inviare a tutti gli incaricati di una settimana.
        </p>
      </div>
    </div>
  );
}
