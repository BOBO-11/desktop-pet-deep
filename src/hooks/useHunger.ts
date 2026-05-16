import { useCallback, useEffect, useRef, useState } from 'react';
import { HUNGER_RULES } from '../config/petRules';
import { STORAGE_KEYS } from '../config/storageKeys';
import { readJson, writeJson } from '../utils/storage';

type StoredHunger = {
  hunger: number;
  timestamp: number;
};

function loadHunger(): number {
  const saved = readJson<StoredHunger>(
    STORAGE_KEYS.hunger,
    { hunger: HUNGER_RULES.max, timestamp: Date.now() },
    (value): value is StoredHunger =>
      Boolean(
        value &&
          typeof value === 'object' &&
          typeof (value as StoredHunger).hunger === 'number' &&
          typeof (value as StoredHunger).timestamp === 'number'
      )
  );

  const elapsedIntervals = Math.floor((Date.now() - saved.timestamp) / HUNGER_RULES.decayIntervalMs);
  if (elapsedIntervals > 0) {
    return Math.max(0, saved.hunger - elapsedIntervals * HUNGER_RULES.decayPerInterval);
  }

  return Math.min(HUNGER_RULES.max, Math.max(0, saved.hunger));
}

function saveHunger(hunger: number) {
  writeJson(STORAGE_KEYS.hunger, { hunger, timestamp: Date.now() });
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

  const feed = useCallback((amount: number = HUNGER_RULES.max) => {
    setHunger((prev) => Math.min(HUNGER_RULES.max, prev + amount));
  }, []);

  useEffect(() => {
    saveHunger(hunger);
  }, [hunger]);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setHunger((prev) => Math.max(0, prev - HUNGER_RULES.decayPerInterval));
    }, HUNGER_RULES.decayIntervalMs);

    return clearTimer;
  }, [clearTimer]);

  return {
    hunger,
    hungerPercent: (hunger / HUNGER_RULES.max) * 100,
    isHungry: hunger < HUNGER_RULES.hungryThreshold,
    feed
  };
}
