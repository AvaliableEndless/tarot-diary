import { useEffect, useState } from 'react';

const KEY = 'shinian-motion-v1';
const options = ['system', 'full', 'gentle'];

export function useMotionPreference() {
  const [preference, setPreference] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return options.includes(saved) ? saved : 'system';
    } catch {
      return 'system';
    }
  });
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const update = (value) => {
    if (!options.includes(value)) return false;
    setPreference(value);
    try {
      localStorage.setItem(KEY, value);
      return true;
    } catch {
      return false;
    }
  };
  return {
    preference,
    systemReduced,
    mode: preference === 'system' ? (systemReduced ? 'gentle' : 'full') : preference,
    setPreference: update,
  };
}
