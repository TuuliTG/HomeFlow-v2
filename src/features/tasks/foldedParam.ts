import { useSearchParam } from '@/lib/useSearchParam';

/**
 * Whether a section of tasks is folded away, kept in the address as `?<name>=hidden` and remembered on this
 * device, on the board and the Me page alike.
 */
export function useFoldedParam(name: string, userId: string) {
  return useSearchParam({
    name,
    parse: (value) => value === 'hidden',
    serialise: (hidden) => (hidden ? 'hidden' : null),
    rememberAs: `tasks.${name}:${userId}`,
  });
}
