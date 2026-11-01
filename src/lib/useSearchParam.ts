import { useState } from 'react';
import { useSearchParams } from 'react-router';

interface SearchParamOptions<T> {
  name: string;
  parse: (value: string | null) => T;
  serialise: (value: T) => string | null;
  /** Also remember the choice on this device under this key; include the user's id. */
  rememberAs?: string;
}

/**
 * A choice kept in the address as `?<name>=<value>`, so it survives a reload; `null` leaves it out.
 * Local state keeps the control from flickering while the router updates the address, and follows the
 * address when it changes otherwise (the nav link, back and forward).
 *
 * With `rememberAs`, the choice is also remembered on this device and used whenever the address doesn't name
 * one, so it is still there after leaving the page (e.g. through the nav). Family members may share a device,
 * so the key includes the user's id.
 */
export function useSearchParam<T>({
  name,
  parse,
  serialise,
  rememberAs,
}: SearchParamOptions<T>): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const inAddress = searchParams.get(name);
  const read = (address: string | null) =>
    parse(address ?? (rememberAs === undefined ? null : rememberedChoice(rememberAs)));
  const [value, setValue] = useState(() => read(inAddress));
  const [seenInAddress, setSeenInAddress] = useState(inAddress);
  if (inAddress !== seenInAddress) {
    setSeenInAddress(inAddress);
    setValue(read(inAddress));
  }

  function set(next: T) {
    setValue(next);
    const serialised = serialise(next);
    if (rememberAs !== undefined) rememberChoice(rememberAs, serialised);
    if (pendingChanges === null) {
      pendingChanges = new Map();
      queueMicrotask(() => {
        pendingChanges = null;
      });
    }
    const changes = pendingChanges.set(name, serialised);
    setSearchParams(
      (params) => {
        for (const [changed, value] of changes) {
          if (value === null) params.delete(changed);
          else params.set(changed, value);
        }
        return params;
      },
      { replace: true },
    );
  }

  return [value, set];
}

/**
 * Choices changed together, e.g. one that clears another: each `setSearchParams` starts from the address as
 * last rendered, so the later ones repeat the earlier changes rather than undo them.
 */
let pendingChanges: Map<string, string | null> | null = null;

const storageKey = (key: string) => `homeflow:choice:${key}`;

function rememberedChoice(key: string): string | null {
  try {
    return localStorage.getItem(storageKey(key));
  } catch {
    // Storage can be unavailable (e.g. private browsing); the default applies.
    return null;
  }
}

function rememberChoice(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(storageKey(key));
    else localStorage.setItem(storageKey(key), value);
  } catch {
    // Nothing to do: the choice still holds in the address.
  }
}
