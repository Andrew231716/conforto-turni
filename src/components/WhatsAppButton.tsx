"use client";

import type { Person } from "@/lib/types";
import { openWhatsAppForPerson } from "@/lib/whatsapp";

export function WhatsAppButton({
  person,
  message,
  countryCode = "39",
  label = "WhatsApp",
  className = "btn-wa",
}: {
  person: Person;
  message: string;
  countryCode?: string;
  label?: string;
  className?: string;
}) {
  const hasPhone = !!person.phone?.trim();

  return (
    <button
      type="button"
      className={className}
      disabled={!hasPhone}
      title={hasPhone ? `Scrivi a ${person.name}` : "Manca il numero"}
      onClick={() => {
        const res = openWhatsAppForPerson(person, message, countryCode);
        if (!res.ok) {
          alert(res.reason);
          return;
        }
        window.open(res.url, "_blank", "noopener,noreferrer");
      }}
    >
      {label}
    </button>
  );
}
