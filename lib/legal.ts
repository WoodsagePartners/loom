// Plain-language legal pages. Each text is [English, German]. Keep it short and honest.
export type LText = [string, string];
export type LSection = { h: LText; p: LText[]; bullets?: LText[] };
export type LDoc = { title: LText; updated: string; intro: LText; sections: LSection[] };

const CONTACT = "ron@struinova.com";

export const PRIVACY: LDoc = {
  title: ["Privacy notice", "Datenschutzhinweis"],
  updated: "October 2026",
  intro: [
    "Loom is a tool from Woodsage Partners, Inc., d/b/a Struinova Innovation for mapping how work gets done. This page says, in plain words, what we collect, why, and what you can ask us to do.",
    "Loom ist ein Werkzeug von Woodsage Partners, Inc., d/b/a Struinova Innovation, um abzubilden, wie Arbeit abläuft. Diese Seite sagt in einfachen Worten, was wir erfassen, warum, und was Sie von uns verlangen können.",
  ],
  sections: [
    {
      h: ["Who we are", "Wer wir sind"],
      p: [
        [`Loom is provided by Woodsage Partners, Inc., d/b/a Struinova Innovation, Indianapolis, Indiana, USA. In this notice, “Struinova”, “we” and “us” mean Woodsage Partners, Inc. Contact: ${CONTACT}.`, `Loom wird von Woodsage Partners, Inc., d/b/a Struinova Innovation, Indianapolis, Indiana, USA, bereitgestellt. In diesem Hinweis bedeuten „Struinova“, „wir“ und „uns“ Woodsage Partners, Inc. Kontakt: ${CONTACT}.`],
      ],
    },
    {
      h: ["What we collect", "Was wir erfassen"],
      p: [["", ""]],
      bullets: [
        ["Your account: email address and password (we never see or store the password itself, only a protected form of it). Optionally your name, job title, phone number and profile photo.", "Ihr Konto: E-Mail-Adresse und Passwort (wir sehen oder speichern das Passwort selbst nie, nur eine geschützte Form davon). Optional Ihren Namen, Ihre Funktion, Telefonnummer und Ihr Profilfoto."],
        ["What you enter: processes, lanes, roles, steps, lines, plans, phases and the notes and descriptions you write.", "Was Sie eingeben: Prozesse, Bahnen, Rollen, Schritte, Linien, Pläne, Phasen sowie Ihre Notizen und Beschreibungen."],
        ["Basic technical data needed to keep you signed in and show who is online in your workspace.", "Technische Grunddaten, die nötig sind, um Sie angemeldet zu halten und anzuzeigen, wer in Ihrem Arbeitsbereich online ist."],
      ],
    },
    {
      h: ["Why we use it", "Wofür wir es verwenden"],
      p: [
        ["To run Loom for you and your team: sign you in, save your work, show it to the people you invite, translate it between English and German when you ask, and send sign-in, password-reset and invitation emails. We do not sell your data and we do not use it for advertising.", "Um Loom für Sie und Ihr Team zu betreiben: Sie anzumelden, Ihre Arbeit zu speichern, sie den von Ihnen eingeladenen Personen zu zeigen, sie auf Wunsch zwischen Englisch und Deutsch zu übersetzen und Anmelde-, Passwort-Zurücksetzen- und Einladungs-E-Mails zu senden. Wir verkaufen Ihre Daten nicht und nutzen sie nicht für Werbung."],
      ],
    },
    {
      h: ["Who helps us run Loom", "Wer uns beim Betrieb hilft"],
      p: [
        ["We use a few service providers. They handle data only to provide their service to us: Supabase (database, sign-in, photo storage), Vercel (hosting), Anthropic (translation of the text you ask to translate) and Resend (email). Our database currently runs in the United States. More detail is in our Processor note.", "Wir nutzen einige Dienstleister. Sie verarbeiten Daten nur, um uns ihren Dienst zu erbringen: Supabase (Datenbank, Anmeldung, Foto-Speicherung), Vercel (Hosting), Anthropic (Übersetzung des Textes, den Sie übersetzen lassen) und Resend (E-Mail). Unsere Datenbank läuft derzeit in den USA. Mehr Details stehen in unserer Auftragsverarbeitungs-Notiz."],
      ],
    },
    {
      h: ["Cookies", "Cookies"],
      p: [
        ["Only the ones Loom needs to work: they keep you signed in and remember your language, theme and last workspace. No advertising or tracking cookies.", "Nur die, die Loom zum Funktionieren braucht: Sie halten Sie angemeldet und merken sich Sprache, Darstellung und zuletzt genutzten Arbeitsbereich. Keine Werbe- oder Tracking-Cookies."],
      ],
    },
    {
      h: ["How long we keep it", "Wie lange wir es aufbewahren"],
      p: [
        ["Until you delete it. A workspace owner can delete a whole workspace in the app; that removes everything in it and cannot be undone. You can also ask us to delete your data, and we will do so within 30 days.", "Bis Sie es löschen. Ein Eigentümer eines Arbeitsbereichs kann den gesamten Arbeitsbereich in der App löschen; das entfernt alles darin und kann nicht rückgängig gemacht werden. Sie können uns auch bitten, Ihre Daten zu löschen; wir tun dies innerhalb von 30 Tagen."],
      ],
    },
    {
      h: ["Your rights", "Ihre Rechte"],
      p: [
        [`You can ask us to show you, correct, export or delete your data, or ask any question about this notice. Write to ${CONTACT}.`, `Sie können verlangen, dass wir Ihnen Ihre Daten zeigen, sie berichtigen, exportieren oder löschen, oder Fragen zu diesem Hinweis stellen. Schreiben Sie an ${CONTACT}.`],
      ],
    },
  ],
};

export const TERMS: LDoc = {
  title: ["Terms of use", "Nutzungsbedingungen"],
  updated: "October 2026",
  intro: [
    "These are the simple ground rules for using Loom, provided by Woodsage Partners, Inc., d/b/a Struinova Innovation. By signing in you agree to them.",
    "Dies sind die einfachen Grundregeln für die Nutzung von Loom, bereitgestellt von Woodsage Partners, Inc., d/b/a Struinova Innovation. Mit der Anmeldung stimmen Sie ihnen zu.",
  ],
  sections: [
    {
      h: ["Who provides Loom", "Wer Loom bereitstellt"],
      p: [
        [`Loom is provided by Woodsage Partners, Inc., d/b/a Struinova Innovation, Indianapolis, Indiana, USA (“Struinova”). Questions about these terms: ${CONTACT}.`, `Loom wird von Woodsage Partners, Inc., d/b/a Struinova Innovation, Indianapolis, Indiana, USA („Struinova“), bereitgestellt. Fragen zu diesen Bedingungen: ${CONTACT}.`],
      ],
    },
    {
      h: ["Your content is yours", "Ihre Inhalte gehören Ihnen"],
      p: [
        ["What you put into Loom stays yours. You allow us to store and display it so the tool can work for you and the people you invite, and to send text to our translation provider when you ask for a translation.", "Was Sie in Loom eingeben, bleibt Ihres. Sie erlauben uns, es zu speichern und anzuzeigen, damit das Werkzeug für Sie und die von Ihnen eingeladenen Personen funktioniert, und Text an unseren Übersetzungsdienstleister zu senden, wenn Sie eine Übersetzung wünschen."],
      ],
    },
    {
      h: ["Please use it sensibly", "Bitte nutzen Sie es vernünftig"],
      p: [["Please don't:", "Bitte nicht:"]],
      bullets: [
        ["enter payment card details, government ID numbers or other highly sensitive personal data;", "Zahlungskartendaten, Ausweisnummern oder andere hochsensible personenbezogene Daten eingeben;"],
        ["use Loom to break the law, harm others, or try to get into other people's workspaces;", "Loom nutzen, um Gesetze zu brechen, andere zu schädigen oder in fremde Arbeitsbereiche zu gelangen;"],
        ["overload or attack the service.", "den Dienst überlasten oder angreifen."],
      ],
    },
    {
      h: ["Your account and workspace", "Ihr Konto und Ihr Arbeitsbereich"],
      p: [
        ["Keep your password private. Workspace owners decide who is in a workspace and can delete it. You are responsible for what happens under your account.", "Halten Sie Ihr Passwort geheim. Eigentümer eines Arbeitsbereichs entscheiden, wer dazugehört, und können ihn löschen. Sie sind verantwortlich für das, was unter Ihrem Konto geschieht."],
      ],
    },
    {
      h: ["No guarantees", "Keine Garantien"],
      p: [
        ["Loom is provided as it is, and it is still growing. We work hard to keep it running and your work safe, but we can't promise it will always be available or error-free, so please keep your own copies of anything critical (the image export helps). To the extent the law allows, we are not liable for indirect losses or lost profit.", "Loom wird so bereitgestellt, wie es ist, und wächst noch. Wir bemühen uns sehr, es am Laufen zu halten und Ihre Arbeit zu sichern, können aber nicht versprechen, dass es immer verfügbar oder fehlerfrei ist. Bitte bewahren Sie von Wichtigem eigene Kopien auf (der Bildexport hilft dabei). Soweit gesetzlich zulässig, haften wir nicht für mittelbare Schäden oder entgangenen Gewinn."],
      ],
    },
    {
      h: ["Changes and ending", "Änderungen und Beendigung"],
      p: [
        ["We may improve or change Loom, and we may update these terms; we'll show the date at the top. You can stop using Loom and delete your workspace at any time. We may suspend accounts that break these rules.", "Wir dürfen Loom verbessern oder ändern und diese Bedingungen aktualisieren; das Datum steht oben. Sie können Loom jederzeit nicht mehr nutzen und Ihren Arbeitsbereich löschen. Wir dürfen Konten sperren, die gegen diese Regeln verstoßen."],
      ],
    },
    {
      h: ["Questions", "Fragen"],
      p: [[`Write to ${CONTACT}.`, `Schreiben Sie an ${CONTACT}.`]],
    },
  ],
};

export const PROCESSOR: LDoc = {
  title: ["Struinova processor note", "Struinova Auftragsverarbeitungs-Notiz"],
  updated: "October 2026",
  intro: [
    "This note from Woodsage Partners, Inc., d/b/a Struinova Innovation (Indianapolis, USA) says what data Loom handles, who handles it on Struinova's behalf, where it is stored, and how to ask questions or request deletion.",
    "Diese Notiz von Woodsage Partners, Inc., d/b/a Struinova Innovation (Indianapolis, USA) sagt, welche Daten Loom verarbeitet, wer sie im Auftrag von Struinova verarbeitet, wo sie gespeichert werden und wie Sie Fragen stellen oder Löschung verlangen können.",
  ],
  sections: [
    {
      h: ["Roles", "Rollen"],
      p: [
        ["For the process maps and text that customers enter, Woodsage Partners, Inc., d/b/a Struinova Innovation (Indianapolis, USA) acts as a processor on the customer's behalf. For account and sign-up details (name, email and so on), Struinova acts as a controller.", "Für die Prozesslandkarten und Texte, die Kunden eingeben, handelt Struinova Innovation (Woodsage Partners, Inc., Indianapolis, USA, handelnd unter dem Namen Struinova) als Auftragsverarbeiter im Namen des Kunden. Für Konto- und Anmeldedaten (Name, E-Mail usw.) handelt Struinova als Verantwortlicher."],
      ],
    },
    {
      h: ["What data Loom handles", "Welche Daten Loom verarbeitet"],
      p: [["", ""]],
      bullets: [
        ["Account data: email address, password (stored only as a hash), optional name, job title, phone number and profile photo.", "Kontodaten: E-Mail-Adresse, Passwort (nur als Hash gespeichert), optional Name, Funktion, Telefonnummer und Profilfoto."],
        ["Content: process, lane, role and step names; descriptions; line details; plan and phase names; optional \"context for the AI\" text.", "Inhalte: Namen von Prozessen, Bahnen, Rollen und Schritten; Beschreibungen; Linien-Details; Namen von Plänen und Phasen; optionaler „Kontext für die KI“-Text."],
        ["Technical data: login sessions, who is online (presence), language and theme preferences.", "Technische Daten: Anmeldesitzungen, wer online ist (Präsenz), Sprach- und Darstellungseinstellungen."],
        ["Email: sign-in, password-reset and invitation messages.", "E-Mail: Anmelde-, Passwort-Zurücksetzen- und Einladungsnachrichten."],
      ],
    },
    {
      h: ["Not collected", "Nicht erfasst"],
      p: [
        ["Loom does not ask for payment details, government IDs or special categories of personal data. Please don't enter them in descriptions or notes.", "Loom fragt weder Zahlungsdaten noch Ausweisnummern oder besondere Kategorien personenbezogener Daten ab. Bitte geben Sie diese nicht in Beschreibungen oder Notizen ein."],
      ],
    },
    {
      h: ["Sub-processors", "Unterauftragsverarbeiter"],
      p: [["", ""]],
      bullets: [
        ["Supabase — database, sign-in, photo storage, presence. Sees all account data and content. United States (us-east-1).", "Supabase – Datenbank, Anmeldung, Foto-Speicherung, Präsenz. Sieht alle Kontodaten und Inhalte. USA (us-east-1)."],
        ["Vercel — hosts and serves the web app. Sees requests and responses passing through the app.", "Vercel – hostet und liefert die Web-App aus. Sieht Anfragen und Antworten, die durch die App laufen."],
        ["Anthropic — translates content between English and German on request. Sees the text being translated, not account identifiers. United States.", "Anthropic – übersetzt Inhalte auf Anfrage zwischen Englisch und Deutsch. Sieht den zu übersetzenden Text, keine Konto-Kennungen. USA."],
        ["Resend — sends sign-in, reset and invitation emails. Sees the recipient address and message. United States.", "Resend – versendet Anmelde-, Zurücksetzen- und Einladungs-E-Mails. Sieht die Empfängeradresse und die Nachricht. USA."],
      ],
    },
    {
      h: ["Where data is stored", "Wo Daten gespeichert werden"],
      p: [
        ["Loom's database currently runs in the United States, which for customers in the EU is a transfer to a third country, covered by the providers' standard contractual clauses and, where available, the EU–US Data Privacy Framework. If a customer needs EU-only storage, the database can be moved to an EU region as a separate project.", "Die Datenbank von Loom läuft derzeit in den USA. Für Kunden in der EU ist das eine Übermittlung in ein Drittland, abgedeckt durch die Standardvertragsklauseln der Anbieter und, wo verfügbar, das EU-US Data Privacy Framework. Benötigt ein Kunde ausschließlich EU-Speicherung, kann die Datenbank als separates Projekt in eine EU-Region verlegt werden."],
      ],
    },
    {
      h: ["Security", "Sicherheit"],
      p: [["", ""]],
      bullets: [
        ["Each workspace's data is isolated at the database level, so one customer cannot read another's.", "Die Daten jedes Arbeitsbereichs sind auf Datenbankebene getrennt, sodass ein Kunde die eines anderen nicht lesen kann."],
        ["Traffic is encrypted in transit; passwords are never stored in readable form.", "Der Datenverkehr ist bei der Übertragung verschlüsselt; Passwörter werden nie lesbar gespeichert."],
        ["Profile photos are private: shown only to signed-in members of the same workspace.", "Profilfotos sind privat: Sie werden nur angemeldeten Mitgliedern desselben Arbeitsbereichs gezeigt."],
      ],
    },
    {
      h: ["Retention and deletion", "Aufbewahrung und Löschung"],
      p: [["", ""]],
      bullets: [
        ["Content stays until the customer deletes it. Deleting a Process removes its Lanes, Steps, Lines, Plans and Phases.", "Inhalte bleiben, bis der Kunde sie löscht. Das Löschen eines Prozesses entfernt seine Bahnen, Schritte, Linien, Pläne und Phasen."],
        ["A workspace owner can delete the whole Workspace in the app, including cached translations. This cannot be undone.", "Ein Eigentümer kann den gesamten Arbeitsbereich in der App löschen, einschließlich zwischengespeicherter Übersetzungen. Das kann nicht rückgängig gemacht werden."],
        ["Or write to us and we will delete the workspace and account data within 30 days.", "Oder schreiben Sie uns; wir löschen die Daten des Arbeitsbereichs und des Kontos innerhalb von 30 Tagen."],
      ],
    },
    {
      h: ["Rights and contact", "Rechte und Kontakt"],
      p: [
        [`Customers can ask for access to, correction of, export of or deletion of their data, and can ask questions about this note, by emailing ${CONTACT}.`, `Kunden können Auskunft, Berichtigung, Export oder Löschung ihrer Daten verlangen und Fragen zu dieser Notiz stellen, per E-Mail an ${CONTACT}.`],
      ],
    },
  ],
};
