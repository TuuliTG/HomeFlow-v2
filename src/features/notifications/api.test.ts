import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteSubscription, saveSubscription } from '@/features/notifications/api';

const supabase = vi.hoisted(() => {
  const query = { delete: vi.fn(), eq: vi.fn() };
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

  it('passes errors on', async () => {
    client.rpc.mockResolvedValue({ error: failure });
    query.eq.mockResolvedValue({ error: failure });

    await expect(saveSubscription(device)).rejects.toBe(failure);
    await expect(deleteSubscription(device.endpoint)).rejects.toBe(failure);
  });
});
