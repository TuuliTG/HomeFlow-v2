import type { Messages } from '@/locales/en';

export const auth: Messages['auth'] = {
  hello: (name) => `Hei, ${name}`,
  loggedInAs: (email) => `Kirjautuneena: ${email}`,
  welcomeTitle: 'Tervetuloa HomeFlow’hun',
  welcomeDescription: 'Millä nimellä sinua kutsutaan?',
  logInTitle: 'Kirjaudu HomeFlow’hun',
  logInDescription: 'Jaa kotityöt reilusti perheesi kanssa.',
  logIn: {
    heading: 'Kirjaudu sisään',
    submit: 'Kirjaudu',
    switchPrompt: 'Uusi HomeFlow’ssa?',
    switchLabel: 'Luo tili',
  },
  createAccount: {
    heading: 'Luo tili',
    submit: 'Luo tili',
    switchPrompt: 'Onko sinulla jo tili?',
    switchLabel: 'Kirjaudu sisään',
  },
  email: 'Sähköposti',
  password: 'Salasana',
  passwordHint: (minLength) =>
    `Vähintään ${String(minLength)} merkkiä. Selain tai puhelin voi tallentaa sen puolestasi.`,
  invalidEmail: 'Anna toimiva sähköpostiosoite.',
  shortPassword: (minLength) => `Salasanassa pitää olla vähintään ${String(minLength)} merkkiä.`,
  failures: {
    'wrong-credentials': 'Väärä sähköposti tai salasana.',
    'account-exists': 'Tällä sähköpostilla on jo tili. Kirjaudu sisään.',
    'weak-password': (minLength) =>
      `Valitse vahvempi salasana (vähintään ${String(minLength)} merkkiä).`,
    'needs-email-confirmation':
      'HomeFlow on asetettu vahvistamaan sähköpostit, mutta se ei voi vielä lähettää niitä. Pyydä HomeFlow’n ylläpitäjää poistamaan “Confirm email” käytöstä Supabasessa.',
    'too-many-attempts': 'Liian monta yritystä. Odota muutama minuutti ja yritä uudelleen.',
    'unknown-child-code': 'Koodi ei toimi. Pyydä perheesi aikuiselta uusi koodi.',
    other: 'Se ei onnistunut. Yritä hetken päästä uudelleen.',
  },
  childCode: {
    open: 'Kirjaudu lapsen koodilla',
    openHint: 'Ei sähköpostia? Perheesi aikuinen lisää sinut HomeFlow’hun ja antaa sinulle koodin.',
    heading: 'Kirjaudu lapsen koodilla',
    label: 'Kirjautumiskoodi',
    hint: 'Perheesi aikuinen voi tehdä sinulle koodin kotitaloussivulla.',
    invalid: 'Kirjoita 8-merkkinen koodi.',
    submit: 'Kirjaudu',
    back: 'Kirjaudu sähköpostilla',
  },
  yourName: 'Nimesi',
  nameHint: 'Tällä nimellä perheesi näkee sinut HomeFlow’ssa.',
  enterName: 'Kirjoita nimesi.',
  nameNotSaved: 'Nimeä ei voitu tallentaa. Yritä uudelleen.',
};
