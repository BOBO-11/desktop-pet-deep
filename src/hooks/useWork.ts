import { useCallback, useEffect, useRef, useState } from 'react';
import { PET_TIMING } from '../config/petRules';
import { STORAGE_KEYS } from '../config/storageKeys';
import { readJson, removeStoredValue, writeJson } from '../utils/storage';

type WorkState = { endTime: number; reward: number } | null;

function loadWork(): WorkState {
  return readJson<WorkState>(
    STORAGE_KEYS.work,
    null,
    (value): value is WorkState =>
      value === null ||
      Boolean(
        value &&
          typeof value === 'object' &&
          typeof (value as Exclude<WorkState, null>).endTime === 'number' &&
          typeof (value as Exclude<WorkState, null>).reward === 'number'
      )
  );
}

function saveWork(state: WorkState) {
  if (state) {
    writeJson(STORAGE_KEYS.work, state);
  } else {
    removeStoredValue(STORAGE_KEYS.work);
  }
}

export function useWork() {
  const [workState, setWorkState] = useState<WorkState>(loadWork);
  const [remainingMs, setRemainingMs] = useState(0);
  const [lastReward, setLastReward] = useState(0);
  const workStateRef = useRef(workState);
  workStateRef.current = workState;

  const isWorking = workState !== null;

  useEffect(() => {
    saveWork(workState);
  }, [workState]);

  const startWork = useCallback((durationMs: number, reward: number) => {
    const endTime = Date.now() + durationMs;
    const state: WorkState = { endTime, reward };
    setWorkState(state);
    setRemainingMs(durationMs);
  }, []);

  const clearLastReward = useCallback(() => {
    setLastReward(0);
  }, []);

  useEffect(() => {
    if (!workState) {
      setRemainingMs(0);
      return;
    }

    // Check if work already completed (e.g. app was closed during work)
    const now = Date.now();
    if (workState.endTime <= now) {
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
        setLastReward(state.reward);
        setWorkState(null);
      }
    }, PET_TIMING.workTickMs);

    return () => window.clearInterval(interval);
  }, [workState]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return { isWorking, remainingSeconds, startWork, lastReward, clearLastReward };
}
