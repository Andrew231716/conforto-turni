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
const NOTE_EDITABLE =
  "PDF editabile: senza Stato e Calendario. Ogni casella della tabella si può modificare con Anteprima, Acrobat o un lettore PDF compatibile.";

export type { ExportLayout };
export type PdfDownloadKind = ExportLayout | "editable";

export function downloadProgramPdf(
  program: Program,
  people: Person[],
  settings: AppSettings,
  origin: string,
  kind: PdfDownloadKind = "full"
) {
  const doc = buildProgramPdfDoc(program, people, settings, origin, kind);
  const suffix =
    kind === "editable"
      ? "_editabile"
      : kind === "simple"
        ? "_condivisione"
        : "";
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
  const layout: ExportLayout = kind === "full" ? "full" : "simple";
  const editable = kind === "editable";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;
  let fieldSeq = 0;

  // Stesse 4 colonne della versione semplice (niente Note / Stato / Calendario)
  const COLS: Record<number, { cellWidth: number }> =
    layout === "simple" || editable
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
      const note = editable
        ? NOTE_EDITABLE
        : layout === "simple"
          ? NOTE_SIMPLE
          : NOTE_FULL;
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

    const visitHead =
      layout === "simple" || editable
        ? simpleHeaders("visita")
        : fullHeaders("visita");

    y = drawTable(doc, {
      startY: y,
      contentWidth,
      head: visitHead,
      rows: group.visits,
      layout: editable ? "simple" : layout,
      editable,
      headFill: [30, 90, 120],
      columnStyles: COLS,
      linkColumn: layout === "full" ? 5 : -1,
      nextFieldName: (row, col) => `v_${index}_${row}_${col}_${fieldSeq++}`,
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

    const contactHead =
      layout === "simple" || editable
        ? simpleHeaders("contatto")
        : fullHeaders("contatto");

    drawTable(doc, {
      startY: y,
      contentWidth,
      head: contactHead,
      rows: group.contacts,
      layout: editable ? "simple" : layout,
      editable,
      headFill: [70, 110, 90],
      columnStyles: COLS,
      linkColumn: layout === "full" ? 5 : -1,
      nextFieldName: (row, col) => `c_${index}_${row}_${col}_${fieldSeq++}`,
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
    editable: boolean;
    headFill: [number, number, number];
    columnStyles: Record<number, { cellWidth: number }>;
    linkColumn: number;
    nextFieldName: (row: number, col: number) => string;
  }
): number {
  const valueRows = opts.rows.map((r) => rowCells(r, opts.layout));
  // In modalità editabile le celle stampate restano vuote: il testo va nei campi AcroForm
  const body = opts.editable
    ? valueRows.map((cells) => cells.map(() => " "))
    : valueRows;

  autoTable(doc, {
    rowPageBreak: "avoid",
    startY: opts.startY,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 14 },
    tableWidth: opts.contentWidth,
    head: [opts.head],
    body,
    styles: {
      fontSize: 11,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "middle",
      textColor: [28, 43, 42],
      lineColor: [200, 210, 205],
      lineWidth: 0.2,
      minCellHeight: opts.editable ? 11 : undefined,
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
      if (data.section !== "body") return;

      if (
        opts.linkColumn >= 0 &&
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
        return;
      }

      if (!opts.editable) return;

      const values = valueRows[data.row.index];
      if (!values) return;
      const value = values[data.column.index] ?? "";
      addEditableField(
        doc,
        opts.nextFieldName(data.row.index, data.column.index),
        value === "—" ? "" : value,
        data.cell.x,
        data.cell.y,
        data.cell.width,
        data.cell.height
      );
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((doc as any).lastAutoTable?.finalY ?? opts.startY) as number;
}

function addEditableField(
  doc: jsPDF,
  fieldName: string,
  value: string,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number
) {
  // jsPDF AcroForm: stesse coordinate del documento (origine in alto a sinistra)
  const pad = 0.8;
  const x = cellX + pad;
  const y = cellY + pad;
  const w = Math.max(4, cellW - pad * 2);
  const h = Math.max(6, cellH - pad * 2);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TextField = (jsPDF as any).AcroForm.TextField;
  const field = new TextField();
  field.fieldName = fieldName;
  field.Rect = [x, y, w, h];
  field.multiline = true;
  field.value = value;
  field.fontSize = 9;
  field.maxFontSize = 9;
  try {
    field.backgroundColor = [255, 255, 255];
  } catch {
    // alcune versioni non espongono backgroundColor
  }
  doc.addField(field);
}
