/** Logging in, creating an account and choosing a display name. */
export const auth = {
  hello: (name: string) => `Hello, ${name}`,
  loggedInAs: (email: string) => `Logged in as ${email}`,
  welcomeTitle: 'Welcome to HomeFlow',
  welcomeDescription: 'What should we call you?',
  logInTitle: 'Log in to HomeFlow',
  logInDescription: 'Share household tasks fairly with your family.',
  logIn: {
    heading: 'Log in',
    submit: 'Log in',
    switchPrompt: 'New to HomeFlow?',
    switchLabel: 'Create an account',
  },
  createAccount: {
    heading: 'Create your account',
    submit: 'Create account',
    switchPrompt: 'Already have an account?',
    switchLabel: 'Log in instead',
  },
  email: 'Email',
  password: 'Password',
  passwordHint: (minLength: number) => `At least ${String(minLength)} characters.`,
  invalidEmail: 'Enter a valid email address.',
  shortPassword: (minLength: number) =>
    `Use at least ${String(minLength)} characters for your password.`,
  failures: {
    'wrong-credentials': 'Wrong email or password.',
    'account-exists': 'There is already an account with this email. Log in instead.',
    'weak-password': (minLength: number) =>
      `Choose a stronger password (at least ${String(minLength)} characters).`,
    'needs-email-confirmation':
      'HomeFlow is set up to confirm emails, which it can’t send yet. Ask the person who runs HomeFlow to turn off “Confirm email” in Supabase.',
    'too-many-attempts': 'Too many attempts. Wait a few minutes and try again.',
    'unknown-child-code': "This code doesn't work. Ask an adult in your family for a new one.",
    other: "That didn't work. Try again in a moment.",
  },
  childCode: {
    open: 'Sign in with a child code',
    heading: 'Sign in with a child code',
    label: 'Sign-in code',
    invalid: 'Enter the 8-character code.',
    submit: 'Sign in',
    back: 'Log in with email instead',
  },
  yourName: 'Your name',
  enterName: 'Enter your name.',
  nameNotSaved: "We couldn't save your name. Try again.",
};
