import { nanoid } from "nanoid";
import { addDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type {
  Assignment,
  Person,
  Program,
  ScheduleRules,
  WeekSlot,
} from "./types";

export function generateWeeks(
  startDate: string,
  weekCount: number
): WeekSlot[] {
  const weeks: WeekSlot[] = [];
  let cursor = parseISO(startDate);
  for (let i = 0; i < weekCount; i++) {
    const start = cursor;
    const end = addDays(start, 6);
    weeks.push({
      id: nanoid(8),
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      label: formatWeekLabel(start, end),
    });
    cursor = addDays(end, 1);
  }
  return weeks;
}

function formatWeekLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${format(start, "d", { locale: it })}-${format(end, "d MMMM", { locale: it })}`;
  }
  return `${format(start, "d MMMM", { locale: it })} - ${format(end, "d MMMM", { locale: it })}`;
}

export interface GenerateOptions {
  weeks: WeekSlot[];
  people: Person[];
  rules: ScheduleRules;
  /** Destinatari da ruotare nelle visite (ordine preferito) */
  visitRecipientIds?: string[];
  /** Destinatari per contatti alternativi */
  contactRecipientIds?: string[];
  /** Programma precedente da cui continuare il ciclo */
  previousProgram?: Program | null;
}

export function generateProgramAssignments(
  options: GenerateOptions
): { visits: Assignment[]; contacts: Assignment[]; warnings: string[] } {
  const warnings: string[] = [];
  const rules = options.rules;

  const giovaniVisitaCasa = options.people.filter(
    (p) => p.role === "giovane" && p.active && p.duties?.visiteCasa
  );
  const giovaniVisitaStruttura = options.people.filter(
    (p) => p.role === "giovane" && p.active && p.duties?.visiteStruttura
  );
  const giovaniContatto = options.people.filter(
    (p) => p.role === "giovane" && p.active && p.duties?.contatti
  );

  const destinatari = options.people.filter(
    (p) => p.role === "destinatario" && p.active
  );

  if (giovaniVisitaCasa.length + giovaniVisitaStruttura.length < 2) {
    warnings.push(
      "Servono almeno 2 giovani abilitati alle visite (casa o struttura)."
    );
  }
  if (!giovaniContatto.length) {
    warnings.push("Nessun giovane abilitato ai contatti alternativi.");
  }

  let visitRecipients = sortDestinatari(
    resolveList(
      options.visitRecipientIds,
      destinatari.filter(
        (d) => d.duties?.visiteCasa || d.duties?.visiteStruttura
      )
    )
  );
  let contactRecipients = sortDestinatari(
    resolveList(
      options.contactRecipientIds,
      destinatari.filter((d) => d.duties?.contatti)
    )
  );

  if (rules.continueRecipientCycle && options.previousProgram) {
    visitRecipients = continueCycle(
      visitRecipients,
      options.previousProgram.visits
    );
    contactRecipients = continueCycle(
      contactRecipients,
      options.previousProgram.contacts
    );
  }

  /** Turni totali (visite + contatti) per giovane */
  const load = new Map<string, number>();
  /** Turni per giovane nel mese (yyyy-MM) — per distribuzione uniforme */
  const monthLoad = new Map<string, number>();
  /** Indice settimana dell'ultimo incarico (visita o contatto) */
  const lastWeekIndex = new Map<string, number>();
  for (const g of options.people.filter((p) => p.role === "giovane")) {
    load.set(g.id, 0);
  }

  // Se c'è un programma precedente, considera l'ultima settimana come "settimana -1"
  // per chi aveva un incarico nell'ultima settimana di quel programma.
  if (rules.skipConsecutiveWeeks && options.previousProgram) {
    seedLastWeekFromPrevious(options.previousProgram, lastWeekIndex);
  }

  const visits: Assignment[] = [];
  const contacts: Assignment[] = [];

  const bumpLoad = (id: string, monthKey: string, wi: number) => {
    load.set(id, (load.get(id) ?? 0) + 1);
    const mk = `${id}|${monthKey}`;
    monthLoad.set(mk, (monthLoad.get(mk) ?? 0) + 1);
    lastWeekIndex.set(id, wi);
  };

  options.weeks.forEach((week, wi) => {
    const busyThisWeek = new Set<string>();
    const monthKey = format(parseISO(week.startDate), "yyyy-MM");
    const loads: LoadMaps = { total: load, month: monthLoad, monthKey };

    const recipient =
      visitRecipients[wi % Math.max(visitRecipients.length, 1)];
    if (!recipient) {
      warnings.push(
        `Settimana ${week.label}: nessun destinatario per la visita.`
      );
    } else {
      const visitType: "Visita a casa" | "Visita in struttura" =
        recipient.hospitalized ? "Visita in struttura" : "Visita a casa";
      const pool =
        visitType === "Visita in struttura"
          ? giovaniVisitaStruttura
          : giovaniVisitaCasa;

      const pairResult = pickPair(pool, recipient, rules, loads, {
        weekIndex: wi,
        busyThisWeek,
        lastWeekIndex,
      });

      if (!pairResult) {
        warnings.push(
          rules.sameGenderPairs
            ? `Settimana ${week.label}: non ci sono abbastanza giovani dello stesso sesso per ${recipient.name} (${visitType}).`
            : `Settimana ${week.label}: impossibile formare una coppia valida per ${recipient.name} (${visitType}).`
        );
      } else {
        if (pairResult.reusedFromPreviousWeek.length) {
          const names = pairResult.reusedFromPreviousWeek
            .map((id) => options.people.find((p) => p.id === id)?.name ?? id)
            .join(", ");
          warnings.push(
            `Settimana ${week.label}: per la visita a ${recipient.name} reinserito/i dalla settimana precedente: ${names} (sempre stesso sesso).`
          );
        }
        pairResult.ids.forEach((id) => {
          bumpLoad(id, monthKey, wi);
          busyThisWeek.add(id);
        });
        visits.push({
          id: nanoid(10),
          weekId: week.id,
          kind: "visita",
          assigneeIds: pairResult.ids,
          recipientId: recipient.id,
          visitType,
        });
      }
    }

    const contactRecipient =
      contactRecipients[wi % Math.max(contactRecipients.length, 1)];
    if (contactRecipient) {
      const soloResult = pickSolo(
        giovaniContatto,
        contactRecipient,
        rules,
        loads,
        {
          weekIndex: wi,
          busyThisWeek,
          lastWeekIndex,
        }
      );
      if (!soloResult) {
        warnings.push(
          `Settimana ${week.label}: nessun giovane disponibile per il contatto (tutti già impegnati in visita).`
        );
      } else {
        if (soloResult.reusedFromPreviousWeek) {
          const name =
            options.people.find((p) => p.id === soloResult.id)?.name ??
            soloResult.id;
          warnings.push(
            `Settimana ${week.label}: contatto a ${contactRecipient.name} — reinserito/a dalla settimana precedente: ${name}.`
          );
        }
        bumpLoad(soloResult.id, monthKey, wi);
        busyThisWeek.add(soloResult.id);
        contacts.push({
          id: nanoid(10),
          weekId: week.id,
          kind: "contatto",
          assigneeIds: [soloResult.id],
          recipientId: contactRecipient.id,
          visitType: "Telefonata/Messaggio/Conversazione in sala",
        });
      }
    }
  });

  return { visits, contacts, warnings };
}

/** Marca come "settimana -1" chi aveva incarico nell'ultima settimana del programma precedente */
function seedLastWeekFromPrevious(
  previous: Program,
  lastWeekIndex: Map<string, number>
) {
  if (!previous.weeks.length) return;
  const lastWeekId = previous.weeks[previous.weeks.length - 1]?.id;
  if (!lastWeekId) return;
  for (const a of [...previous.visits, ...previous.contacts]) {
    if (a.weekId !== lastWeekId) continue;
    for (const id of a.assigneeIds) {
      lastWeekIndex.set(id, -1);
    }
  }
}

/** Ordina destinatari per cycleOrder poi nome */
export function sortDestinatari(list: Person[]): Person[] {
  return [...list].sort((a, b) => {
    const oa = a.cycleOrder ?? 9999;
    const ob = b.cycleOrder ?? 9999;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, "it");
  });
}

/**
 * Continua il ciclo: dal primo non ancora presente nel programma precedente;
 * se tutti sono stati coperti, riparte dal successivo all'ultimo assegnato.
 */
export function continueCycle(
  ordered: Person[],
  previous: Assignment[]
): Person[] {
  if (!ordered.length || !previous.length) return ordered;

  const chronological = [...previous];
  const visitedSet = new Set(chronological.map((a) => a.recipientId));
  const firstMissing = ordered.findIndex((p) => !visitedSet.has(p.id));

  if (firstMissing >= 0) {
    return [...ordered.slice(firstMissing), ...ordered.slice(0, firstMissing)];
  }

  const lastId = chronological[chronological.length - 1]?.recipientId;
  const lastIdx = ordered.findIndex((p) => p.id === lastId);
  const start = lastIdx >= 0 ? (lastIdx + 1) % ordered.length : 0;
  return [...ordered.slice(start), ...ordered.slice(0, start)];
}

function resolveList(
  preferred: string[] | undefined,
  fallback: Person[]
): Person[] {
  if (preferred && preferred.length) {
    const byId = new Map(fallback.map((p) => [p.id, p]));
    return preferred.map((id) => byId.get(id)).filter(Boolean) as Person[];
  }
  return fallback;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface LoadMaps {
  total: Map<string, number>;
  month: Map<string, number>;
  monthKey: string;
}

function personMonthLoad(loads: LoadMaps, id: string): number {
  return loads.month.get(`${id}|${loads.monthKey}`) ?? 0;
}

/**
 * Ordina per: meno turni totali → meno turni nel mese → (opzionale) casuale a parità.
 * Così i turni restano bilanciati su tutto il programma e dentro ogni mese.
 */
function rankPool(
  pool: Person[],
  loads: LoadMaps,
  randomize: boolean,
  balance: boolean
): Person[] {
  let list = [...pool];
  if (randomize) list = shuffle(list);
  if (balance) {
    list.sort((a, b) => {
      const totalDiff =
        (loads.total.get(a.id) ?? 0) - (loads.total.get(b.id) ?? 0);
      if (totalDiff !== 0) return totalDiff;
      const monthDiff = personMonthLoad(loads, a.id) - personMonthLoad(loads, b.id);
      if (monthDiff !== 0) return monthDiff;
      return randomize ? 0 : a.name.localeCompare(b.name, "it");
    });
  }
  return list;
}

/** Solo chi ha il carico minimo (totale, poi mensile) — distribuzione uniforme */
function lowestLoadBand(pool: Person[], loads: LoadMaps, rules: ScheduleRules): Person[] {
  if (!pool.length) return [];
  const ranked = rankPool(pool, loads, rules.randomizeYouth, true);
  if (!rules.balanceWorkload) return ranked;
  const minTotal = loads.total.get(ranked[0].id) ?? 0;
  const atMinTotal = ranked.filter(
    (p) => (loads.total.get(p.id) ?? 0) === minTotal
  );
  const minMonth = Math.min(
    ...atMinTotal.map((p) => personMonthLoad(loads, p.id))
  );
  const band = atMinTotal.filter(
    (p) => personMonthLoad(loads, p.id) === minMonth
  );
  return rules.randomizeYouth ? shuffle(band) : band;
}

interface AvailabilityCtx {
  weekIndex: number;
  busyThisWeek: Set<string>;
  lastWeekIndex: Map<string, number>;
}

function preferredGenders(
  recipient: Person,
  rules: ScheduleRules
): Array<"M" | "F"> {
  if (recipient.isCouple && rules.malePairsForCoupleRecipients) {
    return ["M", "F"];
  }
  return recipient.gender === "F" ? ["F", "M"] : ["M", "F"];
}

function workedPreviousWeek(
  id: string,
  ctx: AvailabilityCtx
): boolean {
  const last = ctx.lastWeekIndex.get(id);
  return last !== undefined && last === ctx.weekIndex - 1;
}

/**
 * Strategia coppie:
 * 1) stesso sesso + pausa di una settimana
 * 2) stesso sesso + reinserisci dalla settimana precedente (mai misti)
 * Non lasciare la settimana vuota se esistono almeno 2 giovani dello stesso sesso liberi.
 */
function pickPair(
  giovani: Person[],
  recipient: Person,
  rules: ScheduleRules,
  loads: LoadMaps,
  ctx: AvailabilityCtx
): { ids: string[]; reusedFromPreviousWeek: string[] } | null {
  const baseEligible = giovani
    .filter((g) => canPairWith(g, recipient, rules))
    .filter((g) => !(rules.noDoubleDutySameWeek && ctx.busyThisWeek.has(g.id)));

  if (!rules.sameGenderPairs) {
    return pickPairAllowMixed(baseEligible, rules, loads, ctx);
  }

  const genders = preferredGenders(recipient, rules);

  // Passata 1: preferisci chi ha saltato la settimana precedente
  for (const gender of genders) {
    const rested = baseEligible.filter(
      (g) =>
        g.gender === gender &&
        !(rules.skipConsecutiveWeeks && workedPreviousWeek(g.id, ctx))
    );
    if (rested.length >= 2) {
      const ids = pickTwo(rested, loads, rules);
      if (ids) return { ids, reusedFromPreviousWeek: [] };
    }
  }

  // Passata 2: completa con qualcuno della settimana precedente (stesso sesso)
  for (const gender of genders) {
    const sameGender = baseEligible.filter((g) => g.gender === gender);
    if (sameGender.length < 2) continue;

    const rested = sameGender.filter(
      (g) => !(rules.skipConsecutiveWeeks && workedPreviousWeek(g.id, ctx))
    );
    const fromPrev = sameGender.filter((g) => workedPreviousWeek(g.id, ctx));

    // Caso tipico: 1 riposato + 1 (o più) della settimana scorsa
    if (rested.length >= 1 && fromPrev.length >= 1) {
      const a = pickOne(rested, loads, rules);
      const bPool = fromPrev.filter((g) => g.id !== a);
      // Tra chi ripescare, preferisci chi ha meno turni
      const b = pickOne(bPool, loads, rules);
      if (a && b) {
        return { ids: [a, b], reusedFromPreviousWeek: [b] };
      }
    }

    // Entrambi dalla settimana scorsa se necessario (non lasciare vuoto)
    if (fromPrev.length >= 2) {
      const ids = pickTwo(fromPrev, loads, rules);
      if (ids) {
        return { ids, reusedFromPreviousWeek: [...ids] };
      }
    }

    // Ultimo ripiego stesso sesso: chiunque libero di quel genere
    const ids = pickTwo(sameGender, loads, rules);
    if (ids) {
      const reused = ids.filter((id) => workedPreviousWeek(id, ctx));
      return { ids, reusedFromPreviousWeek: reused };
    }
  }

  return null;
}

function pickPairAllowMixed(
  baseEligible: Person[],
  rules: ScheduleRules,
  loads: LoadMaps,
  ctx: AvailabilityCtx
): { ids: string[]; reusedFromPreviousWeek: string[] } | null {
  const rested = baseEligible.filter(
    (g) => !(rules.skipConsecutiveWeeks && workedPreviousWeek(g.id, ctx))
  );
  if (rested.length >= 2) {
    const ids = pickTwo(rested, loads, rules);
    if (ids) return { ids, reusedFromPreviousWeek: [] };
  }
  if (baseEligible.length >= 2) {
    const ids = pickTwo(baseEligible, loads, rules);
    if (ids) {
      return {
        ids,
        reusedFromPreviousWeek: ids.filter((id) =>
          workedPreviousWeek(id, ctx)
        ),
      };
    }
  }
  return null;
}

function pickTwo(
  pool: Person[],
  loads: LoadMaps,
  rules: ScheduleRules
): string[] | null {
  if (pool.length < 2) return null;

  // Prendi il primo dal carico più basso, poi il secondo dal carico più basso rimanente
  const firstBand = lowestLoadBand(pool, loads, rules);
  const first = firstBand[0];
  if (!first) return null;

  const remaining = pool.filter((p) => p.id !== first.id);
  const secondBand = lowestLoadBand(remaining, loads, rules);
  const second = secondBand[0];
  if (!second) return null;

  return [first.id, second.id];
}

function pickOne(
  pool: Person[],
  loads: LoadMaps,
  rules: ScheduleRules
): string | null {
  if (!pool.length) return null;
  const band = lowestLoadBand(pool, loads, rules);
  return band[0]?.id ?? null;
}

/**
 * Contatti: preferisci chi ha pausato; se non c'è nessuno, reinserisci
 * dalla settimana precedente. Mai due incarichi nella stessa settimana.
 */
function pickSolo(
  giovani: Person[],
  recipient: Person,
  rules: ScheduleRules,
  loads: LoadMaps,
  ctx: AvailabilityCtx
): { id: string; reusedFromPreviousWeek: boolean } | null {
  const baseEligible = giovani
    .filter((g) => canPairWith(g, recipient, rules))
    .filter((g) => !(rules.noDoubleDutySameWeek && ctx.busyThisWeek.has(g.id)));

  const fallbackPool = baseEligible.length
    ? baseEligible
    : giovani.filter(
        (g) => !(rules.noDoubleDutySameWeek && ctx.busyThisWeek.has(g.id))
      );

  if (!fallbackPool.length) return null;

  const rested = fallbackPool.filter(
    (g) => !(rules.skipConsecutiveWeeks && workedPreviousWeek(g.id, ctx))
  );
  if (rested.length) {
    const id = pickOne(rested, loads, rules);
    if (id) return { id, reusedFromPreviousWeek: false };
  }

  // Reinserisci dalla settimana precedente piuttosto che lasciare vuoto
  const fromPrev = fallbackPool.filter((g) => workedPreviousWeek(g.id, ctx));
  if (fromPrev.length) {
    const id = pickOne(fromPrev, loads, rules);
    if (id) return { id, reusedFromPreviousWeek: true };
  }

  const id = pickOne(fallbackPool, loads, rules);
  if (!id) return null;
  return {
    id,
    reusedFromPreviousWeek: workedPreviousWeek(id, ctx),
  };
}

function canPairWith(
  giovane: Person,
  recipient: Person,
  rules: ScheduleRules
): boolean {
  if (recipient.isCouple) return true;
  if (
    rules.femaleYouthOnlyVisitFemales &&
    giovane.gender === "F" &&
    recipient.gender === "M"
  ) {
    return false;
  }
  if (
    rules.maleYouthOnlyVisitMales &&
    giovane.gender === "M" &&
    recipient.gender === "F" &&
    !recipient.isCouple
  ) {
    return false;
  }
  return true;
}

export function monthGroups(
  weeks: WeekSlot[]
): { label: string; weeks: WeekSlot[] }[] {
  const groups = new Map<string, WeekSlot[]>();
  for (const w of weeks) {
    const mid = addDays(parseISO(w.startDate), 3);
    const key = format(mid, "yyyy-MM");
    const arr = groups.get(key) ?? [];
    arr.push(w);
    groups.set(key, arr);
  }
  return [...groups.entries()].map(([, ws]) => {
    const mid = addDays(parseISO(ws[0].startDate), 3);
    const label = format(mid, "MMMM yyyy", { locale: it });
    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      weeks: ws,
    };
  });
}

/** Anteprima testuale di chi partirà nel ciclo */
export function describeCycleStart(
  ordered: Person[],
  previous: Assignment[] | undefined,
  continueCycleFlag: boolean
): string {
  if (!ordered.length) return "Nessun destinatario";
  const list =
    continueCycleFlag && previous?.length
      ? continueCycle(ordered, previous)
      : ordered;
  return list[0]?.name ?? "—";
}
