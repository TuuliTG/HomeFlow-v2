import type { Messages } from '@/locales/en';
import { ordinal } from '@/locales/sv/common';

export const tasks: Messages['tasks'] = {
  eyebrow: 'Uppgifter',
  newTask: 'Ny uppgift',
  board: {
    title: 'Gemensamma uppgifter',
    showCompleted: 'Visa gjorda',
    show: 'Visa',
    search: 'Sök uppgifter',
    noMatches: (search) => `Inga uppgifter matchar ”${search}”.`,
    matches: (count) =>
      count === 1 ? '1 uppgift hittades' : `${String(count)} uppgifter hittades`,
    loadFailed: 'Det gick inte att ladda uppgifterna. Kontrollera anslutningen och ladda om sidan.',
    filters: {
      all: 'Alla',
      today: 'I dag',
      week: 'Den här veckan',
      undated: 'Ingen förfallodag',
    },
    empty: {
      all: 'Inga uppgifter än. Skapa den första!',
      today: 'Inget ska göras i dag.',
      week: 'Inget ska göras den här veckan.',
      undated: 'Alla uppgifter har en förfallodag.',
    },
    available: 'Lediga',
    emptyAvailable: {
      all: 'Alla uppgifter har redan tagits.',
      today: 'Allt som ska göras i dag har redan tagits.',
      week: 'Allt som ska göras den här veckan har redan tagits.',
      undated: 'Alla uppgifter utan förfallodag har redan tagits.',
    },
  },
  due: {
    today: 'Ska göras i dag',
    tomorrow: 'Ska göras i morgon',
    on: (date) => `Ska göras ${date}`,
    was: (date) => `Skulle göras ${date}`,
  },
  dueGroups: {
    overdue: 'Försenade',
    later: 'Senare',
    noDueDate: 'Ingen förfallodag',
  },
  repeat: (days) => {
    if (days === 1) return 'Varje dag';
    if (days === 2) return 'Varannan dag';
    if (days === 7) return 'Varje vecka';
    if (days === 14) return 'Varannan vecka';
    if (days % 7 === 0) return `Var ${ordinal(days / 7)} vecka`;
    return `Var ${ordinal(days)} dag`;
  },
  award: {
    heading: 'Väntar på poäng',
    notDoneYet: 'Inte gjord än',
    doneBy: (name: string) => `Gjord av ${name}`,
    pointsFor: (title: string) => `Poäng för ${title}`,
    award: 'Ge poäng',
    awardLabel: (title: string) => `Ge poäng: ${title}`,
    failed: 'Det gick inte att ge poängen. Försök igen.',
  },
  card: {
    private: 'Privat',
    forChildren: 'För barn',
    waitingForPoints: 'Väntar på poäng',
    addedBy: {
      you: 'Tillagd av dig',
      someone: 'Tillagd av någon',
      named: (name) => `Tillagd av ${name}`,
    },
    pickedUpBy: {
      you: 'Tagen av dig',
      someone: 'Tagen av någon',
      named: (name) => `Tagen av ${name}`,
    },
    lastDoneBy: (when) => ({
      you: `Senast gjord av dig, ${when}`,
      someone: `Senast gjord av någon, ${when}`,
      named: (name) => `Senast gjord av ${name}, ${when}`,
    }),
    daysAgo: (days) => {
      if (days === 0) return 'i dag';
      if (days === 1) return 'i går';
      return `för ${String(days)} dagar sedan`;
    },
    images: (title) => `Bilder: ${title}`,
    image: (position, title) => `Bild ${String(position)} av ${title} (öppnas i en ny flik)`,
    imagesFailed: 'Det gick inte att ladda bilderna.',
    edit: 'Redigera',
    editLabel: (title) => `Redigera: ${title}`,
    pickUp: 'Ta',
    putBack: 'Lämna tillbaka',
    markDone: 'Markera som gjord',
    failures: {
      complete: 'Det gick inte att markera uppgiften som gjord. Försök igen.',
      pickUp: 'Det gick inte att ta uppgiften. Någon kan ha hunnit före.',
      putBack: 'Det gick inte att lämna tillbaka uppgiften. Försök igen.',
    },
    confirmTakeOverLabel: (name) => `Markera som gjord i stället för ${name}?`,
    confirmTakeOver: (name) => `${name} har tagit den här. Markera den som gjord ändå?`,
    yesIDidIt: 'Ja, jag gjorde den',
  },
  favourite: 'Favorit',
  favouriteLabel: (title) => `Favorit: ${title}`,
  notSaved: 'Inte sparad',
  completed: {
    heading: 'Gjorda',
    loadFailed:
      'Det gick inte att ladda de gjorda uppgifterna. Kontrollera anslutningen och ladda om sidan.',
    empty: 'Inget gjort än.',
    doneBy: {
      you: 'Gjord av dig',
      someone: 'Gjord av någon',
      named: (name) => `Gjord av ${name}`,
    },
    addAgain: 'Lägg till igen',
    addAgainLabel: (title) => `Lägg till ${title} igen`,
  },
  me: {
    eyebrow: 'Jag',
    title: 'Mina uppgifter',
    pointsEarned: 'Intjänade poäng',
    pointsLoadFailed: 'Det gick inte att ladda dina poäng.',
    toDo: 'Att göra',
    loadFailed:
      'Det gick inte att ladda dina uppgifter. Kontrollera anslutningen och ladda om sidan.',
    nothingPickedUp: 'Du har inte tagit något än.',
    completed: 'Gjorda',
    completedTasks: 'Gjorda uppgifter',
    completedLoadFailed:
      'Det gick inte att ladda dina gjorda uppgifter. Kontrollera anslutningen och ladda om sidan.',
    completedEmpty: 'Inget gjort än.',
    doneOn: (date) => `Gjord ${date}`,
    undo: 'Ångra',
    undoLabel: (title) => `Ångra: ${title}`,
    undoFailed:
      'Det gick inte att ångra. En uppgift kan ångras inom en timme, innan nästa gång är gjord.',
    youHelped: (name) => `Du hjälpte ${name}`,
  },
  child: {
    eyebrow: 'Jag',
    title: 'Mina stjärnor',
    myTasks: 'Mina uppgifter',
    nothingToDo: 'Inget att göra än.',
    pickOnBoard: 'Välj en uppgift under Gemensamma',
  },
  childBoard: {
    title: 'Uppgifter för dig',
    free: 'Lediga att välja',
    nothingFree: 'Inga lediga uppgifter just nu.',
    yours: 'Valda av dig',
    othersDoing: 'Andra gör',
    doingIt: (name) => `${name} gör den`,
  },
  helpers: {
    eyebrow: 'Gjorda',
    title: 'Vem hjälpte till?',
    description: (title, points) =>
      `Dela ${points} för ${title} med dem som hjälpte till. Det du ger dras från dina poäng.`,
    whoHelped: 'Vem hjälpte till?',
    whoHelpedLabel: (title) => `Vem hjälpte till med ${title}?`,
    helped: (name) => `${name} hjälpte till`,
    pointsFor: (name) => `Poäng för ${name}`,
    youKeep: (kept) => `Du behåller ${kept}.`,
    tooMany: (points) => `Tillsammans blir det mer än uppgiftens ${points}.`,
    noOneElse: 'Ingen annan finns i ditt hushåll än.',
    unavailable:
      'Du kan ange vem som hjälpte till i en vecka efter att du markerat en gemensam uppgift med poäng som gjord.',
    loadFailed:
      'Det gick inte att ladda uppgiften och ditt hushåll. Kontrollera anslutningen och ladda om sidan.',
    saveFailed: 'Det gick inte att spara vem som hjälpte till. Försök igen.',
    askAfterDone: (title) => `${title} gjord! Hjälpte någon till?`,
  },
  requests: {
    ask: 'Fråga',
    askLabel: (title) => `Be någon göra ${title}`,
    eyebrow: 'Uppgifter',
    title: 'Fråga någon',
    whoToAsk: 'Vem du frågar',
    send: 'Skicka förfrågan',
    noOne: 'Ingen annan i ditt hushåll kan göra den här uppgiften.',
    unavailable:
      'Den här uppgiften kan inte längre ges till någon: den kan vara gjord, eller så har någon annan tagit den.',
    loadFailed:
      'Det gick inte att ladda uppgiften och ditt hushåll. Kontrollera anslutningen och ladda om sidan.',
    sendFailed: 'Det gick inte att skicka förfrågan. Försök igen.',
    askedOfYou: 'Du har blivit tillfrågad',
    askedYou: (name) => `${name} bad dig göra den här.`,
    youAsked: (name) => `Du bad ${name} göra den här.`,
    asked: (requester, asked) => `${requester} bad ${asked} göra den här.`,
    declined: (name) => `${name} kan inte göra den här.`,
    accept: 'Tacka ja',
    acceptLabel: (title) => `Tacka ja: ${title}`,
    decline: 'Tacka nej',
    declineLabel: (title) => `Tacka nej: ${title}`,
    cancel: 'Dra tillbaka förfrågan',
    cancelLabel: (title) => `Dra tillbaka förfrågan: ${title}`,
    dismiss: 'OK',
    dismissLabel: (title) => `OK, dölj: ${title}`,
    answerFailed: 'Det gick inte att spara ditt svar. Uppgiften kan redan vara gjord eller tagen.',
    cancelFailed: 'Det gick inte att dra tillbaka förfrågan. Försök igen.',
  },
  celebration: {
    done: (title) => `${title} gjord!`,
    pointsEarned: (points) => `+${points}`,
  },
  activity: {
    added: (name, title) => `${name} lade till ${title}`,
    dismiss: 'Stäng',
  },
};
