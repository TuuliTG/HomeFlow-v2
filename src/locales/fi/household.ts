import type { Messages } from '@/locales/en';

export const household: Messages['household'] = {
  eyebrow: 'Kotitalous',
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
    you: ' (sinä)',
    child: 'Lapsi',
    isChild: (name: string) => `${name} on lapsi`,
    setChildFailed: 'Muutosta ei voitu tallentaa. Yritä uudelleen.',
    canAddTasks: 'Voi lisätä tehtäviä',
    canAddTasksFor: (name: string) => `${name} voi lisätä tehtäviä`,
    setCanAddTasksFailed: 'Muutosta ei voitu tallentaa. Yritä uudelleen.',
    newCode: 'Uusi kirjautumiskoodi',
    newCodeFor: (name: string) => `Uusi kirjautumiskoodi: ${name}`,
    newCodeFailed: 'Uutta koodia ei voitu tehdä. Yritä uudelleen.',
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
