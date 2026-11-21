import type { Messages } from '@/locales/en';

export const household: Messages['household'] = {
  yourHousehold: 'Ditt hushåll',
  loadFailed: 'Det gick inte att ladda hushållet. Kontrollera anslutningen och ladda om sidan.',
  setUp: {
    title: 'Skapa ditt hushåll',
    checkFailed:
      'Vi kunde inte kontrollera om du redan hör till ett hushåll. Kontrollera anslutningen och ladda om sidan.',
    startHeading: 'Skapa ett nytt hushåll',
    joinHeading: 'Gå med i din familj',
  },
  create: {
    label: 'Hushållets namn',
    submit: 'Skapa hushåll',
    placeholder: 't.ex. Familjen Lindqvist',
    nameRequired: 'Ge hushållet ett namn.',
    failed: 'Det gick inte att skapa hushållet. Försök igen.',
  },
  join: {
    label: 'Inbjudningskod',
    submit: 'Gå med i hushållet',
    invalidCode: 'Skriv den 8 tecken långa inbjudningskoden.',
    unknownCode: 'Inget hushåll har den här inbjudningskoden. Dubbelkolla den med din familj.',
    failed: 'Det gick inte att gå med i hushållet. Försök igen.',
  },
  invite: {
    heading: 'Bjud in din familj',
    copy: 'Kopiera koden',
    copied: 'Kopierad',
    copyFailed: 'Det gick inte att kopiera. Markera koden själv.',
  },
  members: {
    heading: 'Medlemmar',
    loadFailed: 'Det gick inte att ladda medlemmarna.',
    child: 'Barn',
    setChildFailed: 'Det gick inte att spara ändringen. Försök igen.',
    canAddTasks: 'Kan lägga till uppgifter',
    setCanAddTasksFailed: 'Det gick inte att spara ändringen. Försök igen.',
    newCode: 'Ny inloggningskod',
    newCodeFailed: 'Det gick inte att skapa en ny kod. Försök igen.',
    onThisDevice: 'På den här enheten',
    setOnThisDeviceFailed:
      'Det gick inte att logga in eller ut barnet på den här enheten. Försök igen.',
    confirmRemove: (name: string) => `Ta bort ${name} med poäng och historik?`,
    yesRemove: 'Ja, ta bort',
    removeFailed: 'Vi kunde inte ta bort barnet. Försök igen.',
    /** Who a member is, under their name in the list. */
    roles: { you: 'Du', adult: 'Vuxen', child: 'Barn' },
    settings: 'Inställningar',
    removeFromFamily: (name: string) => `Ta bort ${name} från familjen`,
    /** The link from a member's page back to the family. */
    backToFamily: 'Familj',
  },
  family: {
    heading: 'Din familj',
    link: (name: string) => `Öppna ${name}`,
  },
  addChild: {
    heading: 'Lägg till ett barn utan e-post',
    label: 'Barnets namn',
    submit: 'Lägg till barn',
    nameRequired: 'Skriv barnets namn.',
    failed: 'Det gick inte att lägga till barnet. Försök igen.',
  },
  signInCode: {
    heading: (name: string) => `Inloggningskod för ${name}`,
    howTo: (name: string) =>
      `Öppna HomeFlow på enheten som ${name} använder, välj ”Logga in med en barnkod” och skriv den här koden.`,
    expires: (time: string) => `Koden fungerar en gång, fram till kl. ${time}.`,
  },
};
