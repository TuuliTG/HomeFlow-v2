import type { Messages } from '@/locales/en';
import { common } from '@/locales/fi/common';

export const rewards: Messages['rewards'] = {
  eyebrow: 'Palkinnot',
  title: 'Palkinnot ja tavoitteet',
  description:
    'Yhteisistä tehtävistä saa pisteitä. Tavoitteen asettamisen jälkeen ansaitut pisteet lasketaan siihen: perheen tavoitteisiin kaikkien pisteet, omiin tavoitteisiisi vain sinun.',
  newGoal: 'Uusi tavoite',
  loadFailed: 'Tavoitteita ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
  sections: {
    family: {
      heading: 'Perheen tavoitteet',
      empty:
        'Perheellä ei ole vielä tavoitteita. Aseta tavoite, jota kohti kaikki voivat tehdä töitä yhdessä, vaikkapa retki.',
    },
    yours: {
      heading: 'Omat tavoitteesi',
      empty:
        'Aseta itsellesi tavoite, vaikkapa herkku. Siihen lasketaan vain sinun pisteesi, ja perhe voi kannustaa sinua.',
    },
    members: { heading: 'Perheenjäsenten tavoitteet', empty: null },
  },
  claimedHeading: 'Lunastetut palkinnot',
  owner: { family: 'Perhe', yours: 'Sinun', named: (name) => name },
  claimedOn: (date) => `Lunastettu ${date}`,
  aFamilyMember: 'Perheenjäsen',
  goal: {
    othersGoal: (name) => `Tavoitteen asettaja: ${name}`,
    minimumFromEach: (minimum) => `Vähintään ${common.points(minimum)} jokaiselta jäseneltä`,
    progress: (points, target) => `${String(points)} / ${String(target)} pistettä`,
    progressLabel: (title) => `Edistyminen: ${title}`,
    progressValue: (points, target) => `${String(points)} / ${String(target)} pistettä`,
    pointsToGo: (missing) => `Vielä ${common.points(missing)}`,
    membersShort: (count) =>
      `Pisteitä on tarpeeksi! ${count === 1 ? 'Yhden jäsenen' : `${String(count)} jäsenen`} pitää vielä ansaita osuutensa.`,
    othersReached: (name) => `${name} saavutti tämän tavoitteen!`,
    memberPointsLabel: (title) => `Jäsenten pisteet tavoitteeseen ${title}`,
    memberDone: ', valmis',
    reached: 'Tavoite saavutettu!',
    claim: 'Lunasta palkinto',
    claimLabel: (title) => `Lunasta palkinto: ${title}`,
    claimFailed: 'Palkintoa ei voitu lunastaa. Tarkista yhteys ja yritä uudelleen.',
    deleteLabel: (title) => `Poista tavoite: ${title}`,
    confirmDelete: (title, isFamilyGoal) =>
      `Poistetaanko “${title}”${isFamilyGoal ? ' koko kotitaloudelta' : ''}? Poistoa ei voi perua.`,
    deleteFailed: 'Tavoitetta ei voitu poistaa. Yritä uudelleen.',
  },
  form: {
    description: 'Valitse palkinto ja montako pistettä siihen tarvitaan.',
    reward: 'Palkinto',
    rewardPlaceholder: 'esim. Pizzailta',
    pointsNeeded: 'Tarvittavat pisteet',
    whoFor: 'Kenelle',
    scopes: { shared: 'Perheelle', personal: 'Vain minulle' },
    scopeHints: {
      shared: 'Kaikkien pisteet lasketaan siihen, ja koko perhe näkee sen.',
      personal: 'Siihen lasketaan vain sinun pisteesi. Perhe näkee senkin ja voi kannustaa sinua.',
    },
    minimum: 'Vähimmäispisteet jokaiselta jäseneltä (vapaaehtoinen)',
    minimumHint:
      'Tavoite saavutetaan vasta, kun jokainen on ansainnut vähintään näin paljon, jottei kukaan tee kaikkea yksin.',
    submit: 'Aseta tavoite',
    checkDetails: 'Tarkista tavoitteen tiedot.',
    saveFailed: 'Tavoitetta ei voitu tallentaa. Yritä uudelleen.',
    errors: {
      rewardRequired: 'Anna palkinnolle nimi.',
      rewardTooLong: (max) => `Palkinnon nimessä saa olla enintään ${String(max)} merkkiä.`,
      targetPointsRange: (max) =>
        `Tarvittavien pisteiden pitää olla kokonaisluku 1–${String(max)}.`,
      minimumRange:
        'Jokaisen jäsenen vähimmäispisteiden pitää olla kokonaisluku yhdestä tarvittaviin pisteisiin.',
      minimumOnlyForFamily: 'Vähimmäispisteet jäsentä kohden koskevat vain perheen tavoitteita.',
    },
  },
};
