import type { Assignment, AppSettings, Person, WeekSlot } from "./types";

const WEEK_MINUTES = 7 * 24 * 60; // 10080

export function recipientDisplayName(
  recipient: Person | undefined
): string {
  if (!recipient) return "Destinatario";
  if (recipient.hospitalized) {
    const suffix = recipient.gender === "F" ? "ricoverata" : "ricoverato";
    return `${recipient.name} (${suffix})`;
  }
  return recipient.name;
}

export function buildEventPayload(
  assignment: Assignment,
  week: WeekSlot,
  people: Person[]
): {
  title: string;
  start: string;
  duration: number;
  description: string;
  timezone: string;
} {
  const recipient = people.find((p) => p.id === assignment.recipientId);
  const assignees = assignment.assigneeIds
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];
  const dest = recipientDisplayName(recipient);
  const isVisit = assignment.kind === "visita";

  const title = isVisit
    ? `Settimana visita: ${dest}`
    : `Settimana contatto: ${dest}`;

  const description = isVisit
    ? `Settimana: ${week.label}. Incaricati: ${assignees.join(", ")}. Tipo: ${assignment.visitType}. Evento settimanale per ricordare di organizzare e svolgere la visita durante i giorni indicati.`
    : `Settimana: ${week.label}. Giovane incaricato/a: ${assignees.join(", ")}. Modalita: ${assignment.visitType}. Evento settimanale per ricordare di contattare la persona durante i giorni indicati.`;

  return {
    title,
    start: `${week.startDate} 00:00`,
    duration: WEEK_MINUTES,
    description,
    timezone: "Europe/Rome",
  };
}

export function buildOwnCalendarPath(
  payload: ReturnType<typeof buildEventPayload>
): string {
  const q = new URLSearchParams({
    title: payload.title,
    start: payload.start,
    duration: String(payload.duration),
    timezone: payload.timezone,
    description: payload.description,
  });
  return `/calendario?${q.toString()}`;
}

export function buildCalendarLinkUrl(
  payload: ReturnType<typeof buildEventPayload>,
  settings: AppSettings,
  origin?: string
): string {
  if (settings.calendarMode === "calendarlink") {
    const q = new URLSearchParams({
      collection: settings.calendarlinkCollectionId,
      title: payload.title,
      start: payload.start,
      duration: String(payload.duration),
      timezone: payload.timezone,
      description: payload.description,
    });
    return `https://my.calendarlink.com/link?${q.toString()}`;
  }
  const path = buildOwnCalendarPath(payload);
  return origin ? `${origin}${path}` : path;
}

/** Link diretti stile CalendarLink / Google / Outlook / iCal */
export function buildDirectCalendarTargets(payload: {
  title: string;
  start: string;
  duration: number;
  description: string;
  timezone: string;
}): { id: string; label: string; href: string }[] {
  const start = parseLocalStart(payload.start);
  const end = new Date(start.getTime() + payload.duration * 60_000);
  const googleDates = `${formatGoogleDate(start)}/${formatGoogleDate(end)}`;
  const ics = buildIcsBlobUrl(payload.title, payload.description, start, end);

  const outlookStart = formatOutlookDate(start);
  const outlookEnd = formatOutlookDate(end);

  return [
    {
      id: "google",
      label: "Google (online)",
      href: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(payload.title)}&dates=${googleDates}&details=${enc(payload.description)}&ctz=${enc(payload.timezone)}`,
    },
    {
      id: "apple",
      label: "Apple",
      href: ics,
    },
    {
      id: "office365",
      label: "Office 365 (online)",
      href: `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${enc(payload.title)}&body=${enc(payload.description)}&startdt=${outlookStart}&enddt=${outlookEnd}`,
    },
    {
      id: "outlook",
      label: "Outlook (online)",
      href: `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${enc(payload.title)}&body=${enc(payload.description)}&startdt=${outlookStart}&enddt=${outlookEnd}`,
    },
    {
      id: "outlook_offline",
      label: "Outlook",
      href: ics,
    },
    {
      id: "ical",
      label: "iCal",
      href: ics,
    },
    {
      id: "teams",
      label: "MS Teams (online)",
      href: `https://teams.microsoft.com/l/meeting/new?subject=${enc(payload.title)}&content=${enc(payload.description)}&startTime=${outlookStart}&endTime=${outlookEnd}`,
    },
    {
      id: "yahoo",
      label: "Yahoo (online)",
      href: `https://calendar.yahoo.com/?v=60&title=${enc(payload.title)}&st=${formatYahooDate(start)}&dur=${pad(Math.floor(payload.duration / 60), 2)}${pad(payload.duration % 60, 2)}&desc=${enc(payload.description)}`,
    },
  ];
}

function enc(s: string) {
  return encodeURIComponent(s);
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

function parseLocalStart(start: string): Date {
  // "YYYY-MM-DD HH:mm"
  const [d, t = "00:00"] = start.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, day, hh, mm, 0));
}

function formatGoogleDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatOutlookDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

function formatYahooDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
}

function buildIcsBlobUrl(
  title: string,
  description: string,
  start: Date,
  end: Date
): string {
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Conforto Turni//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `UID:${stamp(start)}-${Math.random().toString(36).slice(2)}@conforto-turni`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  if (typeof window === "undefined") {
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
