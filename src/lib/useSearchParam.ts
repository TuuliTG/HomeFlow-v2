import { useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * A choice kept in the address as `?<name>=<value>`, so it survives a reload; `null` leaves it out.
 * Local state keeps the control from flickering while the router updates the address, and follows the
 * address when it changes otherwise (the nav link, back and forward).
 */
export function useSearchParam<T>(
  name: string,
  parse: (value: string | null) => T,
  serialise: (value: T) => string | null,
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const inAddress = searchParams.get(name);
  const [value, setValue] = useState(() => parse(inAddress));
  const [seenInAddress, setSeenInAddress] = useState(inAddress);
  if (inAddress !== seenInAddress) {
    setSeenInAddress(inAddress);
    setValue(parse(inAddress));
  }

  function set(next: T) {
    setValue(next);
    const serialised = serialise(next);
    setSearchParams(
      (params) => {
        if (serialised === null) params.delete(name);
        else params.set(name, serialised);
        return params;
      },
      { replace: true },
    );
  }

  return [value, set];
}
