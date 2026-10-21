import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppSettings, Assignment, Person, Program } from "./types";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
  recipientDisplayName,
} from "./calendar";
import { monthGroups } from "./schedule";

const MARGIN_X = 14;
const NOTE =
  "Pulsante calendario: apre una pagina per aggiungere l'evento al calendario personale (Apple, Google, Outlook o altro). L'evento rimane presente per tutta la settimana indicata.";

const COLS = {
  0: { cellWidth: 48 },
  1: { cellWidth: 58 },
  2: { cellWidth: 52 },
  3: { cellWidth: 48 },
  4: { cellWidth: 52 },
};

export function downloadProgramPdf(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_X * 2;

  const groups = monthGroups(program.weeks);

  groups.forEach((group, index) => {
    if (index > 0) doc.addPage();

    let y: number;

    if (index === 0) {
      // Intestazione documento solo sulla prima pagina
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(28, 43, 42);
      doc.text(program.title, pageWidth / 2, 14, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(90);
      doc.text(program.monthsLabel, pageWidth / 2, 21, { align: "center" });

      doc.setFontSize(8);
      doc.setTextColor(100);
      const noteLines = doc.splitTextToSize(NOTE, contentWidth);
      doc.text(noteLines, pageWidth / 2, 27, {
        align: "center",
        lineHeightFactor: 1.25,
      });
      y = 27 + noteLines.length * 3.5 + 6;
      doc.setTextColor(0);
    } else {
      y = 16;
    }

    // Titolo mese — stesso stile su tutte le pagine
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(31, 111, 99);
    doc.text(group.label, MARGIN_X, y);
    y += 7;

    // Visite
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(28, 43, 42);
    doc.text("Visite a Casa o in Struttura (una visita a settimana)", MARGIN_X, y);
    y += 2;

    const visitRows = group.weeks.map((week) => {
      const a = program.visits.find((v) => v.weekId === week.id);
      return assignmentRow(a, week.label, people, program, settings, origin);
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      tableWidth: contentWidth,
      head: [
        [
          "Data",
          "Giovani Incaricati",
          "Destinatario",
          "Tipo di Visita",
          "Calendario",
        ],
      ],
      body: visitRows.map((r) => [
        r.data,
        r.incarichi,
        r.dest,
        r.tipo,
        "Aggiungi al calendario",
      ]),
      styles: {
        fontSize: 8.5,
        cellPadding: 2.2,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [30, 90, 120],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8.5,
      },
      columnStyles: COLS,
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 4) return;
        const row = visitRows[data.row.index];
        if (!row?.url) return;
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
          url: row.url,
        });
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;

    // Contatti
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(28, 43, 42);
    doc.text("Contatti Alternativi", MARGIN_X, y);
    y += 2;

    const contactRows = group.weeks.map((week) => {
      const a = program.contacts.find((v) => v.weekId === week.id);
      return assignmentRow(a, week.label, people, program, settings, origin);
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      tableWidth: contentWidth,
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
      styles: {
        fontSize: 8.5,
        cellPadding: 2.2,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [70, 110, 90],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8.5,
      },
      columnStyles: COLS,
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 4) return;
        const row = contactRows[data.row.index];
        if (!row?.url) return;
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
          url: row.url,
        });
      },
    });
  });

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
