import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as requestsApi from '@/features/tasks/requestsApi';

const client = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => client }));

// setup.ts replaces the requests api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof requestsApi>('@/features/tasks/requestsApi');
const failure = { message: 'boom' };

describe('requests api', () => {
  beforeEach(() => {
    client.rpc.mockReset();
  });

  it.each([
    {
      action: 'asks a member to do a task',
      call: () => api.requestTask('t1', 'u2'),
      rpc: ['request_task', { task_id: 't1', member_id: 'u2' }],
    },
    {
      action: 'accepts a request',
      call: () => api.answerTaskRequest('t1', true),
      rpc: ['answer_task_request', { task_id: 't1', accept: true }],
    },
    {
      action: 'declines a request',
      call: () => api.answerTaskRequest('t1', false),
      rpc: ['answer_task_request', { task_id: 't1', accept: false }],
    },
    {
      action: 'cancels a request',
      call: () => api.cancelTaskRequest('t1'),
      rpc: ['cancel_task_request', { task_id: 't1' }],
    },
  ])('$action and passes errors on', async ({ call, rpc }) => {
    client.rpc.mockResolvedValueOnce({ data: null, error: null });
    await call();
    expect(client.rpc).toHaveBeenCalledWith(...rpc);

    client.rpc.mockResolvedValueOnce({ data: null, error: failure });
    await expect(call()).rejects.toBe(failure);
  });
});
