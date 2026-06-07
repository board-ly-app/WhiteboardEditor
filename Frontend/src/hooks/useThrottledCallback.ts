import { useRef, useEffect } from 'react';
import lodash from 'lodash';

export function useThrottledCallback<TArgs extends unknown[], TReturn>(
  callback: (...args: TArgs) => TReturn,
  interval: number
): (...args: TArgs) => TReturn {
  const latestCallback = useRef(callback);
  latestCallback.current = callback;

  const throttledFn = useRef(
    lodash.throttle(
      (...args: TArgs) => {
        latestCallback.current(...args);
      },
      interval,
      { leading: true, trailing: true }
    )
  ).current;

  useEffect(() => () => throttledFn.cancel(), [throttledFn]);

  return throttledFn as unknown as (...args: TArgs) => TReturn;
}
