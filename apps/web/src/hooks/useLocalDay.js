import { useEffect, useState } from 'react';
import { dateKey } from '../domain/dates.js';

export function useLocalDay() {
  const [today, setToday] = useState(dateKey);
  useEffect(() => {
    const update = () => setToday(dateKey());
    const timer = setInterval(update, 30_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
