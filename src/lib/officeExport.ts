import type { Person, Program } from "./types";
import { downloadBlob } from "./download";
import {
  buildProgramTables,
  programFilenameSlug,
  programToPlainText,
  rowCells,
  simpleHeaders,
} from "./programTables";
import { buildDocxBlob } from "./docxExport";
import { buildXlsxBlob } from "./xlsxExport";

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
 * Word editabile (.docx OOXML nativo). Sempre senza colonne Stato e Calendario.
 */
export function downloadProgramWord(program: Program, people: Person[]) {
  const tables = buildProgramTables(program, people);
  const blob = buildDocxBlob({
    title: program.title,
    subtitle: `${program.monthsLabel} — versione editabile (senza Stato e Calendario)`,
    sections: tables.map((month) => ({
      heading: month.label,
      blocks: [
        {
          title: "Visite a Casa o in Struttura",
          headers: simpleHeaders("visita"),
          rows: month.visits.map((r) => rowCells(r, "simple")),
        },
        {
          title: "Contatti Alternativi",
          headers: simpleHeaders("contatto"),
          rows: month.contacts.map((r) => rowCells(r, "simple")),
        },
      ],
    })),
  });
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
    // Fallback se clipboard API non disponibile
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export { programToPlainText };
