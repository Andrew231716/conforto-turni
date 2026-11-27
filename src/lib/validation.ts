import {
  availableForWeek,
  canPairWith,
} from "./schedule";
import type {
  Assignment,
  Person,
  Program,
  ScheduleRules,
  WeekSlot,
} from "./types";

/** Controlla che un incarico rispetti le regole del programma */
export function validateAssignment(
  assignment: Assignment,
  week: WeekSlot | undefined,
  people: Person[],
  rules: ScheduleRules,
  allInProgram: Assignment[]
): string[] {
  const errors: string[] = [];
  if (!assignment.recipientId) errors.push("Seleziona un destinatario.");
  if (!assignment.assigneeIds.length) {
    errors.push("Seleziona almeno un incaricato.");
  }

  const recipient = people.find((p) => p.id === assignment.recipientId);
  if (assignment.recipientId && !recipient) {
    errors.push("Destinatario non trovato.");
  }

  const expected =
    assignment.kind === "visita" ? rules.visitPairSize : 1;
  if (
    assignment.assigneeIds.length > 0 &&
    assignment.assigneeIds.length !== expected
  ) {
    errors.push(
      assignment.kind === "visita"
        ? `Le visite richiedono ${expected} incaricati.`
        : "I contatti richiedono un solo incaricato."
    );
  }

  if (!week) {
    errors.push("Settimana non valida.");
    return errors;
  }

  const date = assignment.appointment?.slice(0, 10);
  if (date && (date < week.startDate || date > week.endDate)) {
    errors.push("La data dell'appuntamento deve stare nel periodo del turno.");
  }

  const assignees = assignment.assigneeIds
    .map((id) => people.find((p) => p.id === id))
    .filter(Boolean) as Person[];

  for (const g of assignees) {
    if (!g.active) errors.push(`${g.name} non è attivo/a.`);
    if (week && !availableForWeek(g, week)) {
      errors.push(`${g.name} risulta indisponibile in questo periodo.`);
    }
    if (recipient && !canPairWith(g, recipient, rules)) {
      errors.push(`${g.name} non è compatibile con ${recipient.name} (regole di genere).`);
    }
    const dutyOk =
      assignment.kind === "contatto"
        ? g.duties.contatti
        : assignment.visitType === "Visita in struttura"
          ? g.duties.visiteStruttura
          : g.duties.visiteCasa;
    if (!dutyOk) {
      errors.push(`${g.name} non è abilitato/a a questo tipo di incarico.`);
    }
  }

  if (
    rules.sameGenderPairs &&
    assignment.kind === "visita" &&
    assignees.length === 2 &&
    assignees[0].gender !== assignees[1].gender
  ) {
    errors.push("La coppia deve essere dello stesso sesso.");
  }

  if (rules.noDoubleDutySameWeek) {
    for (const g of assignees) {
      const clash = allInProgram.some(
        (item) =>
          item.id !== assignment.id &&
          item.weekId === assignment.weekId &&
          item.assigneeIds.includes(g.id)
      );
      if (clash) {
        errors.push(
          `${g.name} ha già un altro incarico nella stessa settimana.`
        );
      }
    }
  }

  return errors;
}

/** Avvisi bloccanti prima di generare (pool insufficiente / senza telefono) */
export function generationBlockers(people: Person[]): string[] {
  const blockers: string[] = [];
  const giovani = people.filter((p) => p.role === "giovane" && p.active);
  const casa = giovani.filter((p) => p.duties.visiteCasa);
  const struttura = giovani.filter((p) => p.duties.visiteStruttura);
  const contatti = giovani.filter((p) => p.duties.contatti);
  if (casa.length + struttura.length < 2) {
    blockers.push(
      "Servono almeno 2 giovani abilitati alle visite (casa o struttura)."
    );
  }
  if (!contatti.length) {
    blockers.push("Nessun giovane abilitato ai contatti alternativi.");
  }
  const withoutPhone = giovani.filter((p) => !p.phone?.trim());
  if (withoutPhone.length) {
    blockers.push(
      `Numeri WhatsApp mancanti: ${withoutPhone.map((p) => p.name).join(", ")}.`
    );
  }
  return blockers;
}

export function stripPersonFromPrograms(
  programs: Program[],
  personId: string
): Program[] {
  const now = new Date().toISOString();
  return programs.map((prog) => {
    const clean = (list: Assignment[]) =>
      list
        .map((a) => ({
          ...a,
          assigneeIds: a.assigneeIds.filter((id) => id !== personId),
        }))
        .filter((a) => a.recipientId !== personId && a.assigneeIds.length > 0);
    return {
      ...prog,
      visits: clean(prog.visits),
      contacts: clean(prog.contacts),
      updatedAt: now,
    };
  });
}
