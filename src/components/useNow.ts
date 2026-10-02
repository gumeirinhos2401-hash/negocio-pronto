import { useState } from 'react';

// The current date, read once when the page opens so every render of it agrees.
export function useNow(): Date {
  const [now] = useState(() => new Date());
  return now;
}
