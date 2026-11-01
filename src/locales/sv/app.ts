import type { Messages } from '@/locales/en';

export const app: Messages['app'] = {
  nav: {
    label: 'Huvudmeny',
    me: 'Jag',
    tasks: 'Gemensamma',
    news: 'Nyheter',
    rewards: 'Belöningar',
    statistics: 'Statistik',
  },
  toasts: 'Uppdateringar',
  installHint: {
    title: 'Lägg till HomeFlow på hemskärmen',
    tapShare: 'Tryck på',
    share: 'Dela',
    then: ' och sedan',
    addToHomeScreen: 'Lägg till på hemskärmen',
    benefit: '. Då öppnas HomeFlow som en app och kan skicka aviseringar till dig.',
    gotIt: 'Uppfattat',
  },
  update: {
    available: 'En ny version av HomeFlow finns.',
    reload: 'Ladda om',
    later: 'Inte nu',
  },
  notFound: {
    title: 'Sidan hittades inte',
    description: 'Den här sidan finns inte.',
    backToTasks: 'Tillbaka till uppgifterna',
  },
  error: {
    title: 'Något gick fel',
    description: 'HomeFlow stötte på ett problem. Ladda om sidan och försök igen.',
    reload: 'Ladda om',
  },
  settings: {
    title: 'Inställningar',
  },
  language: {
    heading: 'Språk',
    label: 'HomeFlows språk',
  },
};
