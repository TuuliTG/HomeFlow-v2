import type { Messages } from '@/locales/en';
import { common, possessive } from '@/locales/sv/common';

export const rewards: Messages['rewards'] = {
  eyebrow: 'Belöningar',
  title: 'Belöningar och mål',
  newGoal: 'Nytt mål',
  loadFailed: 'Det gick inte att ladda målen. Kontrollera anslutningen och ladda om sidan.',
  sections: {
    shared: {
      heading: 'Gemensamma mål',
      empty: 'Inga gemensamma mål än.',
    },
    yours: {
      heading: 'Dina mål',
      empty: 'Du har inga egna mål än.',
    },
    members: { heading: 'Familjemedlemmarnas mål', empty: null },
  },
  claimedHeading: 'Inlösta belöningar',
  owner: { shared: 'Gemensam', yours: 'Din', named: possessive },
  claimedOn: (date) => `Inlöst ${date}`,
  aFamilyMember: 'En familjemedlem',
  celebration: {
    claimed: (title) => `Belöning inlöst: ${title}!`,
    badge: 'Belöning inlöst!',
  },
  jar: {
    savingFor: 'Sparar till',
    ofTarget: (target) => `/ ${String(target)}`,
    noGoal: 'Inget mål än',
    loadFailed: 'Det gick inte att ladda ditt mål.',
  },
  goal: {
    othersGoal: (name) => `${possessive(name)} mål`,
    progress: (points, target) => `${String(points)} / ${String(target)} poäng`,
    progressLabel: (title) => `Framsteg mot ${title}`,
    progressValue: (points, target) => `${String(points)} av ${String(target)} poäng`,
    pointsToGo: (missing) => `${common.points(missing)} kvar`,
    participantsShort: (count) =>
      `Tillräckligt med poäng! ${count === 1 ? 'En person' : `${String(count)} personer`} behöver fortfarande tjäna ihop sin del.`,
    othersReached: (name) => `${name} nådde det här målet!`,
    participantsReached: 'Målet är nått! Någon som är med löser in belöningen.',
    participantsLabel: (title) => `Poäng från var och en som är med i ${title}`,
    participantPoints: (points) => common.points(points),
    participantDone: ', klar',
    reached: 'Målet är nått!',
    claim: 'Lös in belöningen',
    claimLabel: (title) => `Lös in belöningen: ${title}`,
    claimFailed: 'Det gick inte att lösa in belöningen. Kontrollera anslutningen och försök igen.',
    edit: 'Redigera',
    editLabel: (title) => `Redigera mål: ${title}`,
    deleteLabel: (title) => `Ta bort mål: ${title}`,
    confirmDelete: (title, isShared) =>
      `Ta bort ”${title}”${isShared ? ' för alla som är med' : ''}? Det går inte att ångra.`,
    deleteFailed: 'Det gick inte att ta bort målet. Försök igen.',
  },
  form: {
    reward: 'Belöning',
    rewardPlaceholder: 't.ex. Pizzakväll',
    pointsNeeded: 'Poäng som behövs',
    whoFor: 'Vem det gäller',
    scopes: { shared: 'Tillsammans', personal: 'En person' },
    scopeHints: {
      shared: 'Alla som är med samlar poäng till det.',
      personal: 'Bara den personens poäng räknas.',
    },
    whose: 'Vems mål',
    me: 'Jag',
    onlyAdults: 'Bara vuxna sätter mål. Be en vuxen i familjen om ett.',
    participants: 'Vilka som är med',
    minimum: 'Minst',
    minimumFor: (name) => `Minsta antal poäng från ${name} (valfritt)`,
    hasOpenGoal: (name) => `${name} – mål pågår`,
    everyoneHasOpenGoal: 'Alla har redan ett eget mål på gång. Lös in eller ta bort ett först.',
    submit: 'Sätt mål',
    checkDetails: 'Kontrollera uppgifterna om målet.',
    saveFailed: 'Det gick inte att spara målet. Försök igen.',
    openGoalExists:
      'Någon har redan ett liknande mål på gång. Lös in eller ta bort det innan du sätter nästa.',
    edit: {
      title: 'Redigera mål',
      submit: 'Spara ändringar',
      notFound: 'Det här målet kan inte ändras: det kan ha lösts in eller tagits bort.',
      backToRewards: 'Tillbaka till belöningarna',
    },
    errors: {
      rewardRequired: 'Ge belöningen ett namn.',
      rewardTooLong: (max) => `Belöningen får ha högst ${String(max)} tecken.`,
      targetPointsRange: (max) =>
        `Poäng som behövs måste vara ett heltal från 1 till ${String(max)}.`,
      participantsRequired: 'Välj vilka som är med.',
      minimumRange: 'Ett minimum måste vara ett heltal, 1 eller mer.',
      minimumsTooHigh: 'Tillsammans får minimipoängen inte vara fler än poängen som behövs.',
    },
  },
};
