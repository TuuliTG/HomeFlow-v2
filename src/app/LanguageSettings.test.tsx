import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

describe('language', () => {
  beforeEach(() => {
    logInAsFamilyMember();
  });

  afterEach(() => {
    document.documentElement.lang = 'en';
  });

  it('is English when the browser prefers a language HomeFlow does not speak', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['sv-SE']);
    renderAppAt('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shared tasks' }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it("follows the browser's language", async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fi-FI', 'en']);
    renderAppAt('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Yhteiset tehtävät' }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fi');
  });

  it('can be changed on the Me page, and is remembered on this device', async () => {
    const user = userEvent.setup();
    const { unmount } = renderAppAt('/me');

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Language of HomeFlow' }),
      'Suomi',
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Omat tehtävät' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tilastot' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fi');

    unmount();
    renderAppAt('/me');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Omat tehtävät' }),
    ).toBeInTheDocument();
  });
});
