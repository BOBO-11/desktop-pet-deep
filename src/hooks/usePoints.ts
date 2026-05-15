import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'pet-points';
const DAILY_KEY = 'pet-daily';
const DAILY_WORK_KEY = 'pet-daily-work';
const COOLDOWN_MS = 5000;
const POINTS_PER_MINUTE = 10;
const POINTS_PER_DAY = 100;
const POINTS_PER_DAY_WORK = 150;
const POINTS_MIN = 1;
const POINTS_MAX = 2;

function loadPoints(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const n = parseInt(saved, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
  } catch {
    // localStorage unavailable
  }
  return 0;
}

function loadDaily(): { date: string; earned: number } {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.date === 'string' && typeof parsed.earned === 'number') {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return { date: '', earned: 0 };
}

function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadDailyWork(): { date: string; earned: number } {
  try {
    const raw = localStorage.getItem(DAILY_WORK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.date === 'string' && typeof parsed.earned === 'number') {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return { date: '', earned: 0 };
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
    try {
      localStorage.setItem(STORAGE_KEY, String(points));
    } catch {
      // localStorage unavailable
    }
  }, [points]);

  const tryEarnPoints = useCallback((): number => {
    const now = Date.now();
    const today = getToday();

    if (dailyRef.current.date !== today) {
      dailyRef.current = { date: today, earned: 0 };
    }

    if (dailyRef.current.earned >= POINTS_PER_DAY) {
      return 0;
    }

    if (now - minuteStartRef.current >= 60000) {
      minuteStartRef.current = now;
      minutePointsRef.current = 0;
    }

    if (minutePointsRef.current >= POINTS_PER_MINUTE) {
      return 0;
    }

    if (now - lastEarnRef.current < COOLDOWN_MS) {
      return 0;
    }

    const earned = Math.min(
      Math.floor(Math.random() * POINTS_MAX) + POINTS_MIN,
      POINTS_PER_MINUTE - minutePointsRef.current,
      POINTS_PER_DAY - dailyRef.current.earned
    );

    lastEarnRef.current = now;
    minutePointsRef.current += earned;
    dailyRef.current.earned += earned;
    pointsRef.current += earned;
    setPoints(pointsRef.current);

    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify(dailyRef.current));
    } catch {
      // localStorage unavailable
    }

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
    const today = getToday();

    if (dailyWorkRef.current.date !== today) {
      dailyWorkRef.current = { date: today, earned: 0 };
    }

    const actual = Math.min(amount, POINTS_PER_DAY_WORK - dailyWorkRef.current.earned);
    if (actual <= 0) {
      return 0;
    }

    dailyWorkRef.current.earned += actual;
    pointsRef.current += actual;
    setPoints(pointsRef.current);

    try {
      localStorage.setItem(DAILY_WORK_KEY, JSON.stringify(dailyWorkRef.current));
    } catch {
      // localStorage unavailable
    }

    return actual;
  }, []);

  return { points, tryEarnPoints, spendPoints, addPoints };
}
