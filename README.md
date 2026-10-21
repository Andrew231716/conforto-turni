# Conforto Turni

App web per gestire il **programma di visite e incoraggiamento**: elenco persone (con telefoni), generazione automatica dei turni con regole di abbinamento, modifica manuale, link “Aggiungi al calendario”, messaggi WhatsApp preimpostati ed export PDF.

## Funzioni

- **Persone**: giovani e destinatari, genere, ricovero/coppia, numeri WhatsApp
- **Programma**: visualizza e modifica visite e contatti alternativi (seed Set–Ott–Nov 2026 dal PDF)
- **Genera**: nuovo trimestre con regole (es. ragazze solo da femmine, coppie stesso sesso)
- **Calendario**: pagina universale stile CalendarLink (Google, Apple, Outlook, iCal…) oppure Smart Link CalendarLink
- **WhatsApp**: modelli con segnaposto e invio rapido `wa.me`
- **PDF**: download del programma con link calendario cliccabili
- **Backup**: export/import JSON (dati in `localStorage` del browser)

## Sviluppo locale

```bash
cd conforto-turni
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Deploy su Vercel

1. Crea un repository GitHub e carica questa cartella
2. Su [vercel.com](https://vercel.com) → **Add New Project** → importa il repo
3. Framework: Next.js (rilevato in automatico) → **Deploy**
4. Dopo il deploy, apri **Impostazioni** nell’app ed esporta/importa il JSON se cambi dispositivo

Variabile opzionale: nessuna obbligatoria (tutto client-side).

## Segnaposto WhatsApp

`{{nome}}` `{{destinatario}}` `{{settimana}}` `{{tipo}}` `{{compagno}}` `{{link_calendario}}`
