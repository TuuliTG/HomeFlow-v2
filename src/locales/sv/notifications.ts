import type { Messages } from '@/locales/en';

export const notifications: Messages['notifications'] = {
  heading: 'Aviseringar',
  explanations: {
    unsupported: 'Den här webbläsaren kan inte visa aviseringar från HomeFlow.',
    'needs-home-screen':
      'På iPhone fungerar aviseringar när HomeFlow finns på hemskärmen: tryck på Dela och sedan ”Lägg till på hemskärmen”. Öppna HomeFlow därifrån och slå på aviseringarna.',
    checking: 'Kontrollerar den här enheten…',
    blocked:
      'Aviseringar från HomeFlow är blockerade. Tillåt dem i telefonens eller webbläsarens inställningar och kom sedan tillbaka hit.',
    off: 'Få en avisering på den här enheten när någon lägger till en uppgift.',
    on: 'Du får en avisering på den här enheten när någon lägger till en uppgift.',
  },
  turnOn: 'Slå på aviseringar',
  turnOff: 'Stäng av aviseringar',
  changeFailed: 'Det gick inte att ändra aviseringarna. Försök igen.',
};
