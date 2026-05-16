import { useCallback, useEffect, useRef, useState } from 'react';
import { POINT_RULES } from '../config/petRules';
import { STORAGE_KEYS } from '../config/storageKeys';
import { getLocalDateKey } from '../utils/date';
import { readJson, readNumber, writeJson, writeNumber } from '../utils/storage';

type DailyPoints = {
  date: string;
  earned: number;
};

function loadPoints(): number {
  return readNumber(STORAGE_KEYS.points, 0);
}

function isDailyPoints(value: unknown): value is DailyPoints {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as DailyPoints).date === 'string' &&
      typeof (value as DailyPoints).earned === 'number'
  );
}

function loadDaily(): DailyPoints {
  return readJson<DailyPoints>(STORAGE_KEYS.dailyInteraction, { date: '', earned: 0 }, isDailyPoints);
}

function loadDailyWork(): DailyPoints {
  return readJson<DailyPoints>(STORAGE_KEYS.dailyWork, { date: '', earned: 0 }, isDailyPoints);
}

export function usePoints() {
  const [points, setPoints] = useState(loadPoints);
  const pointsRef = useRef(points);
  const lastEarnRef = useRef(0);
  const minutePointsRef = useRef(0);
  const minuteStartRef = useRef(Date.now());
  const dailyRef = useRef(loadDaily());
  const dailyWorkRef = useRef(loadDailyWork());

  useEffect(() => {
    pointsRef.current = points;
    writeNumber(STORAGE_KEYS.points, points);
  }, [points]);

  const tryEarnPoints = useCallback((): number => {
    const now = Date.now();
    const today = getLocalDateKey();

    if (dailyRef.current.date !== today) {
      dailyRef.current = { date: today, earned: 0 };
    }

    if (dailyRef.current.earned >= POINT_RULES.pointsPerDay) {
      return 0;
    }

    if (now - minuteStartRef.current >= 60000) {
      minuteStartRef.current = now;
      minutePointsRef.current = 0;
    }

    if (minutePointsRef.current >= POINT_RULES.pointsPerMinute) {
      return 0;
    }

    if (now - lastEarnRef.current < POINT_RULES.interactionCooldownMs) {
      return 0;
    }

    const earned = Math.min(
      Math.floor(
        Math.random() * (POINT_RULES.maxInteractionReward - POINT_RULES.minInteractionReward + 1)
      ) + POINT_RULES.minInteractionReward,
      POINT_RULES.pointsPerMinute - minutePointsRef.current,
      POINT_RULES.pointsPerDay - dailyRef.current.earned
    );

    lastEarnRef.current = now;
    minutePointsRef.current += earned;
    dailyRef.current.earned += earned;
    pointsRef.current += earned;
    setPoints(pointsRef.current);

    writeJson(STORAGE_KEYS.dailyInteraction, dailyRef.current);

    return earned;
  }, []);

  const spendPoints = useCallback((amount: number): boolean => {
    if (pointsRef.current < amount) {
      return false;
    }
    pointsRef.current -= amount;
    setPoints(pointsRef.current);
    return true;
  }, []);

  const addPoints = useCallback((amount: number): number => {
    const today = getLocalDateKey();

    if (dailyWorkRef.current.date !== today) {
      dailyWorkRef.current = { date: today, earned: 0 };
    }

    const actual = Math.min(amount, POINT_RULES.workPointsPerDay - dailyWorkRef.current.earned);
    if (actual <= 0) {
      return 0;
    }

    dailyWorkRef.current.earned += actual;
    pointsRef.current += actual;
    setPoints(pointsRef.current);

    writeJson(STORAGE_KEYS.dailyWork, dailyWorkRef.current);

    return actual;
  }, []);

  return { points, tryEarnPoints, spendPoints, addPoints };
}
