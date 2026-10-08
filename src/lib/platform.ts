/** Device checks shared by features that behave differently on iPhone and in Home Screen apps. */

/** iPhone, iPad or iPod; iPadOS Safari reports itself as a Mac, but touch support gives it away. */
export function isIos(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  return (
    /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1)
  );
}

/** Whether HomeFlow runs as an installed app (from the Home Screen) rather than in a browser tab. */
export function isHomeScreenApp(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}
