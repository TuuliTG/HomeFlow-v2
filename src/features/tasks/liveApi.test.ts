import { describe, expect, it, vi } from 'vitest';

import type * as liveApi from '@/features/tasks/liveApi';

const supabase = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  return {
    channel,
    client: { channel: vi.fn(() => channel), removeChannel: vi.fn() },
  };
});

vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => supabase.client }));

// setup.ts replaces this api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof liveApi>('@/features/tasks/liveApi');
const { client, channel } = supabase;
/** A task row as Realtime sends it; only some of its columns matter here. */
const row = { id: 't1', title: 'Vacuum', type: 'physical', points: 3, created_by: 'u1' };

describe('live task updates', () => {
  it('delivers task changes in the household live, until unsubscribed', () => {
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const onChange = vi.fn();

    const unsubscribe = api.subscribeToTaskChanges(onChange);
    const [[event, inserts, onInsert], [, updates, onUpdate], [, deletes, onDelete]] = channel.on
      .mock.calls as [
      [string, unknown, (payload: { new: unknown }) => void],
      [string, unknown, () => void],
      [string, unknown, () => void],
    ];
    const inserted = { ...row, household_id: 'h1', created_at: '2026-10-08T04:00:00Z' };
    onInsert({ new: { ...inserted, previous_task_id: null } });
    onInsert({ new: { ...inserted, id: 't2', previous_task_id: 't1' } });
    onInsert({ new: { id: 't3' } });
    onUpdate();
    onDelete();
    unsubscribe();

    expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^household-tasks:/));
    expect(event).toBe('postgres_changes');
    expect(inserts).toEqual({ event: 'INSERT', schema: 'public', table: 'tasks' });
    expect(updates).toEqual({ event: 'UPDATE', schema: 'public', table: 'tasks' });
    expect(deletes).toEqual({ event: 'DELETE', schema: 'public', table: 'tasks' });
    expect(onChange.mock.calls).toEqual([
      [{ kind: 'added', id: 't1', title: 'Vacuum', createdBy: 'u1', isRepeat: false }],
      [{ kind: 'added', id: 't2', title: 'Vacuum', createdBy: 'u1', isRepeat: true }],
      [{ kind: 'changed' }],
      [{ kind: 'changed' }],
    ]);
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('warns when live updates cannot connect', () => {
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    api.subscribeToTaskChanges(vi.fn());
    const [[onStatus]] = channel.subscribe.mock.calls as [
      [(status: string, error?: Error) => void],
    ];
    onStatus('SUBSCRIBED');
    onStatus('CHANNEL_ERROR', new Error('boom'));

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Live task updates are unavailable',
      'CHANNEL_ERROR',
      new Error('boom'),
    );
  });
});
