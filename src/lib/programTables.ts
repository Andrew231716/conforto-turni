import type { Assignment, Person, Program } from "./types";
import { recipientDisplayName } from "./calendar";
import { monthGroups } from "./schedule";

export type ExportLayout = "full" | "simple";

export interface ProgramTableRow {
  data: string;
  incarichi: string;
  dest: string;
  tipo: string;
  stato: string;
  calendarLabel: string;
  calendarUrl: string;
}

export interface ProgramMonthTables {
  label: string;
  visits: ProgramTableRow[];
  contacts: ProgramTableRow[];
}

/** Righe tabellari del programma, usate da PDF / Excel / Word / anteprima */
export function buildProgramTables(
  program: Program,
  people: Person[],
  calendarUrlFor?: (a: Assignment) => string
): ProgramMonthTables[] {
  return monthGroups(program.weeks).map((group) => ({
    label: group.label,
    visits: group.weeks.map((week) =>
      toRow(
        program.visits.find((v) => v.weekId === week.id),
        week.label,
        people,
        calendarUrlFor
      )
    ),
    contacts: group.weeks.map((week) =>
      toRow(
        program.contacts.find((v) => v.weekId === week.id),
        week.label,
        people,
        calendarUrlFor
      )
    ),
  }));
}

function toRow(
  a: Assignment | undefined,
  label: string,
  people: Person[],
  calendarUrlFor?: (a: Assignment) => string
): ProgramTableRow {
  if (!a) {
    return {
      data: label,
      incarichi: "—",
      dest: "—",
      tipo: "—",
      stato: "—",
      calendarLabel: "—",
      calendarUrl: "",
    };
  }
  const recipient = people.find((p) => p.id === a.recipientId);
  const assignees = a.assigneeIds
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  return {
    data: label,
    incarichi: assignees || "—",
    dest: recipientDisplayName(recipient),
    tipo: a.visitType,
    stato: a.status ?? "Da confermare",
    calendarLabel: "Aggiungi al calendario",
    calendarUrl: calendarUrlFor?.(a) ?? "",
  };
}

export function simpleHeaders(kind: "visita" | "contatto"): string[] {
  return kind === "visita"
    ? ["Data", "Giovani Incaricati", "Destinatario", "Tipo di Visita"]
    : ["Data", "Giovane", "Destinatario", "Tipo di Incoraggiamento"];
}

export function fullHeaders(kind: "visita" | "contatto"): string[] {
  return [...simpleHeaders(kind), "Stato", "Calendario"];
}

export function rowCells(
  row: ProgramTableRow,
  layout: ExportLayout
): string[] {
  const base = [row.data, row.incarichi, row.dest, row.tipo];
  if (layout === "simple") return base;
  return [...base, row.stato, row.calendarLabel];
}

export function programFilenameSlug(program: Program): string {
  return program.monthsLabel.replace(/\s+/g, "_") || "programma";
}

/** Testo semplice (senza stato/calendario) per copia o WhatsApp */
export function programToPlainText(
  program: Program,
  people: Person[]
): string {
  const tables = buildProgramTables(program, people);
  const lines: string[] = [
    program.title,
    program.monthsLabel,
    "",
  ];
  for (const month of tables) {
    lines.push(`▸ ${month.label}`);
    lines.push("Visite:");
    for (const r of month.visits) {
      lines.push(`• ${r.data} — ${r.incarichi} → ${r.dest} (${r.tipo})`);
    }
    lines.push("Contatti:");
    for (const r of month.contacts) {
      lines.push(`• ${r.data} — ${r.incarichi} → ${r.dest}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
