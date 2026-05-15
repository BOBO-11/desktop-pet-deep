import { useCallback, useEffect, useRef, useState } from 'react';

type WorkState = { endTime: number; reward: number } | null;

const STORAGE_KEY = 'pet-work';

function loadWork(): WorkState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkState;
      if (parsed && typeof parsed.endTime === 'number' && typeof parsed.reward === 'number') {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable or corrupted
  }
  return null;
}

function saveWork(state: WorkState) {
  try {
    if (state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable
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
    }, 250);

    return () => window.clearInterval(interval);
  }, [workState]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return { isWorking, remainingSeconds, startWork, lastReward, clearLastReward };
}
