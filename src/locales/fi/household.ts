import type { Messages } from '@/locales/en';

export const household: Messages['household'] = {
  yourHousehold: 'Kotitaloutesi',
  loadFailed: 'Kotitaloutta ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
  setUp: {
    title: 'Perusta kotitalous',
    checkFailed:
      'Emme voineet tarkistaa, kuulutko jo kotitalouteen. Tarkista yhteys ja lataa sivu uudelleen.',
    startHeading: 'Perusta uusi kotitalous',
    joinHeading: 'Liity perheeseesi',
  },
  create: {
    label: 'Kotitalouden nimi',
    submit: 'Perusta kotitalous',
    placeholder: 'esim. Virtaset',
    nameRequired: 'Anna kotitaloudelle nimi.',
    failed: 'Kotitaloutta ei voitu perustaa. Yritä uudelleen.',
  },
  join: {
    label: 'Kutsukoodi',
    submit: 'Liity kotitalouteen',
    invalidCode: 'Kirjoita 8-merkkinen kutsukoodi.',
    unknownCode: 'Millään kotitaloudella ei ole tätä kutsukoodia. Tarkista se perheeltäsi.',
    failed: 'Kotitalouteen ei voitu liittyä. Yritä uudelleen.',
  },
  invite: {
    heading: 'Kutsu perheesi',
    copy: 'Kopioi koodi',
    copied: 'Kopioitu',
    copyFailed: 'Kopiointi ei onnistunut. Valitse koodi itse.',
  },
  members: {
    heading: 'Jäsenet',
    loadFailed: 'Jäseniä ei voitu ladata.',
    child: 'Lapsi',
    saveFailed: 'Muutosta ei voitu tallentaa. Yritä uudelleen.',
    canAddTasks: 'Voi lisätä tehtäviä',
    newCode: 'Uusi kirjautumiskoodi',
    newCodeFailed: 'Uutta koodia ei voitu tehdä. Yritä uudelleen.',
    onThisDevice: 'Tällä laitteella',
    setOnThisDeviceFailed:
      'Lasta ei voitu kirjata sisään tai ulos tällä laitteella. Yritä uudelleen.',
    confirmRemove: (name: string) => `Poistetaanko ${name} pisteineen ja historioineen?`,
    yesRemove: 'Kyllä, poista',
    removeFailed: 'Lapsen poistaminen ei onnistunut. Yritä uudelleen.',
    /** Who a member is, under their name in the list. */
    roles: { you: 'Sinä', adult: 'Aikuinen', child: 'Lapsi' },
    notFound: 'Tätä jäsentä ei ole perheessäsi.',
    settings: 'Asetukset',
    removeFromFamily: (name: string) => `Poista ${name} perheestä`,
    /** The link from a member's page back to the family. */
    backToFamily: 'Perhe',
  },
  family: {
    heading: 'Perheesi',
    link: (name: string) => `Avaa ${name}`,
  },
  addChild: {
    heading: 'Lisää lapsi ilman sähköpostia',
    label: 'Lapsen nimi',
    submit: 'Lisää lapsi',
    nameRequired: 'Kirjoita lapsen nimi.',
    failed: 'Lasta ei voitu lisätä. Yritä uudelleen.',
  },
  signInCode: {
    heading: (name: string) => `Kirjautumiskoodi: ${name}`,
    howTo: (name: string) =>
      `Avaa HomeFlow laitteella, jota ${name} käyttää, valitse ”Kirjaudu lapsen koodilla” ja kirjoita tämä koodi.`,
    expires: (time: string) => `Koodi toimii kerran, kello ${time} asti.`,
  },
};
