import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppSettings, Assignment, Person, Program } from "./types";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
  recipientDisplayName,
} from "./calendar";
import { monthGroups } from "./schedule";

export function downloadProgramPdf(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(program.title, pageWidth / 2, 16, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(program.monthsLabel, pageWidth / 2, 24, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    "Pulsante calendario: apre una pagina per aggiungere l'evento al calendario personale (Apple, Google, Outlook o altro). L'evento rimane presente per tutta la settimana indicata.",
    pageWidth / 2,
    30,
    { align: "center", maxWidth: pageWidth - 30 }
  );
  doc.setTextColor(0);

  const groups = monthGroups(program.weeks);
  let first = true;

  for (const group of groups) {
    if (!first) doc.addPage();
    first = false;

    let y = 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(group.label, 14, y);
    y += 6;

    doc.setFontSize(11);
    doc.text("Visite a Casa o in Struttura (una visita a settimana)", 14, y);
    y += 2;

    const visitRows = group.weeks.map((week) => {
      const a = program.visits.find((v) => v.weekId === week.id);
      return assignmentRow(a, week.label, people, program, settings, origin);
    });

    autoTable(doc, {
      startY: y,
      head: [["Data", "Giovani Incaricati", "Destinatario", "Tipo di Visita", "Calendario"]],
      body: visitRows.map((r) => [r.data, r.incarichi, r.dest, r.tipo, "Aggiungi al calendario"]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 90, 120], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 55 },
        2: { cellWidth: 50 },
        3: { cellWidth: 40 },
        4: { cellWidth: 45 },
      },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 4) return;
        const row = visitRows[data.row.index];
        if (!row?.url) return;
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
          url: row.url,
        });
        doc.setTextColor(20, 90, 180);
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Contatti Alternativi", 14, y);
    y += 2;

    const contactRows = group.weeks.map((week) => {
      const a = program.contacts.find((v) => v.weekId === week.id);
      return assignmentRow(a, week.label, people, program, settings, origin);
    });

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Data",
          "Giovane",
          "Destinatario",
          "Tipo di Incoraggiamento (a scelta)",
          "Calendario",
        ],
      ],
      body: contactRows.map((r) => [
        r.data,
        r.incarichi,
        r.dest,
        r.tipo,
        "Aggiungi al calendario",
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [70, 110, 90], textColor: 255 },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 4) return;
        const row = contactRows[data.row.index];
        if (!row?.url) return;
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
          url: row.url,
        });
      },
    });
  }

  const filename = `programma_${program.monthsLabel.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

function assignmentRow(
  a: Assignment | undefined,
  label: string,
  people: Person[],
  program: Program,
  settings: AppSettings,
  origin: string
) {
  if (!a) {
    return { data: label, incarichi: "—", dest: "—", tipo: "—", url: "" };
  }
  const week = program.weeks.find((w) => w.id === a.weekId)!;
  const recipient = people.find((p) => p.id === a.recipientId);
  const assignees = a.assigneeIds
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const payload = buildEventPayload(a, week, people);
  const url = buildCalendarLinkUrl(payload, settings, origin);
  return {
    data: label,
    incarichi: assignees,
    dest: recipientDisplayName(recipient),
    tipo: a.visitType,
    url,
  };
}
