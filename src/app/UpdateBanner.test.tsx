import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function newVersionWaiting() {
  const updateServiceWorker = vi.fn(() => Promise.resolve());
  const registration = {
    waiting: {} as ServiceWorker | null,
    update: () => Promise.reject(new Error('offline')),
  } as ServiceWorkerRegistration;
  let registered = false;
  vi.mocked(useRegisterSW).mockImplementation((options) => {
    if (!registered) {
      registered = true;
      options?.onRegisteredSW?.('/sw.js', registration);
    }
    return {
      needRefresh: [true, () => undefined],
      offlineReady: [false, () => undefined],
      updateServiceWorker,
    };
  });
  return updateServiceWorker;
}

describe('Update banner', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('is not shown while HomeFlow is up to date', async () => {
    logInAsFamilyMember();
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Shared tasks' });
    expect(screen.queryByText('A new version of HomeFlow is available.')).not.toBeInTheDocument();
  });

  it('reloads once the new version has taken over', async () => {
    const user = userEvent.setup();
    const serviceWorker = new EventTarget();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
    const updateServiceWorker = newVersionWaiting();
    logInAsFamilyMember();
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Shared tasks' });
    expect(screen.getByText('A new version of HomeFlow is available.')).toBeInTheDocument();
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateServiceWorker).toHaveBeenCalledOnce();
    serviceWorker.dispatchEvent(new Event('controllerchange'));

    expect(reload).toHaveBeenCalledOnce();
  });

  it('can be put off until later', async () => {
    const user = userEvent.setup();
    newVersionWaiting();
    logInAsFamilyMember();
    renderAppAt('/');

    await user.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(screen.queryByText('A new version of HomeFlow is available.')).not.toBeInTheDocument();
  });

  it('is shown on the login screen too', async () => {
    newVersionWaiting();
    renderAppAt('/login');

    expect(await screen.findByText('A new version of HomeFlow is available.')).toBeInTheDocument();
  });
});
