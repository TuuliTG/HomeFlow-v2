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
    off: 'Saa ilmoituksia tälle laitteelle perheesi tehtävistä.',
    on: 'Saat ilmoituksia tälle laitteelle perheesi tehtävistä.',
  },
  turnOn: 'Laita ilmoitukset päälle',
  turnOff: 'Laita ilmoitukset pois päältä',
  changeFailed: 'Ilmoituksia ei voitu muuttaa. Yritä uudelleen.',
  choices: {
    legend: 'Ilmoita minulle, kun',
    kinds: {
      taskAdded: 'joku lisää yhteisen tehtävän',
      taskCompleted: 'joku tekee yhteisen tehtävän',
      taskLiked: 'joku antaa peukun tekemälleni tehtävälle',
      taskCommented: 'joku kommentoi tehtävää, jonka tein tai jota kommentoin',
      taskRequested: 'joku pyytää minua tekemään tehtävän',
      requestAnswered: 'joku vastaa, kun pyydän häntä tekemään tehtävän',
      reminder: 'asettamani muistutuksen aika tulee',
    },
    allDevices: 'Nämä valinnat koskevat kaikkia laitteitasi.',
    saveFailed: 'Valintaasi ei voitu tallentaa. Yritä uudelleen.',
  },
};
