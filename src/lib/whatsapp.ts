import type { Assignment, Person, WeekSlot, WhatsAppTemplates } from "./types";
import { recipientDisplayName } from "./calendar";

/** Normalizza un numero italiano/internazionale per wa.me */
export function normalizePhone(
  phone: string | undefined,
  defaultCountryCode = "39"
): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (!digits) return null;
  // Se inizia già con prefisso paese (39…) lascialo
  if (digits.startsWith(defaultCountryCode) && digits.length > 10) {
    return digits;
  }
  // Numeri IT tipici 3xx…
  if (digits.length === 9 || digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }
  return digits;
}

export function whatsappUrl(phoneDigits: string, text: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}

export function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function buildAssignmentMessage(
  templateKey: keyof WhatsAppTemplates,
  templates: WhatsAppTemplates,
  assignment: Assignment,
  week: WeekSlot,
  people: Person[],
  calendarLink: string,
  forPersonId?: string
): string {
  const recipient = people.find((p) => p.id === assignment.recipientId);
  const assignees = assignment.assigneeIds
    .map((id) => people.find((p) => p.id === id))
    .filter(Boolean) as Person[];
  const target =
    (forPersonId && assignees.find((a) => a.id === forPersonId)) ||
    assignees[0];
  const companions = assignees
    .filter((a) => a.id !== target?.id)
    .map((a) => a.name)
    .join(", ");

  return fillTemplate(templates[templateKey], {
    nome: target?.name ?? "",
    destinatario: recipientDisplayName(recipient),
    settimana: week.label,
    tipo: assignment.visitType,
    compagno: companions || "—",
    link_calendario: calendarLink,
  });
}

export function openWhatsAppForPerson(
  person: Person,
  message: string,
  defaultCountryCode = "39"
): { ok: true; url: string } | { ok: false; reason: string } {
  const digits = normalizePhone(person.phone, defaultCountryCode);
  if (!digits) {
    return {
      ok: false,
      reason: `${person.name} non ha un numero di telefono salvato.`,
    };
  }
  return { ok: true, url: whatsappUrl(digits, message) };
}
