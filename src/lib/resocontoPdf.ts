import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { ResocontoData } from "./resoconto";

const MARGIN_X = 12;

function resocontoFilename(data: ResocontoData) {
  const stamp = format(parseISO(data.generatedAt), "yyyy-MM-dd");
  return `resoconto_destinatari_${stamp}.pdf`;
}

/** Costruisce il documento PDF del resoconto */
export function buildResocontoPdfDoc(data: ResocontoData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_X * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(28, 43, 42);
  doc.text("Resoconto destinatari", pageWidth / 2, 16, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(70);
  doc.text(`Periodo: ${data.windowLabel}`, pageWidth / 2, 23, {
    align: "center",
  });
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `Generato il ${format(parseISO(data.generatedAt), "d MMMM yyyy HH:mm", { locale: it })}`,
    pageWidth / 2,
    28,
    { align: "center" }
  );

  let y = 36;
  doc.setFontSize(10);
  doc.setTextColor(28, 43, 42);
  doc.text(
    `Destinatari ${data.totals.recipients} · Visite ${data.totals.visits} · Contatti ${data.totals.contacts} · Mai raggiunti ${data.totals.neverVisited}`,
    MARGIN_X,
    y
  );
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(31, 111, 99);
  doc.text("Ultimi 6 mesi — quante volte", MARGIN_X, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 14 },
    tableWidth: contentWidth,
    head: [["Destinatario", "Visite", "Contatti", "Totale", "Ultimo incontro"]],
    body: data.destinatari.map((d) => [
      d.displayName,
      String(d.visitCount),
      String(d.contactCount),
      String(d.totalCount),
      d.lastVisitLabel ?? "—",
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "top",
      textColor: [28, 43, 42],
      lineColor: [200, 210, 205],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 90, 120],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 251, 249] },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 18 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { cellWidth: 65 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(31, 111, 99);
  if (y > 250) {
    doc.addPage();
    y = 18;
  }
  doc.text("Cronologia (ordine temporale)", MARGIN_X, y);
  y += 2;

  const chronoRows: string[][] = [];
  for (const d of data.destinatari) {
    if (!d.chronology.length) {
      chronoRows.push([d.displayName, "—", "Nessun incontro nel periodo", ""]);
      continue;
    }
    d.chronology.forEach((e, i) => {
      chronoRows.push([
        i === 0 ? d.displayName : "",
        e.date,
        `${e.kind}: ${e.periodLabel}`,
        e.assigneeNames,
      ]);
    });
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 14 },
    tableWidth: contentWidth,
    head: [["Destinatario", "Data", "Periodo", "Incaricati"]],
    body: chronoRows,
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      overflow: "linebreak",
      valign: "top",
      textColor: [28, 43, 42],
      lineColor: [200, 210, 205],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [70, 110, 90],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 251, 249] },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 24 },
      2: { cellWidth: 60 },
      3: { cellWidth: 52 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

  if (y > 230) {
    doc.addPage();
    y = 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(31, 111, 99);
  doc.text("Previsione prossimi mesi", MARGIN_X, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  const tip = doc.splitTextToSize(
    "Ordine consigliato in base a chi non è stato visitato o contattato da più tempo (prima chi non compare negli ultimi 6 mesi).",
    contentWidth
  );
  doc.text(tip, MARGIN_X, y);
  y += tip.length * 4 + 2;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 14 },
    tableWidth: contentWidth,
    head: [["#", "Destinatario", "Mese suggerito", "Motivo"]],
    body: data.forecast.map((f) => [
      String(f.order),
      f.displayName,
      f.suggestedMonthLabel,
      f.reason,
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "top",
      textColor: [28, 43, 42],
      lineColor: [200, 210, 205],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [196, 92, 38],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [252, 246, 240] },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 50 },
      2: { cellWidth: 40 },
      3: { cellWidth: 76 },
    },
  });

  return doc;
}

/** PDF resoconto inviabile */
export function downloadResocontoPdf(data: ResocontoData) {
  const doc = buildResocontoPdfDoc(data);
  doc.save(resocontoFilename(data));
}

export function resocontoPdfBlob(data: ResocontoData): Blob {
  return buildResocontoPdfDoc(data).output("blob");
}

export function resocontoPdfFileName(data: ResocontoData) {
  return resocontoFilename(data);
}
