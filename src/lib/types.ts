export type Gender = "M" | "F";
export type PersonRole = "giovane" | "destinatario";
export type VisitKind = "Visita a casa" | "Visita in struttura";
export type ContactKind = "Telefonata/Messaggio/Conversazione in sala";

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

export const DEFAULT_RULES: ScheduleRules = {
  femaleYouthOnlyVisitFemales: true,
  maleYouthOnlyVisitMales: false,
  sameGenderPairs: true,
  malePairsForCoupleRecipients: true,
  visitPairSize: 2,
  balanceWorkload: true,
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
