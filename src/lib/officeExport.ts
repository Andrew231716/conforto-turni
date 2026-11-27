import type { Person, Program } from "./types";
import {
  buildProgramTables,
  programFilenameSlug,
  programToPlainText,
  rowCells,
  simpleHeaders,
  type ProgramTableRow,
} from "./programTables";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sheetRowsXml(headers: string[], rows: ProgramTableRow[]): string {
  const head = `<Row>${headers
    .map(
      (h) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`
    )
    .join("")}</Row>`;
  const body = rows
    .map((r) => {
      const cells = rowCells(r, "simple")
        .map(
          (c) =>
            `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`
        )
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  return head + body;
}

/**
 * Excel editabile (SpreadsheetML 2003, apre in Excel / LibreOffice / Google Sheets).
 * Sempre senza colonne Stato e Calendario.
 */
export function downloadProgramExcel(program: Program, people: Person[]) {
  const tables = buildProgramTables(program, people);
  const sheets = tables
    .map((month, i) => {
      const name = sanitizeSheetName(month.label, i);
      const visits = sheetRowsXml(simpleHeaders("visita"), month.visits);
      const contacts = sheetRowsXml(simpleHeaders("contatto"), month.contacts);
      return `
  <Worksheet ss:Name="${xmlEscape(name)}">
   <Table>
    <Column ss:Width="120"/>
    <Column ss:Width="140"/>
    <Column ss:Width="130"/>
    <Column ss:Width="150"/>
    <Row><Cell ss:StyleID="Title"><Data ss:Type="String">${xmlEscape(program.title)}</Data></Cell></Row>
    <Row><Cell><Data ss:Type="String">${xmlEscape(program.monthsLabel)} — ${xmlEscape(month.label)}</Data></Cell></Row>
    <Row></Row>
    <Row><Cell ss:StyleID="Section"><Data ss:Type="String">Visite a Casa o in Struttura</Data></Cell></Row>
    ${visits}
    <Row></Row>
    <Row><Cell ss:StyleID="Section"><Data ss:Type="String">Contatti Alternativi</Data></Cell></Row>
    ${contacts}
   </Table>
  </Worksheet>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E5A78" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="14"/>
  </Style>
  <Style ss:ID="Section">
   <Font ss:Bold="1" ss:Size="11"/>
   <Interior ss:Color="#E8F2EF" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${sheets}
</Workbook>`;

  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  downloadBlob(
    blob,
    `programma_${programFilenameSlug(program)}_editabile.xls`
  );
}

function sanitizeSheetName(label: string, index: number): string {
  const cleaned = label.replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 28);
  return cleaned || `Mese ${index + 1}`;
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
