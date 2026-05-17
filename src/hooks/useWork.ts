import { useCallback, useEffect, useRef, useState } from 'react';
import { PET_TIMING, WORK_RULES } from '../config/petRules';
import { STORAGE_KEYS } from '../config/storageKeys';
import { readJson, removeStoredValue, writeJson } from '../utils/storage';

type WorkState = {
  startTime: number;
  endTime: number;
  durationMs: number;
  reward: number;
} | null;

type RewardSource = 'complete' | 'interrupt' | null;

type InterruptWorkResult =
  | { interrupted: false; reward: 0; reason: 'not-working' }
  | { interrupted: true; reward: number; reason: 'interrupted' };

type LegacyWorkState = {
  endTime: number;
  reward: number;
};

const WORK_DURATION_BY_REWARD: Record<number, number> = {
  12: 5 * 60 * 1000,
  22: 10 * 60 * 1000,
  40: 20 * 60 * 1000,
  55: 30 * 60 * 1000,
  95: 60 * 60 * 1000
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getWorkDurationByReward(reward: number) {
  return WORK_DURATION_BY_REWARD[reward] ?? 20 * 60 * 1000;
}

function isWorkState(value: unknown): value is WorkState {
  if (value === null) {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as Partial<NonNullable<WorkState>>;

  return (
    isFiniteNumber(state.startTime) &&
    isFiniteNumber(state.endTime) &&
    isFiniteNumber(state.durationMs) &&
    isFiniteNumber(state.reward) &&
    state.durationMs > 0 &&
    state.reward > 0 &&
    state.endTime > state.startTime
  );
}

function isLegacyWorkState(value: unknown): value is LegacyWorkState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as Partial<LegacyWorkState>;

  return isFiniteNumber(state.endTime) && isFiniteNumber(state.reward) && state.reward > 0;
}

function normalizeWorkState(value: WorkState | LegacyWorkState | null): WorkState {
  if (!value) {
    return null;
  }

  if ('startTime' in value && 'durationMs' in value) {
    return value;
  }

  const durationMs = getWorkDurationByReward(value.reward);
  const now = Date.now();
  const remainingMs = Math.max(0, value.endTime - now);
  const elapsedMs = Math.max(0, durationMs - remainingMs);

  return {
    startTime: now - elapsedMs,
    endTime: value.endTime,
    durationMs,
    reward: value.reward
  };
}

function loadWork(): WorkState {
  const stored = readJson<WorkState | LegacyWorkState | null>(
    STORAGE_KEYS.work,
    null,
    (value): value is WorkState | LegacyWorkState | null =>
      isWorkState(value) || isLegacyWorkState(value) || value === null
  );
  return normalizeWorkState(stored);
}

function saveWork(state: WorkState) {
  if (state) {
    writeJson(STORAGE_KEYS.work, state);
  } else {
    removeStoredValue(STORAGE_KEYS.work);
  }
}

function calculateInterruptReward(state: NonNullable<WorkState>, now = Date.now()) {
  const remainingMs = Math.max(0, state.endTime - now);
  const elapsedMs = Math.max(0, state.durationMs - remainingMs);

  if (state.durationMs <= 0 || elapsedMs < WORK_RULES.interruptRewardGraceMs) {
    return 0;
  }

  const progress = Math.min(1, elapsedMs / state.durationMs);
  const reward = Math.floor(state.reward * progress * WORK_RULES.interruptRewardRate);
  const maxReward = Math.floor(state.reward * WORK_RULES.interruptRewardCapRatio);

  if (reward <= 0 || maxReward <= 0) {
    return 0;
  }

  return Math.min(Math.max(1, reward), maxReward);
}

export function useWork() {
  const [workState, setWorkState] = useState<WorkState>(loadWork);
  const [remainingMs, setRemainingMs] = useState(0);
  const [lastReward, setLastReward] = useState(0);
  const [lastRewardSource, setLastRewardSource] = useState<RewardSource>(null);
  const workStateRef = useRef(workState);
  workStateRef.current = workState;

  const isWorking = workState !== null;

  useEffect(() => {
    saveWork(workState);
  }, [workState]);

  const startWork = useCallback((durationMs: number, reward: number) => {
    if (!Number.isFinite(durationMs) || !Number.isFinite(reward) || durationMs <= 0 || reward <= 0) {
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + durationMs;
    const state: WorkState = { startTime, endTime, durationMs, reward };
    setWorkState(state);
    setRemainingMs(durationMs);
  }, []);

  const interruptWork = useCallback((): InterruptWorkResult => {
    const state = workStateRef.current;

    if (!state) {
      return { interrupted: false, reward: 0, reason: 'not-working' };
    }

    const reward = calculateInterruptReward(state);

    setRemainingMs(0);
    setWorkState(null);

    if (reward > 0) {
      setLastRewardSource('interrupt');
      setLastReward(reward);
    } else {
      setLastRewardSource(null);
      setLastReward(0);
    }

    return { interrupted: true, reward, reason: 'interrupted' };
  }, []);

  const clearLastReward = useCallback(() => {
    setLastReward(0);
    setLastRewardSource(null);
  }, []);

  useEffect(() => {
    if (!workState) {
      setRemainingMs(0);
      return;
    }

    const now = Date.now();
    if (workState.endTime <= now) {
      setLastRewardSource('complete');
      setLastReward(workState.reward);
      setWorkState(null);
      return;
    }

    setRemainingMs(workState.endTime - now);

    const interval = window.setInterval(() => {
      const state = workStateRef.current;
      if (!state) {
        return;
      }

      const left = Math.max(0, state.endTime - Date.now());
      setRemainingMs(left);

      if (left <= 0) {
        setLastRewardSource('complete');
        setLastReward(state.reward);
        setWorkState(null);
      }
    }, PET_TIMING.workTickMs);

    return () => window.clearInterval(interval);
  }, [workState]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return { isWorking, remainingSeconds, startWork, interruptWork, lastReward, lastRewardSource, clearLastReward };
}
