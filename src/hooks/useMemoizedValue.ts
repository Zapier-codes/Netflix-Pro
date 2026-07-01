// src/hooks/useMemoizedValue.ts
import { useRef, useMemo } from 'react';

export function useMemoizedValue<T>(value: T, comparator?: (prev: T, next: T) => boolean): T {
  const ref = useRef<T>(value);

  useMemo(() => {
    if (comparator) {
      if (!comparator(ref.current, value)) {
        ref.current = value;
      }
    } else if (ref.current !== value) {
      ref.current = value;
    }
  }, [value, comparator]);

  return ref.current;
}
