import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const browser = vi.hoisted(() => ({
  pushSupport: vi.fn(),
  permission: vi.fn(),
  getDeviceSubscription: vi.fn(),
  subscribeDevice: vi.fn(),
  unsubscribeDevice: vi.fn(),
}));
vi.mock('@/features/notifications/browserPush', () => browser);

const api = vi.hoisted(() => ({ saveSubscription: vi.fn(), deleteSubscription: vi.fn() }));
vi.mock('@/features/notifications/api', () => api);

const VAPID_KEY = `B${'a'.repeat(86)}`;
const device = { endpoint: 'https://push.example.com/anna', p256dh: 'key', auth: 'secret' };

function settings() {
  return screen.findByRole('region', { name: 'Notifications' });
}

describe('notification settings', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID_KEY);
    browser.pushSupport.mockReturnValue('supported');
    browser.permission.mockReturnValue('default');
    browser.getDeviceSubscription.mockResolvedValue(null);
    browser.subscribeDevice.mockResolvedValue(device);
    browser.unsubscribeDevice.mockResolvedValue(device.endpoint);
    api.saveSubscription.mockResolvedValue(undefined);
    api.deleteSubscription.mockResolvedValue(undefined);
    logInAsFamilyMember();
  });

  it('turns notifications on from a tap and saves this device', async () => {
    const user = userEvent.setup();
    renderAppAt('/me');

    await user.click(await screen.findByRole('button', { name: 'Turn on notifications' }));

    expect(browser.subscribeDevice).toHaveBeenCalledWith(VAPID_KEY);
    expect(api.saveSubscription).toHaveBeenCalledWith(device);
    expect(
      await screen.findByRole('button', { name: 'Turn off notifications' }),
    ).toBeInTheDocument();
  });

  it('turns notifications off and forgets this device', async () => {
    const user = userEvent.setup();
    browser.getDeviceSubscription.mockResolvedValue(device);
    renderAppAt('/me');

    await user.click(await screen.findByRole('button', { name: 'Turn off notifications' }));

    expect(api.deleteSubscription).toHaveBeenCalledWith(device.endpoint);
    expect(
      await screen.findByRole('button', { name: 'Turn on notifications' }),
    ).toBeInTheDocument();
  });

  it('explains how to unblock notifications when the user says no', async () => {
    const user = userEvent.setup();
    browser.subscribeDevice.mockResolvedValue(null);
    renderAppAt('/me');

    await user.click(await screen.findByRole('button', { name: 'Turn on notifications' }));

    expect(await settings()).toHaveTextContent('Notifications are blocked for HomeFlow.');
    expect(api.saveSubscription).not.toHaveBeenCalled();
  });

  it('explains when notifications are already blocked', async () => {
    browser.permission.mockReturnValue('denied');
    renderAppAt('/me');

    const region = await settings();
    expect(await within(region).findByText(/Notifications are blocked/)).toBeInTheDocument();
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains when turning notifications on fails', async () => {
    const user = userEvent.setup();
    api.saveSubscription.mockRejectedValue(new Error('Network error'));
    renderAppAt('/me');

    await user.click(await screen.findByRole('button', { name: 'Turn on notifications' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change notifications.");
  });

  it('tells iPhone users to add HomeFlow to the Home Screen first', async () => {
    browser.pushSupport.mockReturnValue('needs-home-screen');
    renderAppAt('/me');

    expect(await settings()).toHaveTextContent('Add to Home Screen');
    expect(screen.queryByRole('button', { name: /notifications/ })).not.toBeInTheDocument();
  });

  it('says so when the browser has no push support', async () => {
    browser.pushSupport.mockReturnValue('unsupported');
    renderAppAt('/me');

    expect(await settings()).toHaveTextContent("This browser can't show notifications");
  });

  it('is hidden until push notifications are set up for the app', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    renderAppAt('/me');

    await screen.findByRole('heading', { level: 1, name: 'My tasks' });
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('stops notifications on this device when the user logs out', async () => {
    const user = userEvent.setup();
    renderAppAt('/me');

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    await screen.findByRole('heading', { level: 1, name: 'Log in to HomeFlow' });
    expect(browser.unsubscribeDevice).toHaveBeenCalled();
    expect(api.deleteSubscription).toHaveBeenCalledWith(device.endpoint);
  });

  it('still logs out when stopping notifications fails', async () => {
    const user = userEvent.setup();
    browser.unsubscribeDevice.mockRejectedValue(new Error('No service worker'));
    renderAppAt('/me');

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
  });
});
