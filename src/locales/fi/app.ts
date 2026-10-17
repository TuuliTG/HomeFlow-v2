import type { Messages } from '@/locales/en';

export const app: Messages['app'] = {
  nav: {
    label: 'Päävalikko',
    me: 'Minä',
    tasks: 'Yhteiset',
    news: 'Uutiset',
    rewards: 'Palkinnot',
    statistics: 'Tilastot',
  },
  toasts: 'Ilmoitukset',
  installHint: {
    title: 'Lisää HomeFlow Koti-valikkoon',
    tapShare: 'Napauta',
    share: 'Jaa',
    then: ' ja sitten',
    addToHomeScreen: 'Lisää Koti-valikkoon',
    benefit: '. Sen jälkeen HomeFlow aukeaa kuin sovellus ja voi lähettää sinulle ilmoituksia.',
    gotIt: 'Selvä',
  },
  notFound: {
    title: 'Sivua ei löytynyt',
    description: 'Tätä sivua ei ole olemassa.',
    backToTasks: 'Takaisin tehtäviin',
  },
  error: {
    title: 'Jotain meni pieleen',
    description: 'HomeFlow kohtasi ongelman. Lataa sivu uudelleen ja yritä uudestaan.',
    reload: 'Lataa uudelleen',
  },
  settings: {
    title: 'Asetukset',
    description: 'Perheesi, ilmoitukset ja kieli.',
  },
  language: {
    heading: 'Kieli',
    label: 'HomeFlow’n kieli',
    hint: 'Vaihtaa kielen tällä laitteella.',
  },
};
