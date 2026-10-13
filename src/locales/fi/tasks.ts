import type { Messages } from '@/locales/en';

export const tasks: Messages['tasks'] = {
  eyebrow: 'Tehtävät',
  newTask: 'Uusi tehtävä',
  board: {
    title: 'Yhteiset tehtävät',
    description: 'Valitse mikä tahansa tehtävä. Omat yksityiset tehtäväsi ovat Minä-sivulla.',
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
    hint: 'Lapset lisäsivät nämä tehtävät. Valitse, minkä arvoinen kukin oli; pisteet saa tehtävän tekijä.',
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
    description: 'Varaamasi tehtävät, yksityiset tehtäväsi ja se, mitä olet tehnyt.',
    pointsEarned: 'Ansaitut pisteet',
    pointsLoadFailed: 'Pisteitäsi ei voitu ladata.',
    toDo: 'Työn alla',
    loadFailed: 'Tehtäviäsi ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
    nothingPickedUp: 'Et ole vielä varannut mitään. Valitse tehtävä yhteisistä tehtävistä.',
    completed: 'Tehdyt',
    completedTasks: 'Tehdyt tehtävät',
    completedLoadFailed:
      'Tehtyjä tehtäviäsi ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
    completedEmpty: 'Tehdyiksi merkitsemäsi tehtävät näkyvät tässä.',
    doneOn: (date) => `Tehty ${date}`,
    undo: 'Kumoa',
    undoLabel: (title) => `Kumoa: ${title}`,
    undoFailed:
      'Tätä ei voitu kumota. Tehdyksi merkinnän voi kumota tunnin sisällä, jos seuraavaa kertaa ei ole vielä tehty.',
    youHelped: (name) => `${name} teki, sinä autoit`,
  },
  helpers: {
    eyebrow: 'Tehdyt',
    title: 'Kuka auttoi?',
    description: (title, points) =>
      `Anna tehtävässä ${title} auttaneille osa sen pisteistä (${points}). Antamasi pisteet vähennetään omistasi, joten tehtävä on yhä saman arvoinen.`,
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
  celebration: {
    done: (title) => `${title} tehty!`,
    pointsEarned: (points) => `+${points}`,
  },
  activity: {
    added: (name, title) => `${name} lisäsi tehtävän ${title}`,
    dismiss: 'Sulje',
  },
};
