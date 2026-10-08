import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1';
const IPAD_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36';

function useBrowser(userAgent: string, { homeScreen = false, maxTouchPoints = 5 } = {}) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  // jsdom's navigator has no maxTouchPoints to spy on.
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints });
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: homeScreen } as MediaQueryList);
}

function hint() {
  return screen.queryByRole('complementary', { name: 'Add HomeFlow to your Home Screen' });
}

describe('Add to Home Screen hint', () => {
  beforeEach(() => {
    logInAsFamilyMember();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'maxTouchPoints');
  });

  it.each([
    ['iPhone', IPHONE_SAFARI],
    ['iPad', IPAD_SAFARI],
  ])('tells %s users in the browser how to add HomeFlow', async (_device, userAgent) => {
    useBrowser(userAgent);
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Available tasks' });
    expect(hint()).toHaveTextContent('Tap Share, then Add to Home Screen');
  });

  it('is not shown once HomeFlow runs from the Home Screen', async () => {
    useBrowser(IPHONE_SAFARI, { homeScreen: true });
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Available tasks' });
    expect(hint()).not.toBeInTheDocument();
  });

  it('is not shown in an iPhone Home Screen app that only reports navigator.standalone', async () => {
    useBrowser(IPHONE_SAFARI);
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Available tasks' });
    expect(hint()).not.toBeInTheDocument();
    Reflect.deleteProperty(navigator, 'standalone');
  });

  it.each([
    ['Android', ANDROID_CHROME, 5],
    ['a Mac', IPAD_SAFARI, 0],
  ])('is not shown on %s', async (_device, userAgent, maxTouchPoints) => {
    useBrowser(userAgent, { maxTouchPoints });
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Available tasks' });
    expect(hint()).not.toBeInTheDocument();
  });

  it('stays dismissed after "Got it"', async () => {
    const user = userEvent.setup();
    useBrowser(IPHONE_SAFARI);
    const { unmount } = renderAppAt('/');

    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    expect(hint()).not.toBeInTheDocument();
    unmount();
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Available tasks' });
    expect(hint()).not.toBeInTheDocument();
  });

  it('still closes when the browser blocks storage', async () => {
    const user = userEvent.setup();
    useBrowser(IPHONE_SAFARI);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    renderAppAt('/');

    await user.click(await screen.findByRole('button', { name: 'Got it' }));

    expect(hint()).not.toBeInTheDocument();
  });
});
