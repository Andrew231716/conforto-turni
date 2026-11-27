import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppSettings, Person, Program } from "./types";
import {
  buildCalendarLinkUrl,
  buildEventPayload,
} from "./calendar";
import {
  buildProgramTables,
  fullHeaders,
  programFilenameSlug,
  rowCells,
  simpleHeaders,
  type ExportLayout,
  type ProgramTableRow,
} from "./programTables";

const MARGIN_X = 12;
const NOTE_FULL =
  "Pulsante calendario: apre una pagina per aggiungere l'evento al calendario personale (Apple, Google, Outlook o altro). L'evento rimane presente per tutta la settimana indicata.";
const NOTE_SIMPLE =
  "Versione da condividere: senza colonne Stato e Calendario.";

export type { ExportLayout };

export function downloadProgramPdf(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string,
  layout: ExportLayout = "full"
) {
  const doc = buildProgramPdfDoc(program, people, settings, origin, layout);
  const suffix = layout === "simple" ? "_condivisione" : "";
  doc.save(`programma_${programFilenameSlug(program)}${suffix}.pdf`);
}

/** Blob PDF per eventuali usi futuri (condivisione file) */
export function programPdfBlob(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string,
  layout: ExportLayout = "full"
): Blob {
  const doc = buildProgramPdfDoc(program, people, settings, origin, layout);
  return doc.output("blob");
}

function buildProgramPdfDoc(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string,
  layout: ExportLayout
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;

  const COLS: Record<number, { cellWidth: number }> =
    layout === "simple"
      ? {
          0: { cellWidth: 46 },
          1: { cellWidth: 50 },
          2: { cellWidth: 46 },
          3: { cellWidth: 44 },
        }
      : {
          0: { cellWidth: 32 },
          1: { cellWidth: 36 },
          2: { cellWidth: 32 },
          3: { cellWidth: 30 },
          4: { cellWidth: 24 },
          5: { cellWidth: 32 },
        };

  const tables = buildProgramTables(program, people, (a) => {
    const week = program.weeks.find((w) => w.id === a.weekId);
    if (!week) return "";
    const payload = buildEventPayload(
      a,
      week,
      people,
      settings.timezone || "Europe/Rome"
    );
    return buildCalendarLinkUrl(payload, settings, origin);
  });

  tables.forEach((group, index) => {
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
      const note = layout === "simple" ? NOTE_SIMPLE : NOTE_FULL;
      const noteLines = doc.splitTextToSize(note, contentWidth);
      doc.text(noteLines, pageWidth / 2, 31, {
        align: "center",
        lineHeightFactor: 1.35,
      });
      y = 31 + noteLines.length * 4.2 + 8;
      doc.setTextColor(0);
    } else {
      y = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(31, 111, 99);
    doc.text(group.label, MARGIN_X, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(28, 43, 42);
    doc.text("Visite a Casa o in Struttura (una visita a settimana)", MARGIN_X, y);
    y += 3;

    y = drawTable(doc, {
      startY: y,
      contentWidth,
      head: layout === "simple" ? simpleHeaders("visita") : fullHeaders("visita"),
      rows: group.visits,
      layout,
      headFill: [30, 90, 120],
      columnStyles: COLS,
      linkColumn: layout === "full" ? 5 : -1,
    });

    y += 10;

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

    drawTable(doc, {
      startY: y,
      contentWidth,
      head:
        layout === "simple"
          ? simpleHeaders("contatto")
          : fullHeaders("contatto"),
      rows: group.contacts,
      layout,
      headFill: [70, 110, 90],
      columnStyles: COLS,
      linkColumn: layout === "full" ? 5 : -1,
    });
  });

  return doc;
}

function drawTable(
  doc: jsPDF,
  opts: {
    startY: number;
    contentWidth: number;
    head: string[];
    rows: ProgramTableRow[];
    layout: ExportLayout;
    headFill: [number, number, number];
    columnStyles: Record<number, { cellWidth: number }>;
    linkColumn: number;
  }
): number {
  autoTable(doc, {
    rowPageBreak: "avoid",
    startY: opts.startY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 14 },
    tableWidth: opts.contentWidth,
    head: [opts.head],
    body: opts.rows.map((r) => rowCells(r, opts.layout)),
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
      fillColor: opts.headFill,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 11,
      cellPadding: 3.2,
    },
    alternateRowStyles: { fillColor: [248, 251, 249] },
    columnStyles: opts.columnStyles,
    didDrawCell: (data) => {
      if (opts.linkColumn < 0) return;
      if (data.section !== "body" || data.column.index !== opts.linkColumn)
        return;
      const row = opts.rows[data.row.index];
      if (!row?.calendarUrl) return;
      doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
        url: row.calendarUrl,
      });
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((doc as any).lastAutoTable?.finalY ?? opts.startY) as number;
}
