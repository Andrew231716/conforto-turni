import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppSettings, Assignment, Person, Program } from "./types";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
  recipientDisplayName,
} from "./calendar";
import { monthGroups } from "./schedule";

const MARGIN_X = 12;
const NOTE =
  "Pulsante calendario: apre una pagina per aggiungere l'evento al calendario personale (Apple, Google, Outlook o altro). L'evento rimane presente per tutta la settimana indicata.";

export function downloadProgramPdf(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;

  // Colonne bilanciate su A4 verticale (~186mm utili)
  const COLS = {
    0: { cellWidth: 36 },
    1: { cellWidth: 42 },
    2: { cellWidth: 38 },
    3: { cellWidth: 36 },
    4: { cellWidth: 34 },
  };

  const groups = monthGroups(program.weeks);

  groups.forEach((group, index) => {
    if (index > 0) doc.addPage();

    let y: number;

    if (index === 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(28, 43, 42);
      doc.text(program.title, pageWidth / 2, 16, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(70);
      doc.text(program.monthsLabel, pageWidth / 2, 24, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(90);
      const noteLines = doc.splitTextToSize(NOTE, contentWidth);
      doc.text(noteLines, pageWidth / 2, 31, {
        align: "center",
        lineHeightFactor: 1.35,
      });
      y = 31 + noteLines.length * 4.2 + 8;
      doc.setTextColor(0);
    } else {
      y = 18;
    }

    // Titolo mese
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(31, 111, 99);
    doc.text(group.label, MARGIN_X, y);
    y += 8;

    // Visite
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(28, 43, 42);
    doc.text("Visite a Casa o in Struttura (una visita a settimana)", MARGIN_X, y);
    y += 3;

    const visitRows = group.weeks.map((week) => {
      const a = program.visits.find((v) => v.weekId === week.id);
      return assignmentRow(a, week.label, people, program, settings, origin);
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X, bottom: 14 },
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
        fontSize: 11,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "middle",
        textColor: [28, 43, 42],
        lineColor: [200, 210, 205],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 90, 120],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 11,
        cellPadding: 3.2,
      },
      alternateRowStyles: { fillColor: [248, 251, 249] },
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
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

    // Se non c'è spazio per i contatti, nuova pagina con stesso mese
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(31, 111, 99);
      doc.text(`${group.label} (cont.)`, MARGIN_X, y);
      y += 8;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(28, 43, 42);
    doc.text("Contatti Alternativi", MARGIN_X, y);
    y += 3;

    const contactRows = group.weeks.map((week) => {
      const a = program.contacts.find((v) => v.weekId === week.id);
      return assignmentRow(a, week.label, people, program, settings, origin);
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X, bottom: 14 },
      tableWidth: contentWidth,
      head: [
        [
          "Data",
          "Giovane",
          "Destinatario",
          "Tipo di Incoraggiamento",
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
        fontSize: 11,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "middle",
        textColor: [28, 43, 42],
        lineColor: [200, 210, 205],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [70, 110, 90],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 11,
        cellPadding: 3.2,
      },
      alternateRowStyles: { fillColor: [248, 251, 249] },
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
