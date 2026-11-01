import { z } from 'zod';

/** Router state saying a task added as already done was added but couldn't be marked done. */
export const notMarkedDoneState = { notMarkedDone: true } as const;

/** Whether the router state is `notMarkedDoneState`. */
export function isNotMarkedDoneState(state: unknown): boolean {
  return z.object({ notMarkedDone: z.literal(true) }).safeParse(state).success;
}
