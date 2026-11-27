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
export type PdfDownloadKind = ExportLayout;

export function downloadProgramPdf(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string,
  kind: PdfDownloadKind = "full"
) {
  const doc = buildProgramPdfDoc(program, people, settings, origin, kind);
  const suffix = kind === "simple" ? "_condivisione" : "";
  doc.save(`programma_${programFilenameSlug(program)}${suffix}.pdf`);
}

/** Blob PDF per eventuali usi futuri (condivisione file) */
export function programPdfBlob(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string,
  kind: PdfDownloadKind = "full"
): Blob {
  const doc = buildProgramPdfDoc(program, people, settings, origin, kind);
  return doc.output("blob");
}

function buildProgramPdfDoc(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string,
  kind: PdfDownloadKind
) {
  const layout: ExportLayout = kind;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;

  // Larghezze che stanno davvero in pagina (somma < contentWidth)
  const COLS: Record<number, { cellWidth: number }> =
    layout === "simple"
      ? {
          0: { cellWidth: 40 },
          1: { cellWidth: 48 },
          2: { cellWidth: 42 },
          3: { cellWidth: 48 },
        }
      : {
          0: { cellWidth: 30 },
          1: { cellWidth: 34 },
          2: { cellWidth: 30 },
          3: { cellWidth: 28 },
          4: { cellWidth: 22 },
          5: { cellWidth: 30 },
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
      doc.setFontSize(16);
      doc.setTextColor(28, 43, 42);
      doc.text(program.title, pageWidth / 2, 14, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(70);
      doc.text(program.monthsLabel, pageWidth / 2, 21, { align: "center" });

      doc.setFontSize(9);
      doc.setTextColor(90);
      const note = layout === "simple" ? NOTE_SIMPLE : NOTE_FULL;
      const noteLines = doc.splitTextToSize(note, contentWidth);
      doc.text(noteLines, pageWidth / 2, 27, {
        align: "center",
        lineHeightFactor: 1.3,
      });
      y = 27 + noteLines.length * 3.8 + 6;
      doc.setTextColor(0);
    } else {
      y = 16;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(31, 111, 99);
    doc.text(group.label, MARGIN_X, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 43, 42);
    doc.text("Visite a Casa o in Struttura", MARGIN_X, y);
    y += 2;

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

    y += 8;

    if (y > pageHeight - 55) {
      doc.addPage();
      y = 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(31, 111, 99);
      doc.text(`${group.label} (cont.)`, MARGIN_X, y);
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 43, 42);
    doc.text("Contatti Alternativi", MARGIN_X, y);
    y += 2;

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

/** Spezza testi lunghi senza spazi (es. Telefonata/Messaggio/…) per non schiacciare le colonne */
function softenCellText(value: string): string {
  return value
    .replace(/\//g, " / ")
    .replace(/,/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
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
  const body = opts.rows.map((r) =>
    rowCells(r, opts.layout).map(softenCellText)
  );

  autoTable(doc, {
    startY: opts.startY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 12 },
    tableWidth: opts.contentWidth,
    head: [opts.head],
    body,
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
      overflow: "linebreak",
      valign: "top",
      textColor: [28, 43, 42],
      lineColor: [200, 210, 205],
      lineWidth: 0.2,
      minCellHeight: 7,
    },
    headStyles: {
      fillColor: opts.headFill,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 2.4,
      valign: "middle",
      overflow: "linebreak",
    },
    alternateRowStyles: { fillColor: [248, 251, 249] },
    columnStyles: opts.columnStyles,
    didDrawCell: (data) => {
      if (
        opts.linkColumn >= 0 &&
        data.section === "body" &&
        data.column.index === opts.linkColumn
      ) {
        const row = opts.rows[data.row.index];
        if (row?.calendarUrl) {
          doc.link(
            data.cell.x,
            data.cell.y,
            data.cell.width,
            data.cell.height,
            { url: row.calendarUrl }
          );
        }
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((doc as any).lastAutoTable?.finalY ?? opts.startY) as number;
}
