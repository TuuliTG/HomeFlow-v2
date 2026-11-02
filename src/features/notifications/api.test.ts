import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteSubscription,
  fetchPreferences,
  savePreference,
  saveSubscription,
} from '@/features/notifications/api';

const supabase = vi.hoisted(() => {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
  };
  return { query, client: { rpc: vi.fn(), from: vi.fn(() => query) } };
});
const getSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabaseClient }));

const { client, query } = supabase;
const failure = { message: 'boom' };
const device = { endpoint: 'https://push.example.com/a', p256dh: 'key', auth: 'secret' };

describe('notifications api', () => {
  beforeEach(() => {
    getSupabaseClient.mockReturnValue(client);
    query.delete.mockReturnValue(query);
    query.select.mockReturnValue(query);
  });

  it('saves the device through the database function', async () => {
    client.rpc.mockResolvedValue({ error: null });

    await saveSubscription(device);

    expect(client.rpc).toHaveBeenCalledWith('save_push_subscription', {
      push_endpoint: device.endpoint,
      push_p256dh: 'key',
      push_auth: 'secret',
    });
  });

  it('forgets a device by its endpoint', async () => {
    query.eq.mockResolvedValue({ error: null });

    await deleteSubscription(device.endpoint);

    expect(client.from).toHaveBeenCalledWith('push_subscriptions');
    expect(query.eq).toHaveBeenCalledWith('endpoint', device.endpoint);
  });

  it('reads which kinds of notification the user gets', async () => {
    query.maybeSingle.mockResolvedValue({
      data: {
        task_added: true,
        task_completed: false,
        task_requested: true,
        request_answered: false,
        reminder: true,
      },
      error: null,
    });

    await expect(fetchPreferences()).resolves.toEqual({
      taskAdded: true,
      taskCompleted: false,
      taskRequested: true,
      requestAnswered: false,
      reminder: true,
    });
    expect(client.from).toHaveBeenCalledWith('notification_preferences');
  });

  it('gives every kind to a user who never chose', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(fetchPreferences()).resolves.toEqual({
      taskAdded: true,
      taskCompleted: true,
      taskRequested: true,
      requestAnswered: true,
      reminder: true,
    });
  });

  it('rejects preferences of an unexpected shape', async () => {
    query.maybeSingle.mockResolvedValue({ data: { task_added: 'yes' }, error: null });

    await expect(fetchPreferences()).rejects.toThrow();
  });

  it('saves one kind, keeping the others', async () => {
    query.upsert.mockResolvedValue({ error: null });

    await savePreference('anna', 'taskCompleted', false);

    expect(query.upsert).toHaveBeenCalledWith({
      user_id: 'anna',
      task_completed: false,
      updated_at: expect.any(String) as string,
    });
  });

  it('passes errors on', async () => {
    client.rpc.mockResolvedValue({ error: failure });
    query.eq.mockResolvedValue({ error: failure });
    query.maybeSingle.mockResolvedValue({ data: null, error: failure });
    query.upsert.mockResolvedValue({ error: failure });

    await expect(saveSubscription(device)).rejects.toBe(failure);
    await expect(deleteSubscription(device.endpoint)).rejects.toBe(failure);
    await expect(fetchPreferences()).rejects.toBe(failure);
    await expect(savePreference('anna', 'reminder', false)).rejects.toBe(failure);
  });
});
