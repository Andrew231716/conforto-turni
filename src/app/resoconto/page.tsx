"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useStore } from "@/lib/store";
import {
  buildResoconto,
  resocontoToPlainText,
  type DestinatarioResoconto,
} from "@/lib/resoconto";
import {
  downloadResocontoPdf,
  resocontoPdfBlob,
  resocontoPdfFileName,
} from "@/lib/resocontoPdf";

export default function ResocontoPage() {
  const { ready, data } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const report = useMemo(
    () => buildResoconto(data.programs, data.people),
    [data.programs, data.people]
  );

  if (!ready) return <p>Caricamento…</p>;

  const run = (label: string, fn: () => void) => {
    if (busy) return;
    setBusy(label);
    try {
      fn();
    } catch (err) {
      console.error(err);
      alert(
        `Operazione non riuscita: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      window.requestAnimationFrame(() => setBusy(null));
    }
  };

  const copyText = async () => {
    const text = resocontoToPlainText(report);
    try {
      await navigator.clipboard.writeText(text);
      alert("Resoconto copiato. Incollalo in WhatsApp o email.");
    } catch {
      alert("Impossibile copiare negli appunti.");
    }
  };

  const sharePdf = async () => {
    const blob = resocontoPdfBlob(report);
    const name = resocontoPdfFileName(report);
    const file = new File([blob], name, { type: "application/pdf" });
    try {
      if (
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: "Resoconto destinatari",
          text: `Resoconto destinatari — ${report.windowLabel}`,
          files: [file],
        });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    downloadResocontoPdf(report);
    alert(
      "PDF scaricato. Allega il file a WhatsApp, email o altro per inviarlo."
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Resoconto</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Destinatari negli ultimi 6 mesi: quante volte sono stati visitati o
            contattati, in ordine cronologico, e previsione di chi inserire nei
            prossimi mesi (chi manca da più tempo).
          </p>
          <p className="mt-1 text-sm text-[var(--teal)]">{report.windowLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              run("pdf", () => downloadResocontoPdf(report))
            }
          >
            {busy === "pdf" ? "…" : "Esporta PDF"}
          </button>
          <button
            type="button"
            className="btn-wa"
            onClick={() => {
              void sharePdf();
            }}
          >
            Invia PDF
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              void copyText();
            }}
          >
            Copia testo
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Destinatari" value={report.totals.recipients} />
        <SummaryCard label="Visite (6 mesi)" value={report.totals.visits} />
        <SummaryCard label="Contatti (6 mesi)" value={report.totals.contacts} />
        <SummaryCard
          label="Mai raggiunti"
          value={report.totals.neverVisited}
          tone="warn"
        />
      </section>

      <section className="panel space-y-3">
        <h2 className="font-display text-2xl">Lista destinatari — ultimi 6 mesi</h2>
        <p className="text-sm text-[var(--muted)]">
          Ordinati per numero di incontri. Apri la riga per la cronologia.
        </p>
        {report.destinatari.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nessun destinatario. Aggiungili in{" "}
            <Link href="/persone" className="underline">
              Persone
            </Link>
            .
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Destinatario</th>
                  <th>Visite</th>
                  <th>Contatti</th>
                  <th>Totale</th>
                  <th>Ultimo incontro</th>
                </tr>
              </thead>
              <tbody>
                {report.destinatari.map((d) => (
                  <RecipientRows
                    key={d.id}
                    row={d}
                    open={openId === d.id}
                    onToggle={() =>
                      setOpenId((cur) => (cur === d.id ? null : d.id))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel space-y-3">
        <h2 className="font-display text-2xl">
          Previsione prossimi mesi
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Ordine consigliato per i prossimi inserimenti: prima chi non è stato
          raggiunto da più tempo (o mai negli ultimi 6 mesi).
        </p>
        <ol className="space-y-2">
          {report.forecast.map((f) => (
            <li
              key={f.recipientId}
              className="flex flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--sand)]/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--teal)] text-xs font-semibold text-white">
                  {f.order}
                </span>
                <span className="font-medium">{f.displayName}</span>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {f.reason}
                  {f.lastVisitLabel ? ` · ${f.lastVisitLabel}` : ""}
                </div>
              </div>
              <div className="text-sm font-medium text-[var(--teal)]">
                {f.suggestedMonthLabel}
              </div>
            </li>
          ))}
        </ol>
        {!report.forecast.length && (
          <p className="text-sm text-[var(--muted)]">
            Nessun destinatario attivo per la previsione.
          </p>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  return (
    <div
      className={`panel ${
        tone === "warn" ? "border-[var(--terracotta)]/40" : ""
      }`}
    >
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="font-display mt-1 text-3xl">{value}</div>
    </div>
  );
}

function RecipientRows({
  row,
  open,
  onToggle,
}: {
  row: DestinatarioResoconto;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-[var(--teal-soft)]/40"
        onClick={onToggle}
      >
        <td className="font-medium">
          <button type="button" className="text-left" onClick={onToggle}>
            {open ? "▾ " : "▸ "}
            {row.displayName}
            {!row.active && (
              <span className="ml-2 text-xs text-[var(--muted)]">(inattivo)</span>
            )}
          </button>
        </td>
        <td>{row.visitCount}</td>
        <td>{row.contactCount}</td>
        <td className="font-medium">{row.totalCount}</td>
        <td className="text-sm">
          {row.lastVisitLabel ?? (
            <span className="text-[var(--muted)]">Nessuno</span>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-[var(--sand)]/60">
            {row.chronology.length === 0 ? (
              <p className="px-2 py-2 text-sm text-[var(--muted)]">
                Nessuna visita o contatto negli ultimi 6 mesi.
              </p>
            ) : (
              <ul className="space-y-1 px-2 py-2 text-sm">
                {row.chronology.map((e, i) => (
                  <li key={`${e.date}-${e.kind}-${i}`}>
                    <span className="font-mono text-xs">
                      {format(parseISO(e.date), "d MMM yyyy", { locale: it })}
                    </span>
                    {" · "}
                    <strong className="capitalize">{e.kind}</strong>
                    {" · "}
                    {e.periodLabel}
                    {" · "}
                    {e.assigneeNames}
                    {" · "}
                    <span className="text-[var(--muted)]">{e.visitType}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
