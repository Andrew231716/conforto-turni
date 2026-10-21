"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { PdfPreviewModal } from "@/components/PdfPreview";
import { parseISO, isWithinInterval, addDays } from "date-fns";

export default function HomePage() {
  const { ready, data, activeProgram } = useStore();
  const [pdfPreview, setPdfPreview] = useState(false);

  const thisWeek = useMemo(() => {
    if (!activeProgram) return null;
    const today = new Date();
    return (
      activeProgram.weeks.find((w) => {
        const start = parseISO(w.startDate);
        const end = addDays(parseISO(w.endDate), 1);
        return isWithinInterval(today, { start, end });
      }) ?? null
    );
  }, [activeProgram]);

  if (!ready) {
    return <p className="text-[var(--muted)]">Caricamento…</p>;
  }

  const giovani = data.people.filter((p) => p.role === "giovane");
  const destinatari = data.people.filter((p) => p.role === "destinatario");
  const withPhone = data.people.filter((p) => p.phone?.trim()).length;

  const weekVisits =
    thisWeek && activeProgram
      ? activeProgram.visits.filter((v) => v.weekId === thisWeek.id)
      : [];
  const weekContacts =
    thisWeek && activeProgram
      ? activeProgram.contacts.filter((v) => v.weekId === thisWeek.id)
      : [];

  return (
    <div className="space-y-8">
      <section className="panel relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, #c45c2633 0%, transparent 70%)",
          }}
        />
        <p className="text-sm uppercase tracking-wider text-[var(--muted)]">
          Programma attivo
        </p>
        <h1 className="font-display mt-1 text-3xl text-[var(--ink)] sm:text-4xl">
          {activeProgram?.title ?? "Nessun programma"}
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          {activeProgram?.monthsLabel ??
            "Crea o seleziona un programma per monitorare i turni."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/programma" className="btn-primary">
            Apri programma
          </Link>
          <Link href="/genera" className="btn-ghost">
            Genera nuovo
          </Link>
          {activeProgram && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPdfPreview(true)}
            >
              Anteprima / PDF
            </button>
          )}
        </div>
      </section>

      {pdfPreview && activeProgram && (
        <PdfPreviewModal
          program={activeProgram}
          people={data.people}
          settings={data.settings}
          onClose={() => setPdfPreview(false)}
        />
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Giovani" value={String(giovani.length)} href="/persone" />
        <Stat
          label="Destinatari"
          value={String(destinatari.length)}
          href="/persone"
        />
        <Stat
          label="Con telefono"
          value={String(withPhone)}
          href="/whatsapp"
        />
      </section>

      <section className="panel">
        <h2 className="font-display text-xl">Questa settimana</h2>
        {!thisWeek ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Nessuna settimana del programma coincide con oggi. Vai al{" "}
            <Link href="/programma" className="underline">
              programma
            </Link>{" "}
            per vedere tutti i turni.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium">{thisWeek.label}</p>
            {weekVisits.map((v) => {
              const dest = data.people.find((p) => p.id === v.recipientId);
              const names = v.assigneeIds
                .map((id) => data.people.find((p) => p.id === id)?.name)
                .join(", ");
              return (
                <div
                  key={v.id}
                  className="rounded-lg border border-[var(--line)] bg-[var(--teal-soft)]/40 px-3 py-2 text-sm"
                >
                  <strong>Visita:</strong> {names} → {dest?.name} ({v.visitType})
                </div>
              );
            })}
            {weekContacts.map((v) => {
              const dest = data.people.find((p) => p.id === v.recipientId);
              const names = v.assigneeIds
                .map((id) => data.people.find((p) => p.id === id)?.name)
                .join(", ");
              return (
                <div
                  key={v.id}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                >
                  <strong>Contatto:</strong> {names} → {dest?.name}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link href={href} className="panel block transition hover:border-[var(--teal)]">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="font-display mt-1 text-3xl">{value}</div>
    </Link>
  );
}
