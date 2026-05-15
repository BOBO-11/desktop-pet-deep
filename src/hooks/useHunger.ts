import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'pet-hunger';
const HUNGER_DECAY_INTERVAL = 60000;
const HUNGER_MAX = 100;
const HUNGRY_THRESHOLD = 10;

function loadHunger(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (
        saved &&
        typeof saved.hunger === 'number' &&
        typeof saved.timestamp === 'number'
      ) {
        const elapsedMinutes = Math.floor((Date.now() - saved.timestamp) / 60000);
        if (elapsedMinutes > 0) {
          return Math.max(0, saved.hunger - elapsedMinutes);
        }
        return Math.min(HUNGER_MAX, Math.max(0, saved.hunger));
      }
    }
  } catch {
    // localStorage unavailable or corrupted
  }
  return HUNGER_MAX;
}

function saveHunger(hunger: number) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hunger, timestamp: Date.now() })
    );
  } catch {
    // localStorage unavailable
  }
}

export function useHunger() {
  const [hunger, setHunger] = useState(loadHunger);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const feed = useCallback((amount: number = HUNGER_MAX) => {
    setHunger((prev) => Math.min(HUNGER_MAX, prev + amount));
  }, []);

  useEffect(() => {
    saveHunger(hunger);
  }, [hunger]);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setHunger((prev) => Math.max(0, prev - 1));
    }, HUNGER_DECAY_INTERVAL);

    return clearTimer;
  }, [clearTimer]);

  return {
    hunger,
    hungerPercent: (hunger / HUNGER_MAX) * 100,
    isHungry: hunger < HUNGRY_THRESHOLD,
    feed
  };
}
