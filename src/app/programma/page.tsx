"use client";

import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { useStore } from "@/lib/store";
import { CalendarMenu } from "@/components/CalendarMenu";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { PdfPreviewModal } from "@/components/PdfPreview";
import { MonthGrid, monthKeysFromProgram } from "@/components/MonthGrid";
import { Modal } from "@/components/Modal";
import { availableForWeek, canPairWith, monthGroups } from "@/lib/schedule";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
  recipientDisplayName,
} from "@/lib/calendar";
import {
  buildAssignmentMessage,
  openWhatsAppForPerson,
} from "@/lib/whatsapp";
import { downloadTextFile, programToCsv, workloadByPerson } from "@/lib/export";
import { validateAssignment } from "@/lib/validation";
import type {
  Assignment,
  ContactKind,
  Person,
  VisitKind,
  WeekSlot,
} from "@/lib/types";

export default function ProgrammaPage() {
  const {
    ready,
    data,
    activeProgram,
    setActiveProgram,
    deleteProgram,
    upsertAssignment,
    deleteAssignment,
  } = useStore();
  const [editing, setEditing] = useState<{
    list: "visits" | "contacts";
    assignment: Assignment;
  } | null>(null);
  const [pdfPreview, setPdfPreview] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [view, setView] = useState<"lista" | "mese">("lista");
  const [massWeekId, setMassWeekId] = useState("");

  const groups = useMemo(
    () => (activeProgram ? monthGroups(activeProgram.weeks) : []),
    [activeProgram]
  );
  const monthKeys = useMemo(
    () => (activeProgram ? monthKeysFromProgram(activeProgram.weeks) : []),
    [activeProgram]
  );
  const workload = useMemo(
    () =>
      activeProgram
        ? workloadByPerson(activeProgram, data.people)
        : [],
    [activeProgram, data.people]
  );

  if (!ready) return <p>Caricamento…</p>;
  if (!activeProgram) {
    return (
      <div className="panel">
        <p>Nessun programma. Vai su Genera per crearne uno.</p>
      </div>
    );
  }

  const sendMassWeek = async () => {
    const weekId = massWeekId || activeProgram.weeks[0]?.id;
    if (!weekId) return;
    const week = activeProgram.weeks.find((w) => w.id === weekId);
    if (!week) return;
    const assignments = [
      ...activeProgram.visits.filter((a) => a.weekId === weekId),
      ...activeProgram.contacts.filter((a) => a.weekId === weekId),
    ];
    const jobs: { person: Person; message: string }[] = [];
    for (const a of assignments) {
      for (const personId of a.assigneeIds) {
        const person = data.people.find((p) => p.id === personId);
        if (!person) continue;
        const payload = buildEventPayload(
          a,
          week,
          data.people,
          data.settings.timezone
        );
        const link = buildCalendarLinkUrl(
          payload,
          data.settings,
          window.location.origin
        );
        const message = buildAssignmentMessage(
          a.kind === "visita" ? "visita" : "contatto",
          activeProgram.whatsappTemplates,
          a,
          week,
          data.people,
          link,
          person.id
        );
        jobs.push({ person, message });
      }
    }
    if (!jobs.length) {
      alert("Nessun incarico in questo periodo.");
      return;
    }
    if (
      !confirm(
        `Aprire WhatsApp per ${jobs.length} messaggi della settimana «${week.label}»? (uno alla volta)`
      )
    ) {
      return;
    }
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const result = openWhatsAppForPerson(
        job.person,
        job.message,
        data.settings.defaultCountryCode
      );
      if (!result.ok) {
        alert(result.reason);
        continue;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
      if (i < jobs.length - 1) {
        const cont = confirm(
          `Aperto WA per ${job.person.name}. Continuare con il prossimo?`
        );
        if (!cont) break;
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={followUp}
            onChange={(event) => setFollowUp(event.target.checked)}
          />
          Solo turni da seguire
        </label>
        <div className="flex gap-1 rounded-lg border border-[var(--line)] p-0.5 text-sm">
          <button
            type="button"
            className={`rounded-md px-3 py-1 ${
              view === "lista" ? "bg-[var(--teal-soft)] font-medium" : ""
            }`}
            onClick={() => setView("lista")}
          >
            Lista
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1 ${
              view === "mese" ? "bg-[var(--teal-soft)] font-medium" : ""
            }`}
            onClick={() => setView("mese")}
          >
            Mese
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{activeProgram.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {activeProgram.monthsLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.programs.length > 0 && (
            <select
              className="input !w-auto"
              value={activeProgram.id}
              onChange={(e) => setActiveProgram(e.target.value)}
              aria-label="Seleziona programma"
            >
              {data.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.monthsLabel || p.title}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => setPdfPreview(true)}
          >
            Anteprima / PDF
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              downloadTextFile(
                programToCsv(activeProgram, data.people),
                `programma_${activeProgram.monthsLabel.replace(/\s+/g, "_")}.csv`
              );
            }}
          >
            Esporta CSV
          </button>
          <button
            type="button"
            className="btn-ghost text-red-700"
            onClick={() => {
              const label =
                activeProgram.monthsLabel || activeProgram.title;
              if (
                !confirm(
                  `Eliminare il programma «${label}»? L'operazione non si può annullare.`
                )
              ) {
                return;
              }
              deleteProgram(activeProgram.id);
            }}
          >
            Elimina programma
          </button>
        </div>
      </div>

      <div className="panel space-y-3">
        <h2 className="font-display text-lg">WhatsApp di massa</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">
            <span className="label">Periodo</span>
            <select
              className="input !w-auto"
              value={massWeekId}
              onChange={(e) => setMassWeekId(e.target.value)}
              aria-label="Periodo per WhatsApp di massa"
            >
              <option value="">Primo periodo</option>
              {activeProgram.weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-wa" onClick={sendMassWeek}>
            Invia WA a tutti gli incaricati
          </button>
        </div>
      </div>

      <details className="panel">
        <summary className="cursor-pointer font-display text-lg">
          Bilanciamento turni
        </summary>
        <div className="mt-3 table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Giovane</th>
                <th>Visite</th>
                <th>Contatti</th>
                <th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.visits}</td>
                  <td>{row.contacts}</td>
                  <td className="font-medium">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {pdfPreview && (
        <PdfPreviewModal
          program={activeProgram}
          people={data.people}
          settings={data.settings}
          onClose={() => setPdfPreview(false)}
        />
      )}

      {editing && (
        <AssignmentEditor
          list={editing.list}
          assignment={editing.assignment}
          weeks={activeProgram.weeks}
          people={data.people}
          rules={activeProgram.rules}
          allAssignments={[...activeProgram.visits, ...activeProgram.contacts]}
          onCancel={() => setEditing(null)}
          onSave={(a) => {
            upsertAssignment(activeProgram.id, editing.list, a);
            setEditing(null);
          }}
        />
      )}

      {view === "mese" ? (
        <div className="space-y-6">
          {monthKeys.map((key) => (
            <MonthGrid
              key={key}
              program={activeProgram}
              people={data.people}
              monthKey={key}
            />
          ))}
        </div>
      ) : (
        groups.map((group) => (
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
                      if (
                        followUp &&
                        (a?.status === "Completato" ||
                          a?.status === "Confermato")
                      )
                        return null;
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
                                    assignment: blankAssignment(
                                      week.id,
                                      "visita"
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
                            setEditing({ list: "visits", assignment: a })
                          }
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
                      if (
                        followUp &&
                        (a?.status === "Completato" ||
                          a?.status === "Confermato")
                      )
                        return null;
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
                            deleteAssignment(
                              activeProgram.id,
                              "contacts",
                              a.id
                            )
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))
      )}
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
  week: WeekSlot;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data, activeProgram, upsertAssignment } = useStore();
  const people = data.people;
  const recipient = people.find((p) => p.id === assignment.recipientId);
  const assignees = assignment.assigneeIds
    .map((id) => people.find((p) => p.id === id))
    .filter(Boolean);

  const payload = buildEventPayload(
    assignment,
    week,
    people,
    data.settings.timezone
  );
  const calLink =
    typeof window !== "undefined"
      ? buildCalendarLinkUrl(payload, data.settings, window.location.origin)
      : "";

  const templateKey = assignment.kind === "visita" ? "visita" : "contatto";
  const all = activeProgram
    ? [...activeProgram.visits, ...activeProgram.contacts]
    : [];
  const save = (patch: Partial<Assignment>) => {
    if (activeProgram)
      upsertAssignment(
        activeProgram.id,
        assignment.kind === "visita" ? "visits" : "contacts",
        { ...assignment, ...patch }
      );
  };

  return (
    <tr>
      <td className="whitespace-nowrap">{week.label}</td>
      <td>{assignees.map((a) => a!.name).join(", ") || "—"}</td>
      <td>{recipientDisplayName(recipient)}</td>
      <td>{assignment.visitType}</td>
      <td>
        <label className="block text-xs">
          Stato del turno
          <select
            className="input my-1"
            value={assignment.status ?? "Da confermare"}
            onChange={(event) =>
              save({
                status: event.target.value as Assignment["status"],
              })
            }
            aria-label={`Stato turno ${week.label}`}
          >
            {[
              "Da confermare",
              "Confermato",
              "Completato",
              "Da riprogrammare",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        {recipient && activeProgram && (
          <details className="mb-2">
            <summary>Sostituisci incaricato</summary>
            {assignment.assigneeIds.map((currentId) => {
              const rules = activeProgram.rules;
              const partner = assignees.find(
                (person) => person?.id !== currentId
              );
              const duty =
                assignment.kind === "contatto"
                  ? "contatti"
                  : assignment.visitType === "Visita in struttura"
                    ? "visiteStruttura"
                    : "visiteCasa";
              const candidates = people.filter(
                (person) =>
                  person.active &&
                  person.role === "giovane" &&
                  availableForWeek(person, week) &&
                  person.duties[duty] &&
                  !assignment.assigneeIds.includes(person.id) &&
                  canPairWith(person, recipient, rules) &&
                  (!partner ||
                    !rules.sameGenderPairs ||
                    partner.gender === person.gender) &&
                  (!rules.noDoubleDutySameWeek ||
                    !all.some(
                      (item) =>
                        item.weekId === week.id &&
                        item.assigneeIds.includes(person.id)
                    ))
              );
              return (
                <label key={currentId} className="block text-xs">
                  {people.find((person) => person.id === currentId)?.name}
                  <select
                    className="input"
                    value=""
                    aria-label={`Sostituisci ${people.find((p) => p.id === currentId)?.name}`}
                    onChange={(event) => {
                      if (event.target.value)
                        save({
                          assigneeIds: assignment.assigneeIds.map((id) =>
                            id === currentId ? event.target.value : id
                          ),
                          status: "Da confermare",
                        });
                    }}
                  >
                    <option value="">
                      {candidates.length
                        ? "Scegli sostituto"
                        : "Nessun sostituto compatibile"}
                    </option>
                    {candidates.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} ·{" "}
                        {
                          all.filter((item) =>
                            item.assigneeIds.includes(person.id)
                          ).length
                        }{" "}
                        turni
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </details>
        )}
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
  rules,
  allAssignments,
  onSave,
  onCancel,
}: {
  list: "visits" | "contacts";
  assignment: Assignment;
  weeks: WeekSlot[];
  people: Person[];
  rules: import("@/lib/types").ScheduleRules;
  allAssignments: Assignment[];
  onSave: (a: Assignment) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Assignment>(assignment);
  const [errors, setErrors] = useState<string[]>([]);
  const giovani = people.filter((p) => p.role === "giovane");
  const destinatari = people.filter((p) => p.role === "destinatario");
  const maxAssignees = list === "visits" ? 2 : 1;
  const selectedWeek = weeks.find((week) => week.id === form.weekId);

  return (
    <Modal
      title={list === "visits" ? "Modifica visita" : "Modifica contatto"}
      onClose={onCancel}
    >
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
          <span className="label">Incaricati (max {maxAssignees})</span>
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
                        if (ids.length > maxAssignees)
                          ids = ids.slice(-maxAssignees);
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
      <label className="mt-3 grid gap-1">
        Giorno e ora (facoltativi)
        <input
          type="datetime-local"
          className="input"
          value={form.appointment || ""}
          onChange={(event) =>
            setForm({
              ...form,
              appointment: event.target.value || undefined,
            })
          }
        />
        <small>
          Con orario, il calendario riserva un&apos;ora. Senza orario, crea un
          promemoria settimanale.
        </small>
      </label>
      {errors.length > 0 && (
        <ul className="mt-3 list-disc rounded-md border border-red-200 bg-red-50 px-5 py-2 text-sm text-red-800">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const errs = validateAssignment(
              form,
              selectedWeek,
              people,
              rules,
              allAssignments
            );
            setErrors(errs);
            if (errs.length) return;
            onSave(form);
          }}
        >
          Salva turno
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Annulla
        </button>
      </div>
    </Modal>
  );
}
