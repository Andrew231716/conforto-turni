import {
  addMonths,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import type { Person, Program } from "./types";
import { recipientDisplayName } from "./calendar";
import { sortDestinatari } from "./schedule";

export interface VisitEvent {
  date: string; // YYYY-MM-DD (inizio periodo)
  endDate: string;
  periodLabel: string;
  programTitle: string;
  programMonthsLabel: string;
  visitType: string;
  assigneeNames: string;
  kind: "visita" | "contatto";
}

export interface DestinatarioResoconto {
  id: string;
  name: string;
  displayName: string;
  active: boolean;
  visitCount: number;
  contactCount: number;
  totalCount: number;
  lastVisitDate: string | null;
  lastVisitLabel: string | null;
  daysSinceLast: number | null;
  chronology: VisitEvent[];
}

export interface ForecastSlot {
  order: number;
  recipientId: string;
  name: string;
  displayName: string;
  reason: string;
  lastVisitLabel: string | null;
  suggestedMonthLabel: string;
}

export interface ResocontoData {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  windowLabel: string;
  destinatari: DestinatarioResoconto[];
  forecast: ForecastSlot[];
  totals: {
    recipients: number;
    visits: number;
    contacts: number;
    neverVisited: number;
  };
}

/** Costruisce il resoconto sugli ultimi `monthsBack` mesi + previsione ciclo */
export function buildResoconto(
  programs: Program[],
  people: Person[],
  opts?: { monthsBack?: number; forecastCount?: number; asOf?: Date }
): ResocontoData {
  const monthsBack = opts?.monthsBack ?? 6;
  const forecastCount = opts?.forecastCount ?? 12;
  const asOf = opts?.asOf ?? new Date();
  const windowEnd = asOf;
  const windowStart = startOfMonth(subMonths(asOf, monthsBack - 1));
  const windowStartStr = format(windowStart, "yyyy-MM-dd");
  const windowEndStr = format(windowEnd, "yyyy-MM-dd");

  const byId = new Map(people.map((p) => [p.id, p]));
  const destinatari = sortDestinatari(
    people.filter((p) => p.role === "destinatario")
  );

  const eventsByRecipient = new Map<string, VisitEvent[]>();

  for (const program of programs) {
    const weekById = new Map(program.weeks.map((w) => [w.id, w]));
    const push = (list: Program["visits"], kind: "visita" | "contatto") => {
      for (const a of list) {
        const week = weekById.get(a.weekId);
        if (!week) continue;
        // Incluso se il periodo interseca la finestra
        if (week.endDate < windowStartStr || week.startDate > windowEndStr) {
          continue;
        }
        const assignees = a.assigneeIds
          .map((id) => byId.get(id)?.name)
          .filter(Boolean)
          .join(", ");
        const event: VisitEvent = {
          date: week.startDate,
          endDate: week.endDate,
          periodLabel: week.label,
          programTitle: program.title,
          programMonthsLabel: program.monthsLabel,
          visitType: a.visitType,
          assigneeNames: assignees || "—",
          kind,
        };
        const arr = eventsByRecipient.get(a.recipientId) ?? [];
        arr.push(event);
        eventsByRecipient.set(a.recipientId, arr);
      }
    };
    push(program.visits, "visita");
    push(program.contacts, "contatto");
  }

  const rows: DestinatarioResoconto[] = destinatari.map((d) => {
    const chronology = [...(eventsByRecipient.get(d.id) ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const visits = chronology.filter((e) => e.kind === "visita");
    const contacts = chronology.filter((e) => e.kind === "contatto");
    const last = chronology.length
      ? chronology[chronology.length - 1]
      : null;
    const daysSinceLast = last
      ? Math.max(
          0,
          Math.floor(
            (asOf.getTime() - parseISO(last.endDate).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : null;

    return {
      id: d.id,
      name: d.name,
      displayName: recipientDisplayName(d),
      active: d.active,
      visitCount: visits.length,
      contactCount: contacts.length,
      totalCount: chronology.length,
      lastVisitDate: last?.date ?? null,
      lastVisitLabel: last
        ? `${last.periodLabel} (${last.kind})`
        : null,
      daysSinceLast,
      chronology,
    };
  });

  // Ordine elenco: più visitati in alto, poi nome
  const listed = [...rows].sort(
    (a, b) =>
      b.totalCount - a.totalCount ||
      a.name.localeCompare(b.name, "it")
  );

  // Previsione: chi non è stato fatto da più tempo (mai visitati prima)
  const forecastPool = rows
    .filter((r) => r.active)
    .sort((a, b) => {
      if (a.lastVisitDate === null && b.lastVisitDate === null) {
        return a.name.localeCompare(b.name, "it");
      }
      if (a.lastVisitDate === null) return -1;
      if (b.lastVisitDate === null) return 1;
      if (a.lastVisitDate !== b.lastVisitDate) {
        return a.lastVisitDate.localeCompare(b.lastVisitDate);
      }
      return a.name.localeCompare(b.name, "it");
    });

  const forecast: ForecastSlot[] = [];
  const horizon = Math.max(forecastCount, forecastPool.length);
  for (let i = 0; i < horizon && i < forecastPool.length; i++) {
    const r = forecastPool[i];
    const monthOffset = Math.floor(i / 2); // ~2 destinatari/mese (visita+contatto tipici)
    const month = addMonths(startOfMonth(asOf), monthOffset + 1);
    const suggestedMonthLabel = format(month, "MMMM yyyy", { locale: it });
    const reason =
      r.lastVisitDate === null
        ? "Mai visitato/a o contattato/a negli ultimi 6 mesi"
        : `Ultimo incontro ${r.daysSinceLast} giorni fa`;
    forecast.push({
      order: i + 1,
      recipientId: r.id,
      name: r.name,
      displayName: r.displayName,
      reason,
      lastVisitLabel: r.lastVisitLabel,
      suggestedMonthLabel:
        suggestedMonthLabel.charAt(0).toUpperCase() +
        suggestedMonthLabel.slice(1),
    });
  }

  const windowLabel = `${format(windowStart, "MMMM yyyy", { locale: it })} – ${format(windowEnd, "MMMM yyyy", { locale: it })}`;

  return {
    generatedAt: asOf.toISOString(),
    windowStart: windowStartStr,
    windowEnd: windowEndStr,
    windowLabel:
      windowLabel.charAt(0).toUpperCase() + windowLabel.slice(1),
    destinatari: listed,
    forecast,
    totals: {
      recipients: listed.length,
      visits: listed.reduce((s, r) => s + r.visitCount, 0),
      contacts: listed.reduce((s, r) => s + r.contactCount, 0),
      neverVisited: listed.filter((r) => r.totalCount === 0).length,
    },
  };
}

export function resocontoToPlainText(data: ResocontoData): string {
  const lines: string[] = [
    "Resoconto destinatari",
    `Periodo: ${data.windowLabel}`,
    `Generato: ${format(parseISO(data.generatedAt), "d MMMM yyyy HH:mm", { locale: it })}`,
    "",
    `Destinatari: ${data.totals.recipients} · Visite: ${data.totals.visits} · Contatti: ${data.totals.contacts} · Mai raggiunti: ${data.totals.neverVisited}`,
    "",
    "— Ultimi 6 mesi —",
  ];

  for (const d of data.destinatari) {
    lines.push(
      `• ${d.displayName}: ${d.visitCount} visite, ${d.contactCount} contatti` +
        (d.lastVisitLabel ? ` · ultimo: ${d.lastVisitLabel}` : " · nessun incontro")
    );
    for (const e of d.chronology) {
      lines.push(
        `    ${e.date} · ${e.kind} · ${e.periodLabel} · ${e.assigneeNames} · ${e.visitType}`
      );
    }
  }

  lines.push("", "— Previsione prossimi mesi (chi manca da più tempo) —");
  for (const f of data.forecast) {
    lines.push(
      `${f.order}. ${f.displayName} → ${f.suggestedMonthLabel} (${f.reason})`
    );
  }

  return lines.join("\n");
}
