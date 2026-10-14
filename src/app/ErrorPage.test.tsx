import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ErrorPage } from '@/app/ErrorPage';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { storeLanguage } from '@/lib/i18n/storedLanguage';
import { reportError } from '@/lib/monitoring';

vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn(() => Promise.resolve()) }));

const crash = new Error('boom');

function Crashing(): never {
  throw crash;
}

function renderCrashingPage() {
  const router = createMemoryRouter([
    {
      element: (
        <LanguageProvider>
          <Outlet />
        </LanguageProvider>
      ),
      children: [{ path: '/', element: <Crashing />, errorElement: <ErrorPage /> }],
    },
  ]);
  render(<RouterProvider router={router} />);
}

describe('ErrorPage', () => {
  it('reports the crash and offers to reload, in the chosen language', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storeLanguage('fi');
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const user = userEvent.setup();

    renderCrashingPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Jotain meni pieleen' }),
    ).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith(crash);

    await user.click(screen.getByRole('button', { name: 'Lataa uudelleen' }));
    expect(reload).toHaveBeenCalled();
  });
});
