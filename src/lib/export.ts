import type { Person, Program } from "./types";
import { recipientDisplayName } from "./calendar";

/** Esporta il programma attivo in CSV (visite + contatti) */
export function programToCsv(program: Program, people: Person[]): string {
  const byId = new Map(people.map((p) => [p.id, p]));
  const header = [
    "tipo",
    "periodo",
    "inizio",
    "fine",
    "incaricati",
    "destinatario",
    "dettaglio",
    "stato",
    "appuntamento",
  ];
  const rows: string[][] = [header];

  const weekById = new Map(program.weeks.map((w) => [w.id, w]));

  const push = (
    kind: "visita" | "contatto",
    list: Program["visits"]
  ) => {
    for (const a of list) {
      const week = weekById.get(a.weekId);
      const assignees = a.assigneeIds
        .map((id) => byId.get(id)?.name ?? id)
        .join("; ");
      const recipient = byId.get(a.recipientId);
      rows.push([
        kind,
        week?.label ?? "",
        week?.startDate ?? "",
        week?.endDate ?? "",
        assignees,
        recipientDisplayName(recipient),
        a.visitType,
        a.status ?? "",
        a.appointment ?? "",
      ]);
    }
  };

  push("visita", program.visits);
  push("contatto", program.contacts);

  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadTextFile(
  content: string,
  filename: string,
  mime = "text/csv;charset=utf-8"
) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Conteggio turni per giovane nel programma */
export function workloadByPerson(
  program: Program,
  people: Person[]
): { id: string; name: string; visits: number; contacts: number; total: number }[] {
  const giovani = people.filter((p) => p.role === "giovane" && p.active);
  return giovani
    .map((g) => {
      const visits = program.visits.filter((a) =>
        a.assigneeIds.includes(g.id)
      ).length;
      const contacts = program.contacts.filter((a) =>
        a.assigneeIds.includes(g.id)
      ).length;
      return {
        id: g.id,
        name: g.name,
        visits,
        contacts,
        total: visits + contacts,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "it"));
}
