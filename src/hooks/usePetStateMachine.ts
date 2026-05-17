import { useCallback, useEffect, useRef, useState } from 'react';
import { PET_INTERACTION, PET_TIMING } from '../config/petRules';
import kleeLines from '../data/kleeDialogue';
import type { PetAction, PetStatus, PetVisualState } from '../domain/pet';

type TimerRef = { current: number | null };
type ActionMode = 'queue' | 'replace';
type QueuedAction = { action: PetAction; duration: number | null };

function getRandomDelay(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickRandomLine() {
  return kleeLines[Math.floor(Math.random() * kleeLines.length)];
}

function getBaseStatus(isHungry: boolean, isWorking: boolean): PetStatus {
  if (isWorking) return 'working';
  if (isHungry) return 'hungry';
  return 'idle';
}

function getVisualState(status: PetStatus, action: PetAction): PetVisualState {
  if (action === 'dragging') {
    return 'dragging';
  }

  if (action === 'happyJump' || action === 'eating' || action === 'wake') {
    return 'happy';
  }

  if (action === 'angryShake') {
    return 'angry';
  }

  return status;
}

export function usePetStateMachine(isHungry: boolean, isWorking: boolean, onInteraction?: (type: string) => void) {
  const [petStatus, setPetStatus] = useState<PetStatus>(getBaseStatus(isHungry, isWorking));
  const [petAction, setPetActionState] = useState<PetAction>('none');
  const [bubbleText, setBubbleText] = useState<string | null>(null);

  const statusRef = useRef<PetStatus>(getBaseStatus(isHungry, isWorking));
  const actionRef = useRef<PetAction>('none');
  const actionQueueRef = useRef<QueuedAction[]>([]);
  const isHungryRef = useRef(isHungry);
  const prevHungryRef = useRef(isHungry);
  const isWorkingRef = useRef(isWorking);
  const prevWorkingRef = useRef(isWorking);
  const sleepTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const dialogueTimerRef = useRef<number | null>(null);
  const blinkTimerRef = useRef<number | null>(null);
  const actionTimerRef = useRef<number | null>(null);
  const lastClickAtRef = useRef(0);
  const clickCountRef = useRef(0);
  const onInteractionRef = useRef(onInteraction);

  isHungryRef.current = isHungry;
  isWorkingRef.current = isWorking;
  onInteractionRef.current = onInteraction;

  const clearTimer = useCallback((timerRef: TimerRef) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setStatus = useCallback((nextStatus: PetStatus) => {
    statusRef.current = nextStatus;
    setPetStatus(nextStatus);
  }, []);

  const setAction = useCallback((nextAction: PetAction) => {
    actionRef.current = nextAction;
    setPetActionState(nextAction);
  }, []);

  const runNextQueuedAction = useCallback(() => {
    const next = actionQueueRef.current.shift();
    if (!next) {
      setAction('none');
      return;
    }

    setAction(next.action);
    if (next.duration !== null) {
      actionTimerRef.current = window.setTimeout(() => {
        actionTimerRef.current = null;
        runNextQueuedAction();
      }, next.duration);
    }
  }, [setAction]);

  const triggerAction = useCallback(
    (action: PetAction, duration: number | null, mode: ActionMode = 'queue') => {
      if (statusRef.current === 'sleep' && action !== 'wake') {
        return;
      }

      if (mode === 'replace') {
        clearTimer(actionTimerRef);
        actionQueueRef.current = [];
        setAction(action);
      } else if (actionRef.current !== 'none') {
        actionQueueRef.current.push({ action, duration });
        return;
      } else {
        setAction(action);
      }

      if (duration !== null) {
        clearTimer(actionTimerRef);
        actionTimerRef.current = window.setTimeout(() => {
          actionTimerRef.current = null;
          runNextQueuedAction();
        }, duration);
      }
    },
    [clearTimer, runNextQueuedAction, setAction]
  );

  const clearAction = useCallback(
    (expectedAction?: PetAction) => {
      if (expectedAction && actionRef.current !== expectedAction) {
        return;
      }

      clearTimer(actionTimerRef);
      actionQueueRef.current = [];
      setAction('none');
    },
    [clearTimer, setAction]
  );

  const clearBubble = useCallback(() => {
    clearTimer(bubbleTimerRef);
    setBubbleText(null);
  }, [clearTimer]);

  const showBubble = useCallback(
    (text: string, duration: number | null = PET_TIMING.bubbleDurationMs) => {
      clearTimer(bubbleTimerRef);
      setBubbleText(text);

      if (duration === null) {
        return;
      }

      bubbleTimerRef.current = window.setTimeout(() => {
        setBubbleText(null);
        bubbleTimerRef.current = null;
      }, duration);
    },
    [clearTimer]
  );

  const resetClickChain = useCallback(() => {
    clickCountRef.current = 0;
    lastClickAtRef.current = 0;
  }, []);

  const scheduleSleep = useCallback(() => {
    clearTimer(sleepTimerRef);
    if (isHungryRef.current || isWorkingRef.current || statusRef.current === 'sleep') {
      return;
    }

    sleepTimerRef.current = window.setTimeout(() => {
      if (isHungryRef.current || isWorkingRef.current) {
        return;
      }

      clearAction();
      clearTimer(blinkTimerRef);
      setStatus('sleep');
      showBubble('zzz...', null);
    }, PET_TIMING.sleepDelayMs);
  }, [clearAction, clearTimer, setStatus, showBubble]);

  const scheduleDialogue = useCallback(() => {
    clearTimer(dialogueTimerRef);
    if (isWorkingRef.current) {
      return;
    }

    dialogueTimerRef.current = window.setTimeout(() => {
      if (statusRef.current === 'sleep' || isWorkingRef.current) {
        scheduleDialogue();
        return;
      }

      showBubble(pickRandomLine(), PET_TIMING.dialogueBubbleDurationMs);
      scheduleDialogue();
    }, getRandomDelay(PET_TIMING.dialogueMinDelayMs, PET_TIMING.dialogueMaxDelayMs));
  }, [clearTimer, showBubble]);

  const scheduleBlink = useCallback(() => {
    clearTimer(blinkTimerRef);
    if (isWorkingRef.current || statusRef.current === 'sleep') {
      return;
    }

    blinkTimerRef.current = window.setTimeout(() => {
      if (actionRef.current === 'none' && statusRef.current !== 'sleep' && !isWorkingRef.current) {
        triggerAction('blink', PET_TIMING.blinkDurationMs, 'replace');
      }
      scheduleBlink();
    }, getRandomDelay(PET_TIMING.blinkMinDelayMs, PET_TIMING.blinkMaxDelayMs));
  }, [clearTimer, triggerAction]);

  const registerInteraction = useCallback(() => {
    if (statusRef.current !== 'sleep') {
      scheduleSleep();
    }
  }, [scheduleSleep]);

  const handlePetClick = useCallback(() => {
    if (isWorkingRef.current) {
      return 'none' as const;
    }

    scheduleSleep();

    if (actionRef.current === 'angryShake') {
      return 'angry' as const;
    }

    const now = Date.now();
    if (lastClickAtRef.current === 0 || now - lastClickAtRef.current > PET_TIMING.clickBurstWindowMs) {
      clickCountRef.current = 1;
    } else {
      clickCountRef.current += 1;
    }
    lastClickAtRef.current = now;

    if (clickCountRef.current >= PET_INTERACTION.angryClickThreshold) {
      resetClickChain();
      triggerAction('angryShake', PET_TIMING.angryDurationMs, 'replace');
      showBubble('别戳啦！');
      return 'angry' as const;
    }

    triggerAction('happyJump', PET_TIMING.happyDurationMs, 'replace');
    showBubble('嘿嘿~');
    onInteractionRef.current?.('click');
    return 'happy' as const;
  }, [clearTimer, resetClickChain, scheduleSleep, showBubble, triggerAction]);

  const wakeFromSleep = useCallback(() => {
    if (statusRef.current === 'sleep') {
      setStatus(getBaseStatus(isHungryRef.current, isWorkingRef.current));
      clearBubble();
      triggerAction('wake', PET_TIMING.wakeDurationMs, 'replace');
      scheduleDialogue();
      scheduleBlink();
      onInteractionRef.current?.('wake');
    }

    scheduleSleep();
  }, [clearBubble, scheduleBlink, scheduleDialogue, scheduleSleep, setStatus, triggerAction]);

  const startDragging = useCallback(() => {
    if (statusRef.current === 'sleep') {
      wakeFromSleep();
    }
    resetClickChain();
    clearBubble();
    triggerAction('dragging', null, 'replace');
  }, [clearBubble, resetClickChain, triggerAction, wakeFromSleep]);

  const stopDragging = useCallback(() => {
    clearAction('dragging');
    scheduleSleep();
  }, [clearAction, scheduleSleep]);

  const playEating = useCallback(() => {
    triggerAction('eating', PET_TIMING.eatingDurationMs, 'replace');
    showBubble('好吃！');
  }, [showBubble, triggerAction]);

  useEffect(() => {
    const wasHungry = prevHungryRef.current;
    prevHungryRef.current = isHungry;

    if (isHungry && !wasHungry && !isWorking) {
      clearTimer(sleepTimerRef);
      clearBubble();
      setStatus('hungry');
      scheduleDialogue();
      scheduleBlink();
    } else if (!isHungry && wasHungry && !isWorking) {
      setStatus('idle');
      scheduleSleep();
      scheduleDialogue();
      scheduleBlink();
    }
  }, [isHungry, isWorking, clearBubble, clearTimer, scheduleBlink, scheduleDialogue, scheduleSleep, setStatus]);

  useEffect(() => {
    const wasWorking = prevWorkingRef.current;
    prevWorkingRef.current = isWorking;

    if (isWorking && !wasWorking) {
      clearTimer(dialogueTimerRef);
      clearTimer(sleepTimerRef);
      clearTimer(blinkTimerRef);
      clearBubble();
      clearAction();
      setStatus('working');
    } else if (!isWorking && wasWorking) {
      setStatus(getBaseStatus(isHungryRef.current, false));
      scheduleSleep();
      scheduleDialogue();
      scheduleBlink();
    }
  }, [isWorking, clearAction, clearBubble, clearTimer, scheduleBlink, scheduleDialogue, scheduleSleep, setStatus]);

  useEffect(() => {
    scheduleSleep();
    scheduleDialogue();
    scheduleBlink();

    return () => {
      clearTimer(sleepTimerRef);
      clearTimer(bubbleTimerRef);
      clearTimer(dialogueTimerRef);
      clearTimer(blinkTimerRef);
      clearTimer(actionTimerRef);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    petStatus,
    petAction,
    petVisualState: getVisualState(petStatus, petAction),
    bubbleText,
    showBubble,
    handlePetClick,
    registerInteraction,
    wakeFromSleep,
    startDragging,
    stopDragging,
    playEating,
    triggerAction
  };
}
