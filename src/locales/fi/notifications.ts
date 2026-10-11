import type { Messages } from '@/locales/en';

export const notifications: Messages['notifications'] = {
  heading: 'Ilmoitukset',
  explanations: {
    unsupported: 'Tämä selain ei voi näyttää HomeFlow’n ilmoituksia.',
    'needs-home-screen':
      'iPhonessa ilmoitukset toimivat, kun HomeFlow on Koti-valikossa: napauta Jaa ja sitten “Lisää Koti-valikkoon”. Avaa HomeFlow sieltä ja laita ilmoitukset päälle.',
    checking: 'Tarkistetaan tätä laitetta…',
    blocked:
      'HomeFlow’n ilmoitukset on estetty. Salli ne puhelimen tai selaimen asetuksista ja palaa sitten tänne.',
    off: 'Laita ilmoitukset päälle, niin saat tälle laitteelle ilmoituksen, kun joku kotitaloudestasi lisää tehtävän.',
    on: 'Saat tälle laitteelle ilmoituksen, kun joku kotitaloudestasi lisää tehtävän.',
  },
  turnOn: 'Laita ilmoitukset päälle',
  turnOff: 'Laita ilmoitukset pois päältä',
  changeFailed: 'Ilmoituksia ei voitu muuttaa. Yritä uudelleen.',
};
