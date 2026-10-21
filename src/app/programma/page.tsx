"use client";

import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { useStore } from "@/lib/store";
import { CalendarMenu } from "@/components/CalendarMenu";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { downloadProgramPdf } from "@/lib/pdf";
import { monthGroups } from "@/lib/schedule";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
  recipientDisplayName,
} from "@/lib/calendar";
import { buildAssignmentMessage } from "@/lib/whatsapp";
import type { Assignment, ContactKind, VisitKind } from "@/lib/types";

export default function ProgrammaPage() {
  const {
    ready,
    data,
    activeProgram,
    setActiveProgram,
    upsertAssignment,
    deleteAssignment,
  } = useStore();
  const [editing, setEditing] = useState<{
    list: "visits" | "contacts";
    assignment: Assignment;
  } | null>(null);

  const groups = useMemo(
    () => (activeProgram ? monthGroups(activeProgram.weeks) : []),
    [activeProgram]
  );

  if (!ready) return <p>Caricamento…</p>;
  if (!activeProgram) {
    return (
      <div className="panel">
        <p>Nessun programma. Vai su Genera per crearne uno.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{activeProgram.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {activeProgram.monthsLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.programs.length > 1 && (
            <select
              className="input !w-auto"
              value={activeProgram.id}
              onChange={(e) => setActiveProgram(e.target.value)}
            >
              {data.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.monthsLabel}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              downloadProgramPdf(
                activeProgram,
                data.people,
                data.settings,
                window.location.origin
              )
            }
          >
            Scarica PDF
          </button>
        </div>
      </div>

      {editing && (
        <AssignmentEditor
          list={editing.list}
          assignment={editing.assignment}
          weeks={activeProgram.weeks}
          people={data.people}
          onCancel={() => setEditing(null)}
          onSave={(a) => {
            upsertAssignment(activeProgram.id, editing.list, a);
            setEditing(null);
          }}
        />
      )}

      {groups.map((group) => (
        <section key={group.label} className="space-y-4">
          <h2 className="font-display text-2xl capitalize">{group.label}</h2>

          <div className="panel !p-0 overflow-hidden">
            <div className="border-b border-[var(--line)] bg-[var(--teal-soft)] px-4 py-2 text-sm font-semibold">
              Visite a Casa o in Struttura
            </div>
            <div className="table-wrap !rounded-none !border-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Giovani incaricati</th>
                    <th>Destinatario</th>
                    <th>Tipo</th>
                    <th>Calendario / WA</th>
                  </tr>
                </thead>
                <tbody>
                  {group.weeks.map((week) => {
                    const a = activeProgram.visits.find(
                      (v) => v.weekId === week.id
                    );
                    if (!a) {
                      return (
                        <tr key={week.id}>
                          <td>{week.label}</td>
                          <td colSpan={3} className="text-[var(--muted)]">
                            Nessuna visita
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-ghost !px-2 !py-1 text-xs"
                              onClick={() =>
                                setEditing({
                                  list: "visits",
                                  assignment: blankAssignment(week.id, "visita"),
                                })
                              }
                            >
                              Aggiungi
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <AssignmentRow
                        key={a.id}
                        assignment={a}
                        week={week}
                        onEdit={() => setEditing({ list: "visits", assignment: a })}
                        onDelete={() =>
                          deleteAssignment(activeProgram.id, "visits", a.id)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel !p-0 overflow-hidden">
            <div className="border-b border-[var(--line)] bg-[#e8efe6] px-4 py-2 text-sm font-semibold">
              Contatti alternativi
            </div>
            <div className="table-wrap !rounded-none !border-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Giovane</th>
                    <th>Destinatario</th>
                    <th>Tipo</th>
                    <th>Calendario / WA</th>
                  </tr>
                </thead>
                <tbody>
                  {group.weeks.map((week) => {
                    const a = activeProgram.contacts.find(
                      (v) => v.weekId === week.id
                    );
                    if (!a) {
                      return (
                        <tr key={week.id}>
                          <td>{week.label}</td>
                          <td colSpan={3} className="text-[var(--muted)]">
                            Nessun contatto
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-ghost !px-2 !py-1 text-xs"
                              onClick={() =>
                                setEditing({
                                  list: "contacts",
                                  assignment: blankAssignment(
                                    week.id,
                                    "contatto"
                                  ),
                                })
                              }
                            >
                              Aggiungi
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <AssignmentRow
                        key={a.id}
                        assignment={a}
                        week={week}
                        onEdit={() =>
                          setEditing({ list: "contacts", assignment: a })
                        }
                        onDelete={() =>
                          deleteAssignment(activeProgram.id, "contacts", a.id)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function blankAssignment(
  weekId: string,
  kind: "visita" | "contatto"
): Assignment {
  return {
    id: nanoid(10),
    weekId,
    kind,
    assigneeIds: [],
    recipientId: "",
    visitType:
      kind === "visita"
        ? "Visita a casa"
        : "Telefonata/Messaggio/Conversazione in sala",
  };
}

function AssignmentRow({
  assignment,
  week,
  onEdit,
  onDelete,
}: {
  assignment: Assignment;
  week: { id: string; label: string; startDate: string; endDate: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data, activeProgram } = useStore();
  const people = data.people;
  const recipient = people.find((p) => p.id === assignment.recipientId);
  const assignees = assignment.assigneeIds
    .map((id) => people.find((p) => p.id === id))
    .filter(Boolean);

  const payload = buildEventPayload(assignment, week, people);
  const calLink =
    typeof window !== "undefined"
      ? buildCalendarLinkUrl(payload, data.settings, window.location.origin)
      : "";

  const templateKey = assignment.kind === "visita" ? "visita" : "contatto";

  return (
    <tr>
      <td className="whitespace-nowrap">{week.label}</td>
      <td>
        {assignees.map((a) => a!.name).join(", ") || "—"}
      </td>
      <td>{recipientDisplayName(recipient)}</td>
      <td>{assignment.visitType}</td>
      <td>
        <div className="flex flex-wrap items-center gap-1">
          <CalendarMenu
            assignment={assignment}
            week={week}
            people={people}
            settings={data.settings}
          />
          {assignees.map((person) => {
            if (!person || !activeProgram) return null;
            const msg = buildAssignmentMessage(
              templateKey,
              activeProgram.whatsappTemplates,
              assignment,
              week,
              people,
              calLink,
              person.id
            );
            return (
              <WhatsAppButton
                key={person.id}
                person={person}
                message={msg}
                countryCode={data.settings.defaultCountryCode}
                label={`WA ${person.name.split(" ")[0]}`}
                className="btn-wa !px-2 !py-1 text-xs"
              />
            );
          })}
          <button
            type="button"
            className="btn-ghost !px-2 !py-1 text-xs"
            onClick={onEdit}
          >
            Modifica
          </button>
          <button
            type="button"
            className="btn-ghost !px-2 !py-1 text-xs text-red-700"
            onClick={onDelete}
          >
            Elimina
          </button>
        </div>
      </td>
    </tr>
  );
}

function AssignmentEditor({
  list,
  assignment,
  weeks,
  people,
  onSave,
  onCancel,
}: {
  list: "visits" | "contacts";
  assignment: Assignment;
  weeks: { id: string; label: string }[];
  people: { id: string; name: string; role: string }[];
  onSave: (a: Assignment) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Assignment>(assignment);
  const giovani = people.filter((p) => p.role === "giovane");
  const destinatari = people.filter((p) => p.role === "destinatario");
  const maxAssignees = list === "visits" ? 2 : 1;

  return (
    <div className="panel">
      <h2 className="font-display mb-3 text-lg">
        {list === "visits" ? "Modifica visita" : "Modifica contatto"}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="label">Settimana</span>
          <select
            className="input"
            value={form.weekId}
            onChange={(e) => setForm({ ...form, weekId: e.target.value })}
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="label">Destinatario</span>
          <select
            className="input"
            value={form.recipientId}
            onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
          >
            <option value="">—</option>
            {destinatari.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 sm:col-span-2">
          <span className="label">
            Incaricati (max {maxAssignees})
          </span>
          <div className="flex flex-wrap gap-2">
            {giovani.map((g) => {
              const checked = form.assigneeIds.includes(g.id);
              return (
                <label
                  key={g.id}
                  className={`cursor-pointer rounded-md border px-2 py-1 text-sm ${
                    checked
                      ? "border-[var(--teal)] bg-[var(--teal-soft)]"
                      : "border-[var(--line)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={checked}
                    onChange={() => {
                      let ids = [...form.assigneeIds];
                      if (checked) ids = ids.filter((id) => id !== g.id);
                      else {
                        ids.push(g.id);
                        if (ids.length > maxAssignees) ids = ids.slice(-maxAssignees);
                      }
                      setForm({ ...form, assigneeIds: ids });
                    }}
                  />
                  {g.name}
                </label>
              );
            })}
          </div>
        </label>
        <label className="grid gap-1 sm:col-span-2">
          <span className="label">Tipo</span>
          <select
            className="input"
            value={form.visitType}
            onChange={(e) =>
              setForm({
                ...form,
                visitType: e.target.value as VisitKind | ContactKind,
              })
            }
          >
            {list === "visits" ? (
              <>
                <option>Visita a casa</option>
                <option>Visita in struttura</option>
              </>
            ) : (
              <option>Telefonata/Messaggio/Conversazione in sala</option>
            )}
          </select>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (!form.recipientId || form.assigneeIds.length === 0) {
              alert("Seleziona destinatario e almeno un incaricato.");
              return;
            }
            onSave(form);
          }}
        >
          Salva turno
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Annulla
        </button>
      </div>
    </div>
  );
}
