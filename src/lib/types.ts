export type Gender = "M" | "F";
export type PersonRole = "giovane" | "destinatario";
export type VisitKind = "Visita a casa" | "Visita in struttura";
export type ContactKind = "Telefonata/Messaggio/Conversazione in sala";

export interface PersonDuties {
  /** Può essere incaricato di visite a casa */
  visiteCasa: boolean;
  /** Può essere incaricato di visite in struttura */
  visiteStruttura: boolean;
  /** Può fare contatti alternativi */
  contatti: boolean;
}

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  role: PersonRole;
  /** Numero internazionale o nazionale IT, es. 3331234567 o +393331234567 */
  phone?: string;
  notes?: string;
  hospitalized?: boolean;
  /** Es. Coniugi Calabrese */
  isCouple?: boolean;
  active: boolean;
  /**
   * Per i giovani: quali tipi di incarico può svolgere.
   * Per i destinatari: se riceve visite casa/struttura e/o contatti.
   */
  duties: PersonDuties;
  /** Ordine nel ciclo destinatari (più basso = prima). Solo destinatari. */
  cycleOrder?: number;
}

export interface ScheduleRules {
  /** Le giovani femmine visitano solo destinatari femmine */
  femaleYouthOnlyVisitFemales: boolean;
  /** I giovani maschi visitano solo destinatari maschi (o coppie) */
  maleYouthOnlyVisitMales: boolean;
  /** Le coppie di incaricati sono stesso sesso (M-M / F-F) */
  sameGenderPairs: boolean;
  /** Preferisci due maschi per destinatari-coppia */
  malePairsForCoupleRecipients: boolean;
  visitPairSize: 2;
  balanceWorkload: boolean;
  /** Combina i giovani in modo casuale (rispettando le regole) */
  randomizeYouth: boolean;
  /** Continua il ciclo destinatari dal primo non ancora visitato/sentito */
  continueRecipientCycle: boolean;
}

export interface WeekSlot {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  label: string;
}

export interface Assignment {
  id: string;
  weekId: string;
  kind: "visita" | "contatto";
  assigneeIds: string[];
  recipientId: string;
  visitType: VisitKind | ContactKind;
  notes?: string;
}

export interface WhatsAppTemplates {
  visita: string;
  contatto: string;
  reminder: string;
}

export interface Program {
  id: string;
  title: string;
  monthsLabel: string;
  weeks: WeekSlot[];
  visits: Assignment[];
  contacts: Assignment[];
  rules: ScheduleRules;
  whatsappTemplates: WhatsAppTemplates;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  timezone: string;
  /** Usa la pagina interna /calendario oppure i Smart Link CalendarLink */
  calendarMode: "own" | "calendarlink";
  calendarlinkCollectionId: string;
  defaultCountryCode: string;
}

export interface AppData {
  version: 1;
  people: Person[];
  programs: Program[];
  activeProgramId: string | null;
  settings: AppSettings;
}

export const DEFAULT_DUTIES_GIOVANE: PersonDuties = {
  visiteCasa: true,
  visiteStruttura: true,
  contatti: true,
};

export const DEFAULT_DUTIES_DESTINATARIO: PersonDuties = {
  visiteCasa: true,
  visiteStruttura: true,
  contatti: true,
};

export const DEFAULT_RULES: ScheduleRules = {
  femaleYouthOnlyVisitFemales: true,
  maleYouthOnlyVisitMales: false,
  sameGenderPairs: true,
  malePairsForCoupleRecipients: true,
  visitPairSize: 2,
  balanceWorkload: true,
  randomizeYouth: true,
  continueRecipientCycle: true,
};

export const DEFAULT_WHATSAPP: WhatsAppTemplates = {
  visita:
    "Ciao {{nome}}! 👋\nQuesta settimana ({{settimana}}) sei incaricato/a della visita a *{{destinatario}}* insieme a {{compagno}}.\nTipo: {{tipo}}.\nAggiungi al calendario: {{link_calendario}}",
  contatto:
    "Ciao {{nome}}! 👋\nQuesta settimana ({{settimana}}) sei incaricato/a del contatto con *{{destinatario}}*.\nModalità: {{tipo}}.\nAggiungi al calendario: {{link_calendario}}",
  reminder:
    "Promemoria: entro fine settimana ({{settimana}}) ricorda di completare {{tipo}} per *{{destinatario}}*. Grazie!",
};

export const DEFAULT_SETTINGS: AppSettings = {
  timezone: "Europe/Rome",
  calendarMode: "own",
  calendarlinkCollectionId: "3b8e59b7-0bcf-4e38-a8cc-a42d5a555cc4",
  defaultCountryCode: "39",
};

/** Normalizza persone importate/vecchie senza duties */
export function normalizePerson(p: Person): Person {
  const defaults =
    p.role === "giovane" ? DEFAULT_DUTIES_GIOVANE : DEFAULT_DUTIES_DESTINATARIO;
  return {
    ...p,
    duties: {
      visiteCasa: p.duties?.visiteCasa ?? defaults.visiteCasa,
      visiteStruttura: p.duties?.visiteStruttura ?? defaults.visiteStruttura,
      contatti: p.duties?.contatti ?? defaults.contatti,
    },
  };
}

export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    people: data.people.map(normalizePerson),
    programs: data.programs.map((prog) => ({
      ...prog,
      rules: {
        ...DEFAULT_RULES,
        ...prog.rules,
      },
    })),
  };
}
