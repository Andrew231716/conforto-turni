import type { Person, Program } from "./types";
import {
  buildProgramTables,
  programFilenameSlug,
  programToPlainText,
  rowCells,
  simpleHeaders,
  type ProgramTableRow,
} from "./programTables";
import { buildXlsxBlob } from "./xlsxExport";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Excel editabile (.xlsx OOXML, apre in Microsoft Excel / LibreOffice / Google Sheets).
 * Sempre senza colonne Stato e Calendario.
 */
export function downloadProgramExcel(program: Program, people: Person[]) {
  const tables = buildProgramTables(program, people);
  const sheets = tables.map((month) => {
    const rows: string[][] = [
      [program.title],
      [`${program.monthsLabel} — ${month.label}`],
      [],
      ["Visite a Casa o in Struttura"],
      simpleHeaders("visita"),
      ...month.visits.map((r) => rowCells(r, "simple")),
      [],
      ["Contatti Alternativi"],
      simpleHeaders("contatto"),
      ...month.contacts.map((r) => rowCells(r, "simple")),
    ];
    return { name: month.label, rows };
  });

  const blob = buildXlsxBlob(sheets);
  downloadBlob(
    blob,
    `programma_${programFilenameSlug(program)}_editabile.xlsx`
  );
}

/**
 * Word editabile (.docx). Sempre senza colonne Stato e Calendario.
 * Import dinamico di `docx` per evitare problemi SSR.
 */
export async function downloadProgramWord(
  program: Program,
  people: Person[]
) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const border = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "C8D2CD" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "C8D2CD" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "C8D2CD" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "C8D2CD" },
  };

  const headerCell = (text: string, fill: string) =>
    new TableCell({
      borders: border,
      width: { size: 2200, type: WidthType.DXA },
      shading: { fill },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text, bold: true, color: "FFFFFF", size: 20 }),
          ],
        }),
      ],
    });

  const bodyCell = (text: string) =>
    new TableCell({
      borders: border,
      width: { size: 2200, type: WidthType.DXA },
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 20 })],
        }),
      ],
    });

  const makeTable = (headers: string[], rows: ProgramTableRow[], headFill: string) =>
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: headers.map((h) => headerCell(h, headFill)),
        }),
        ...rows.map(
          (r) =>
            new TableRow({
              children: rowCells(r, "simple").map((c) => bodyCell(c)),
            })
        ),
      ],
    });

  const tables = buildProgramTables(program, people);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: program.title, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${program.monthsLabel} — versione editabile (senza Stato e Calendario)`,
          italics: true,
          size: 22,
        }),
      ],
    }),
  ];

  for (const month of tables) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        children: [
          new TextRun({ text: month.label, bold: true, color: "1F6F63" }),
        ],
      }),
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: "Visite a Casa o in Struttura",
            bold: true,
            size: 22,
          }),
        ],
      }),
      makeTable(simpleHeaders("visita"), month.visits, "1E5A78"),
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({ text: "Contatti Alternativi", bold: true, size: 22 }),
        ],
      }),
      makeTable(simpleHeaders("contatto"), month.contacts, "466E5A")
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(
    blob,
    `programma_${programFilenameSlug(program)}_editabile.docx`
  );
}

/** Copia testo semplice negli appunti (per invio WhatsApp / email) */
export async function copyProgramPlainText(
  program: Program,
  people: Person[]
): Promise<boolean> {
  const text = programToPlainText(program, people);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export { programToPlainText };
