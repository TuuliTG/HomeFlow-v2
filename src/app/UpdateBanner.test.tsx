import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { describe, expect, it, vi } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function newVersionWaiting() {
  const updateServiceWorker = vi.fn(() => Promise.resolve());
  vi.mocked(useRegisterSW).mockReturnValue({
    needRefresh: [true, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker,
  });
  return updateServiceWorker;
}

describe('Update banner', () => {
  it('is not shown while HomeFlow is up to date', async () => {
    logInAsFamilyMember();
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Shared tasks' });
    expect(screen.queryByText('A new version of HomeFlow is available.')).not.toBeInTheDocument();
  });

  it('reloads into the new version when asked', async () => {
    const user = userEvent.setup();
    const updateServiceWorker = newVersionWaiting();
    logInAsFamilyMember();
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Shared tasks' });
    expect(screen.getByText('A new version of HomeFlow is available.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));

    expect(updateServiceWorker).toHaveBeenCalledOnce();
  });

  it('is shown on the login screen too', async () => {
    newVersionWaiting();
    renderAppAt('/login');

    expect(await screen.findByText('A new version of HomeFlow is available.')).toBeInTheDocument();
  });
});
