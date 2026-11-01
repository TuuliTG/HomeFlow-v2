import type { Messages } from '@/locales/en';

export const auth: Messages['auth'] = {
  hello: (name) => `Hej, ${name}`,
  loggedInAs: (email) => `Inloggad som ${email}`,
  welcomeTitle: 'Välkommen till HomeFlow',
  welcomeDescription: 'Vad vill du kallas?',
  logInTitle: 'Logga in på HomeFlow',
  logInDescription: 'Dela hushållssysslorna rättvist med din familj.',
  logIn: {
    heading: 'Logga in',
    submit: 'Logga in',
    switchPrompt: 'Ny på HomeFlow?',
    switchLabel: 'Skapa konto',
  },
  createAccount: {
    heading: 'Skapa konto',
    submit: 'Skapa konto',
    switchPrompt: 'Har du redan ett konto?',
    switchLabel: 'Logga in',
  },
  email: 'E-post',
  password: 'Lösenord',
  passwordHint: (minLength) => `Minst ${String(minLength)} tecken.`,
  invalidEmail: 'Ange en giltig e-postadress.',
  shortPassword: (minLength) => `Lösenordet måste ha minst ${String(minLength)} tecken.`,
  failures: {
    'wrong-credentials': 'Fel e-post eller lösenord.',
    'account-exists': 'Det finns redan ett konto med den här e-postadressen. Logga in i stället.',
    'weak-password': (minLength) =>
      `Välj ett starkare lösenord (minst ${String(minLength)} tecken).`,
    'needs-email-confirmation':
      'HomeFlow är inställt på att bekräfta e-postadresser men kan inte skicka e-post än. Be den som driver HomeFlow att stänga av ”Confirm email” i Supabase.',
    'too-many-attempts': 'För många försök. Vänta några minuter och försök igen.',
    'unknown-child-code': 'Koden fungerar inte. Be en vuxen i familjen om en ny kod.',
    other: 'Det gick inte. Försök igen om en stund.',
  },
  childCode: {
    open: 'Logga in med en barnkod',
    heading: 'Logga in med en barnkod',
    label: 'Inloggningskod',
    invalid: 'Skriv den 8 tecken långa koden.',
    submit: 'Logga in',
    back: 'Logga in med e-post',
  },
  yourName: 'Ditt namn',
  enterName: 'Skriv ditt namn.',
  nameNotSaved: 'Det gick inte att spara namnet. Försök igen.',
};
