import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const browser = vi.hoisted(() => ({
  pushSupport: vi.fn(),
  permission: vi.fn(),
  requestPermission: vi.fn(),
  getDeviceSubscription: vi.fn(),
  getDeviceEndpoint: vi.fn(),
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

function toggle(name: 'Turn on notifications' | 'Turn off notifications') {
  return screen.findByRole('button', { name });
}

describe('notification settings', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID_KEY);
    browser.pushSupport.mockReturnValue('supported');
    browser.permission.mockReturnValue('default');
    browser.requestPermission.mockResolvedValue('granted');
    browser.getDeviceSubscription.mockResolvedValue(null);
    browser.getDeviceEndpoint.mockResolvedValue(device.endpoint);
    browser.subscribeDevice.mockResolvedValue(device);
    browser.unsubscribeDevice.mockResolvedValue(undefined);
    api.saveSubscription.mockResolvedValue(undefined);
    api.deleteSubscription.mockResolvedValue(undefined);
    logInAsFamilyMember();
  });

  it('asks permission in the tap, then subscribes and saves this device', async () => {
    const user = userEvent.setup();
    renderAppAt('/me');

    const button = await toggle('Turn on notifications');
    await user.click(button);

    expect(browser.requestPermission).toHaveBeenCalled();
    expect(browser.subscribeDevice).toHaveBeenCalledWith(VAPID_KEY);
    expect(api.saveSubscription).toHaveBeenCalledWith(device);
    expect(await toggle('Turn off notifications')).toBe(button);
    expect(button).toHaveFocus();
  });

  it('turns notifications off: forgets this device, then unsubscribes it', async () => {
    const user = userEvent.setup();
    browser.getDeviceSubscription.mockResolvedValue(device);
    renderAppAt('/me');

    await user.click(await toggle('Turn off notifications'));

    expect(api.deleteSubscription).toHaveBeenCalledWith(device.endpoint);
    expect(browser.unsubscribeDevice).toHaveBeenCalled();
    expect(await toggle('Turn on notifications')).toBeInTheDocument();
  });

  it('re-saves an existing subscription on load, so it belongs to the current user', async () => {
    browser.getDeviceSubscription.mockResolvedValue(device);
    renderAppAt('/me');

    expect(await toggle('Turn off notifications')).toBeInTheDocument();
    expect(browser.getDeviceSubscription).toHaveBeenCalledWith(VAPID_KEY);
    expect(api.saveSubscription).toHaveBeenCalledWith(device);
  });

  it('keeps offering to turn on when the user dismisses the prompt', async () => {
    const user = userEvent.setup();
    browser.requestPermission.mockResolvedValue('default');
    renderAppAt('/me');

    await user.click(await toggle('Turn on notifications'));

    expect(browser.subscribeDevice).not.toHaveBeenCalled();
    expect(await toggle('Turn on notifications')).toBeInTheDocument();
  });

  it('explains how to unblock notifications when they are denied', async () => {
    const user = userEvent.setup();
    browser.requestPermission.mockImplementation(() => {
      browser.permission.mockReturnValue('denied');
      return Promise.resolve('denied');
    });
    renderAppAt('/me');

    await user.click(await toggle('Turn on notifications'));

    const region = await settings();
    expect(await within(region).findByText(/Notifications are blocked/)).toBeInTheDocument();
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    expect(api.saveSubscription).not.toHaveBeenCalled();
  });

  it('unsubscribes again when the device cannot be saved', async () => {
    const user = userEvent.setup();
    api.saveSubscription.mockRejectedValue(new Error('Network error'));
    renderAppAt('/me');

    await user.click(await toggle('Turn on notifications'));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change notifications.");
    expect(browser.unsubscribeDevice).toHaveBeenCalled();
    expect(await toggle('Turn on notifications')).toBeInTheDocument();
  });

  it('explains when turning off fails, and clears the error after a later success', async () => {
    const user = userEvent.setup();
    browser.getDeviceSubscription.mockResolvedValue(device);
    api.deleteSubscription.mockRejectedValueOnce(new Error('Network error'));
    renderAppAt('/me');

    await user.click(await toggle('Turn off notifications'));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change notifications.");
    expect(browser.unsubscribeDevice).not.toHaveBeenCalled();

    await user.click(await toggle('Turn off notifications'));
    expect(await toggle('Turn on notifications')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores taps while a change is in progress', async () => {
    const user = userEvent.setup();
    let finishSaving = () => undefined as unknown;
    api.saveSubscription.mockReturnValue(
      new Promise<void>((resolve) => {
        finishSaving = resolve;
      }),
    );
    renderAppAt('/me');

    const button = await toggle('Turn on notifications');
    await user.click(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    await act(async () => {
      finishSaving();
      await Promise.resolve();
    });

    expect(browser.subscribeDevice).toHaveBeenCalledOnce();
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
    expect(api.deleteSubscription).toHaveBeenCalledWith(device.endpoint);
    expect(browser.unsubscribeDevice).toHaveBeenCalled();
  });

  it('still unsubscribes and logs out when forgetting the device fails', async () => {
    const user = userEvent.setup();
    api.deleteSubscription.mockRejectedValue(new Error('Network error'));
    renderAppAt('/me');

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
    expect(browser.unsubscribeDevice).toHaveBeenCalled();
  });
});
