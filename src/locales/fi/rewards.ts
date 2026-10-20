import type { Messages } from '@/locales/en';
import { common } from '@/locales/fi/common';

export const rewards: Messages['rewards'] = {
  eyebrow: 'Palkinnot',
  title: 'Palkinnot ja tavoitteet',
  newGoal: 'Uusi tavoite',
  loadFailed: 'Tavoitteita ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
  sections: {
    shared: {
      heading: 'Yhteiset tavoitteet',
      empty: 'Yhteisiä tavoitteita ei ole vielä.',
    },
    yours: {
      heading: 'Omat tavoitteesi',
      empty: 'Sinulla ei ole vielä omia tavoitteita.',
    },
    members: { heading: 'Perheenjäsenten tavoitteet', empty: null },
  },
  claimedHeading: 'Lunastetut palkinnot',
  owner: { shared: 'Yhteinen', yours: 'Sinun', named: (name) => name },
  claimedOn: (date) => `Lunastettu ${date}`,
  aFamilyMember: 'Perheenjäsen',
  celebration: {
    claimed: (title) => `Palkinto lunastettu: ${title}!`,
    badge: 'Palkinto lunastettu!',
  },
  jar: {
    savingFor: 'Säästät tähän:',
    ofTarget: (target) => `/ ${String(target)}`,
    noGoal: 'Ei vielä tavoitetta',
    loadFailed: 'Tavoitettasi ei voitu ladata.',
  },
  goal: {
    othersGoal: (name) => `Tavoitteen asettaja: ${name}`,
    progress: (points, target) => `${String(points)} / ${String(target)} pistettä`,
    progressLabel: (title) => `Edistyminen: ${title}`,
    progressValue: (points, target) => `${String(points)} pistettä ${String(target)}:stä`,
    pointsToGo: (missing) => `Vielä ${common.points(missing)}`,
    participantsShort: (count) =>
      `Pisteitä on tarpeeksi! ${count === 1 ? 'Yhden' : String(count)} mukana olevan pitää vielä ansaita osuutensa.`,
    othersReached: (name) => `${name} saavutti tämän tavoitteen!`,
    participantsReached: 'Tavoite saavutettu! Joku mukana olevista lunastaa palkinnon.',
    participantsLabel: (title) => `Mukana olevien pisteet tavoitteeseen ${title}`,
    participantPoints: (points) => common.points(points),
    participantDone: ', valmis',
    reached: 'Tavoite saavutettu!',
    claim: 'Lunasta palkinto',
    claimLabel: (title) => `Lunasta palkinto: ${title}`,
    claimFailed: 'Palkintoa ei voitu lunastaa. Tarkista yhteys ja yritä uudelleen.',
    edit: 'Muokkaa',
    editLabel: (title) => `Muokkaa tavoitetta: ${title}`,
    deleteLabel: (title) => `Poista tavoite: ${title}`,
    confirmDelete: (title, isShared) =>
      `Poistetaanko “${title}”${isShared ? ' kaikilta mukana olevilta' : ''}? Poistoa ei voi perua.`,
    deleteFailed: 'Tavoitetta ei voitu poistaa. Yritä uudelleen.',
  },
  form: {
    reward: 'Palkinto',
    rewardPlaceholder: 'esim. Pizzailta',
    pointsNeeded: 'Tarvittavat pisteet',
    whoFor: 'Kenelle',
    scopes: { shared: 'Yhdessä', personal: 'Yhdelle' },
    scopeHints: {
      shared: 'Kaikki mukana olevat keräävät siihen pisteitä.',
      personal: 'Siihen lasketaan vain hänen pisteensä.',
    },
    whose: 'Kenen tavoite',
    me: 'Minä',
    onlyAdults: 'Vain aikuiset asettavat tavoitteita. Pyydä perheesi aikuiselta tavoitetta.',
    participants: 'Ketkä ovat mukana',
    minimum: 'Vähintään',
    minimumFor: (name) => `Vähintään (vapaaehtoinen): ${name}`,
    hasOpenGoal: (name) => `${name} – tavoite kesken`,
    everyoneHasOpenGoal: 'Kaikilla on jo oma tavoite kesken. Lunasta tai poista jokin ensin.',
    submit: 'Aseta tavoite',
    checkDetails: 'Tarkista tavoitteen tiedot.',
    saveFailed: 'Tavoitetta ei voitu tallentaa. Yritä uudelleen.',
    openGoalExists:
      'Jollakulla on jo kesken samanlainen tavoite. Lunasta tai poista se ennen seuraavan asettamista.',
    edit: {
      title: 'Muokkaa tavoitetta',
      submit: 'Tallenna muutokset',
      notFound: 'Tätä tavoitetta ei voi muuttaa: se on ehkä lunastettu tai poistettu.',
      backToRewards: 'Takaisin palkintoihin',
    },
    errors: {
      rewardRequired: 'Anna palkinnolle nimi.',
      rewardTooLong: (max) => `Palkinnon nimessä saa olla enintään ${String(max)} merkkiä.`,
      targetPointsRange: (max) =>
        `Tarvittavien pisteiden pitää olla kokonaisluku 1–${String(max)}.`,
      participantsRequired: 'Valitse, ketkä ovat mukana.',
      minimumRange: 'Vähimmäispisteiden pitää olla kokonaisluku, vähintään 1.',
      minimumsTooHigh:
        'Vähimmäispisteitä saa olla yhteensä enintään tarvittavien pisteiden verran.',
    },
  },
};
