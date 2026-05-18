import { useCallback, useEffect, useRef, useState } from 'react';
import { POINT_RULES } from '../config/petRules';
import { STORAGE_KEYS } from '../config/storageKeys';
import { getLocalDateKey } from '../utils/date';
import type { PointLedgerSource, SpendRecord } from '../domain/pet';
import {
  readJson,
  readNumber,
  recordPointLedgerEntry,
  subscribeStorageChanges,
  writeJson,
  writeNumber
} from '../utils/storage';

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

function isSpendRecordArray(value: unknown): value is SpendRecord[] {
  return Array.isArray(value) && value.every(
    r => typeof r === 'object' && r &&
      typeof (r as SpendRecord).timestamp === 'number' &&
      typeof (r as SpendRecord).amount === 'number' &&
      typeof (r as SpendRecord).category === 'string'
  );
}

function loadSpendHistory(): SpendRecord[] {
  return readJson<SpendRecord[]>(STORAGE_KEYS.spendHistory, [], isSpendRecordArray);
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

  const commitPoints = useCallback((nextPoints: number) => {
    pointsRef.current = nextPoints;
    setPoints(nextPoints);
    writeNumber(STORAGE_KEYS.points, nextPoints);
  }, []);

  const recordPointChange = useCallback((
    type: 'earn' | 'spend',
    source: PointLedgerSource,
    amount: number,
    balanceAfter: number,
    note: string
  ) => {
    recordPointLedgerEntry({
      timestamp: Date.now(),
      type,
      source,
      amount,
      balanceAfter,
      note
    });
  }, []);

  useEffect(() => {
    return subscribeStorageChanges(() => {
      const nextPoints = loadPoints();
      pointsRef.current = nextPoints;
      dailyRef.current = loadDaily();
      dailyWorkRef.current = loadDailyWork();
      setPoints(nextPoints);
    });
  }, []);

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
    const nextPoints = pointsRef.current + earned;
    commitPoints(nextPoints);

    writeJson(STORAGE_KEYS.dailyInteraction, dailyRef.current);
    recordPointChange('earn', 'interaction', earned, nextPoints, '互动获得积分');

    return earned;
  }, [commitPoints, recordPointChange]);

  const spendPoints = useCallback((amount: number, category: string): boolean => {
    if (pointsRef.current < amount) {
      return false;
    }
    const nextPoints = pointsRef.current - amount;
    commitPoints(nextPoints);

    const history = loadSpendHistory();
    history.push({ timestamp: Date.now(), amount, category });
    writeJson(STORAGE_KEYS.spendHistory, history);
    recordPointChange('spend', 'feed', amount, nextPoints, category);

    return true;
  }, [commitPoints, recordPointChange]);

  const addPoints = useCallback((amount: number, source: PointLedgerSource = 'work-complete'): number => {
    const today = getLocalDateKey();

    if (dailyWorkRef.current.date !== today) {
      dailyWorkRef.current = { date: today, earned: 0 };
    }

    const actual = Math.min(amount, POINT_RULES.workPointsPerDay - dailyWorkRef.current.earned);
    if (actual <= 0) {
      return 0;
    }

    dailyWorkRef.current.earned += actual;
    const nextPoints = pointsRef.current + actual;
    commitPoints(nextPoints);

    writeJson(STORAGE_KEYS.dailyWork, dailyWorkRef.current);
    recordPointChange(
      'earn',
      source,
      actual,
      nextPoints,
      source === 'work-interrupt' ? '中断打工获得积分' : '打工完成获得积分'
    );

    return actual;
  }, [commitPoints, recordPointChange]);

  return { points, tryEarnPoints, spendPoints, addPoints };
}
