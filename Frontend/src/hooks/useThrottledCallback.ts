import { useRef, useEffect } from 'react';
import lodash from 'lodash';

export const THROTTLE_INTERVAL = 100; // ms between updates

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  interval: number
): T {
  const latestCallback = useRef(callback);
  latestCallback.current = callback;

  const throttledFn = useRef(
    lodash.throttle(
      (...args: Parameters<T>) => {
        latestCallback.current(...args);
      }, 
      interval,
      { leading: true, trailing: true }
    )
  ).current;

  useEffect(() => () => throttledFn.cancel(), [throttledFn]);

  return throttledFn as unknown as T;
}
