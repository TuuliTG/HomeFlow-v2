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
    off: 'Få aviseringar på den här enheten om familjens uppgifter.',
    on: 'Du får aviseringar på den här enheten om familjens uppgifter.',
  },
  turnOn: 'Slå på aviseringar',
  turnOff: 'Stäng av aviseringar',
  changeFailed: 'Det gick inte att ändra aviseringarna. Försök igen.',
  choices: {
    legend: 'Avisera mig när',
    kinds: {
      taskAdded: 'någon lägger till en gemensam uppgift',
      taskCompleted: 'någon gör klart en gemensam uppgift',
      taskRequested: 'någon ber mig göra en uppgift',
      requestAnswered: 'någon svarar när jag ber dem göra en uppgift',
      reminder: 'det är dags för en påminnelse jag har satt',
    },
    allDevices: 'De här valen gäller alla dina enheter.',
    saveFailed: 'Det gick inte att spara ditt val. Försök igen.',
  },
};
