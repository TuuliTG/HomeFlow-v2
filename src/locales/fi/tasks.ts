import type { Messages } from '@/locales/en';

export const tasks: Messages['tasks'] = {
  eyebrow: 'Tehtävät',
  newTask: 'Uusi tehtävä',
  board: {
    title: 'Yhteiset tehtävät',
    showCompleted: 'Näytä tehdyt',
    show: 'Näytä',
    loadFailed: 'Tehtäviä ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
    filters: {
      all: 'Kaikki',
      today: 'Tänään',
      week: 'Tällä viikolla',
      undated: 'Ei määräpäivää',
      available: 'Vapaat',
    },
    empty: {
      all: 'Ei vielä tehtäviä. Luo ensimmäinen!',
      today: 'Tänään ei ole mitään tehtävää.',
      week: 'Tällä viikolla ei ole mitään tehtävää.',
      undated: 'Kaikilla tehtävillä on määräpäivä.',
      available: 'Kaikki tehtävät on jo varattu.',
    },
  },
  due: {
    today: 'Määräpäivä tänään',
    tomorrow: 'Määräpäivä huomenna',
    on: (date) => `Määräpäivä ${date}`,
    was: (date) => `Määräpäivä oli ${date}`,
  },
  dueGroups: {
    overdue: 'Myöhässä',
    later: 'Myöhemmin',
    noDueDate: 'Ei määräpäivää',
  },
  repeat: (days) => {
    if (days === 1) return 'Joka päivä';
    if (days === 7) return 'Joka viikko';
    if (days % 7 === 0) return `${String(days / 7)} viikon välein`;
    return `${String(days)} päivän välein`;
  },
  award: {
    heading: 'Odottaa pisteitä',
    notDoneYet: 'Ei vielä tehty',
    doneBy: (name: string) => `Teki: ${name}`,
    pointsFor: (title: string) => `Pisteet tehtävästä ${title}`,
    award: 'Anna pisteet',
    awardLabel: (title: string) => `Anna pisteet: ${title}`,
    failed: 'Pisteitä ei voitu antaa. Yritä uudelleen.',
  },
  card: {
    private: 'Yksityinen',
    forChildren: 'Lapsille',
    waitingForPoints: 'Odottaa pisteitä',
    addedBy: {
      you: 'Lisääjä: sinä',
      someone: 'Lisääjä: joku',
      named: (name) => `Lisääjä: ${name}`,
    },
    pickedUpBy: {
      you: 'Varaaja: sinä',
      someone: 'Varaaja: joku',
      named: (name) => `Varaaja: ${name}`,
    },
    lastDoneBy: (when) => ({
      you: `Viimeksi tehnyt: sinä, ${when}`,
      someone: `Viimeksi tehnyt: joku, ${when}`,
      named: (name) => `Viimeksi tehnyt: ${name}, ${when}`,
    }),
    daysAgo: (days) => {
      if (days === 0) return 'tänään';
      if (days === 1) return 'eilen';
      return `${String(days)} päivää sitten`;
    },
    images: (title) => `Kuvat: ${title}`,
    image: (position, title) => `Kuva ${String(position)}: ${title} (avautuu uuteen välilehteen)`,
    imagesFailed: 'Kuvia ei voitu ladata.',
    edit: 'Muokkaa',
    editLabel: (title) => `Muokkaa: ${title}`,
    pickUp: 'Varaa',
    putBack: 'Peru varaus',
    markDone: 'Merkitse tehdyksi',
    failures: {
      complete: 'Tehtävää ei voitu merkitä tehdyksi. Yritä uudelleen.',
      pickUp: 'Tehtävää ei voitu varata. Joku on ehkä ehtinyt ensin.',
      putBack: 'Varausta ei voitu perua. Yritä uudelleen.',
    },
    confirmTakeOverLabel: (name) => `Merkitäänkö tehdyksi, vaikka ${name} on varannut sen?`,
    confirmTakeOver: (name) => `${name} on varannut tämän. Merkitäänkö se silti tehdyksi?`,
    yesIDidIt: 'Kyllä, tein sen',
  },
  favourite: 'Suosikki',
  favouriteLabel: (title) => `Suosikki: ${title}`,
  notSaved: 'Ei tallennettu',
  completed: {
    heading: 'Tehdyt',
    loadFailed: 'Tehtyjä tehtäviä ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
    empty: 'Mitään ei ole vielä tehty.',
    doneBy: { you: 'Tekijä: sinä', someone: 'Tekijä: joku', named: (name) => `Tekijä: ${name}` },
    addAgain: 'Lisää uudelleen',
    addAgainLabel: (title) => `Lisää uudelleen: ${title}`,
  },
  me: {
    eyebrow: 'Minä',
    title: 'Omat tehtävät',
    pointsEarned: 'Ansaitut pisteet',
    pointsLoadFailed: 'Pisteitäsi ei voitu ladata.',
    toDo: 'Työn alla',
    loadFailed: 'Tehtäviäsi ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
    nothingPickedUp: 'Et ole vielä varannut mitään.',
    completed: 'Tehdyt',
    completedTasks: 'Tehdyt tehtävät',
    completedLoadFailed:
      'Tehtyjä tehtäviäsi ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
    completedEmpty: 'Mitään ei ole vielä tehty.',
    doneOn: (date) => `Tehty ${date}`,
    undo: 'Kumoa',
    undoLabel: (title) => `Kumoa: ${title}`,
    undoFailed:
      'Tätä ei voitu kumota. Tehdyksi merkinnän voi kumota tunnin sisällä, jos seuraavaa kertaa ei ole vielä tehty.',
    youHelped: (name) => `${name} teki, sinä autoit`,
  },
  child: {
    eyebrow: 'Minä',
    title: 'Omat tähdet',
    myTasks: 'Omat tehtävät',
    nothingToDo: 'Ei vielä tehtäviä.',
    pickOnBoard: 'Valitse tehtävä Yhteiset-sivulta',
  },
  childBoard: {
    title: 'Tehtävät sinulle',
    free: 'Vapaana',
    nothingFree: 'Juuri nyt ei ole vapaita tehtäviä.',
    yours: 'Sinun valitsemasi',
    othersDoing: 'Muut tekevät',
    doingIt: (name) => `${name} tekee tätä`,
  },
  helpers: {
    eyebrow: 'Tehdyt',
    title: 'Kuka auttoi?',
    description: (title, points) =>
      `Jaa tehtävän ${title} pisteitä (${points}) auttaneille. Antamasi pisteet vähennetään omistasi.`,
    whoHelped: 'Kuka auttoi?',
    whoHelpedLabel: (title) => `Kuka auttoi: ${title}?`,
    helped: (name) => `${name} auttoi`,
    pointsFor: (name) => `Pisteet: ${name}`,
    youKeep: (kept) => `Sinulle jää ${kept}.`,
    tooMany: (points) => `Yhteensä enemmän kuin tehtävän pisteet (${points}).`,
    noOneElse: 'Kotitaloudessasi ei ole vielä muita.',
    unavailable:
      'Auttajat voi valita viikon ajan siitä, kun merkitsit pisteitä antavan yhteisen tehtävän tehdyksi.',
    loadFailed:
      'Tehtävää ja kotitaloutta ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
    saveFailed: 'Auttajia ei voitu tallentaa. Yritä uudelleen.',
    askAfterDone: (title) => `${title} tehty! Teittekö yhdessä?`,
  },
  requests: {
    ask: 'Pyydä',
    askLabel: (title) => `Pyydä jotakuta tekemään: ${title}`,
    eyebrow: 'Tehtävät',
    title: 'Pyydä tekijää',
    whoToAsk: 'Keneltä pyydetään',
    send: 'Lähetä pyyntö',
    noOne: 'Kukaan muu kotitaloudessasi ei voi tehdä tätä tehtävää.',
    unavailable:
      'Tätä tehtävää ei voi enää pyytää keneltäkään: se on ehkä tehty, tai joku muu on varannut sen.',
    loadFailed:
      'Tehtävää ja kotitaloutta ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
    sendFailed: 'Pyyntöä ei voitu lähettää. Yritä uudelleen.',
    askedOfYou: 'Sinulta pyydetty',
    askedYou: (name) => `${name} pyysi sinua tekemään tämän.`,
    youAsked: (name) => `Pyysit tekijäksi: ${name}.`,
    asked: (requester, asked) => `${requester} pyysi tekijäksi: ${asked}.`,
    declined: (name) => `${name} ei voi tehdä tätä.`,
    accept: 'Hyväksy',
    acceptLabel: (title) => `Hyväksy: ${title}`,
    decline: 'Kieltäydy',
    declineLabel: (title) => `Kieltäydy: ${title}`,
    cancel: 'Peru pyyntö',
    cancelLabel: (title) => `Peru pyyntö: ${title}`,
    dismiss: 'OK',
    dismissLabel: (title) => `OK, piilota: ${title}`,
    answerFailed: 'Vastaustasi ei voitu tallentaa. Tehtävä on ehkä jo tehty tai varattu.',
    cancelFailed: 'Pyyntöä ei voitu perua. Yritä uudelleen.',
  },
  celebration: {
    done: (title) => `${title} tehty!`,
    pointsEarned: (points) => `+${points}`,
  },
  activity: {
    added: (name, title) => `${name} lisäsi tehtävän ${title}`,
    dismiss: 'Sulje',
  },
};
