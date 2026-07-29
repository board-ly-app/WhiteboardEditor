import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import lodash from 'lodash';

interface UseNumericAttributeInputOptions {
  /** Attribute value from the store (server-synced). */
  value: unknown;
  /** Display string when value is nullish. */
  fallback?: string;
  /** Commits a parsed value to the store and the server. */
  commit: (parsed: number) => void;
  /** Smallest committable value; out-of-range input is displayed but not committed. */
  min?: number;
  debounceMs?: number;
}

interface UseNumericAttributeInput {
  inputValue: string;
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: (ev: React.FocusEvent<HTMLInputElement>) => void;
  onBlur: (ev: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * Local state for a numeric attribute input backed by server-synced store
 * state.
 *
 * The input updates instantly on every change, while commits are debounced so
 * a burst of edits sends a single update carrying the final value. While the
 * input is focused, incoming store values are ignored so that stale server
 * echoes of in-flight edits cannot overwrite what the user is typing; the
 * input resyncs with the store once editing ends.
 */
export function useNumericAttributeInput({
  value,
  fallback = '',
  commit,
  min,
  debounceMs = 250,
}: UseNumericAttributeInputOptions): UseNumericAttributeInput {
  const [inputValue, setInputValue] = useState(value?.toString() ?? fallback);
  const editingRef = useRef(false);

  const latestCommit = useRef(commit);
  latestCommit.current = commit;

  const debouncedCommit = useRef(
    lodash.debounce(
      (parsed: number) => latestCommit.current(parsed),
      debounceMs
    )
  ).current;

  // -- commit any pending edit rather than dropping it on unmount
  useEffect(() => () => debouncedCommit.flush(), [debouncedCommit]);

  useEffect(() => {
    if (! editingRef.current) {
      setInputValue(value?.toString() ?? fallback);
    }
  }, [value, fallback]);

  const isCommittable = useCallback(
    (parsed: number) => !isNaN(parsed) && (min === undefined || parsed >= min),
    [min]
  );

  const onChange = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.preventDefault();

      editingRef.current = true;

      const val = ev.target.value;
      setInputValue(val);

      const parsed = parseFloat(val);

      if (isCommittable(parsed)) {
        debouncedCommit(parsed);
      }
    },
    [debouncedCommit, isCommittable]
  );

  const onFocus = useCallback(() => {
    editingRef.current = true;
  }, []);

  const onBlur = useCallback(() => {
    editingRef.current = false;
    debouncedCommit.flush();

    // -- leftover uncommittable text resyncs with the last committed value
    if (! isCommittable(parseFloat(inputValue))) {
      setInputValue(value?.toString() ?? fallback);
    }
  }, [debouncedCommit, isCommittable, inputValue, value, fallback]);

  return {
    inputValue,
    onChange,
    onFocus,
    onBlur,
  };
}
