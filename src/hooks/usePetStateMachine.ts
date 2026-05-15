import { useCallback, useEffect, useRef, useState } from 'react';
import kleeLines from '../data/kleeDialogue';

export type PetState = 'idle' | 'happy' | 'angry' | 'sleep' | 'hungry' | 'working';

const HAPPY_DURATION = 2000;
const ANGRY_DURATION = 3000;
const SLEEP_DELAY = 600000;
const ANGRY_CLICK_THRESHOLD = 5;
const CLICK_CHAIN_RESET_DELAY = 1200;
const BUBBLE_DURATION = 2000;
const DIALOGUE_MIN_DELAY = 30000;
const DIALOGUE_MAX_DELAY = 60000;
const DIALOGUE_BUBBLE_DURATION = 5000;

function getRandomDialogueDelay() {
  return DIALOGUE_MIN_DELAY + Math.random() * (DIALOGUE_MAX_DELAY - DIALOGUE_MIN_DELAY);
}

function pickRandomLine() {
  return kleeLines[Math.floor(Math.random() * kleeLines.length)];
}

function getInitialState(isHungry: boolean, isWorking: boolean): PetState {
  if (isWorking) return 'working';
  if (isHungry) return 'hungry';
  return 'idle';
}

export function usePetStateMachine(isHungry: boolean, isWorking: boolean, onInteraction?: (type: string) => void) {
  const [petState, setPetState] = useState<PetState>(getInitialState(isHungry, isWorking));
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const stateRef = useRef<PetState>(getInitialState(isHungry, isWorking));
  const isHungryRef = useRef(isHungry);
  isHungryRef.current = isHungry;
  const prevHungryRef = useRef(false);
  const isWorkingRef = useRef(isWorking);
  isWorkingRef.current = isWorking;
  const prevWorkingRef = useRef(false);
  const stateTimerRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const dialogueTimerRef = useRef<number | null>(null);
  const clickChainTimerRef = useRef<number | null>(null);
  const clickCountRef = useRef(0);
  const onInteractionRef = useRef(onInteraction);
  onInteractionRef.current = onInteraction;

  const clearTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setState = useCallback((nextState: PetState) => {
    stateRef.current = nextState;
    setPetState(nextState);
  }, []);

  const clearBubble = useCallback(() => {
    clearTimer(bubbleTimerRef);
    setBubbleText(null);
  }, [clearTimer]);

  const showBubble = useCallback(
    (text: string, duration: number | null = BUBBLE_DURATION) => {
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
    clearTimer(clickChainTimerRef);
  }, [clearTimer]);

  const scheduleSleep = useCallback(() => {
    clearTimer(sleepTimerRef);
    if (isHungryRef.current || isWorkingRef.current) {
      return;
    }
    sleepTimerRef.current = window.setTimeout(() => {
      if (isHungryRef.current || isWorkingRef.current) {
        return;
      }
      clearTimer(stateTimerRef);
      setState('sleep');
      showBubble('zzz...', null);
    }, SLEEP_DELAY);
  }, [clearTimer, setState, showBubble]);

  const registerInteraction = useCallback(() => {
    if (stateRef.current !== 'sleep') {
      scheduleSleep();
    }
  }, [scheduleSleep]);

  const scheduleDialogue = useCallback(() => {
    clearTimer(dialogueTimerRef);
    if (isWorkingRef.current) {
      return;
    }
    dialogueTimerRef.current = window.setTimeout(() => {
      if (stateRef.current === 'sleep' || isWorkingRef.current) {
        scheduleDialogue();
        return;
      }
      showBubble(pickRandomLine(), DIALOGUE_BUBBLE_DURATION);
      scheduleDialogue();
    }, getRandomDialogueDelay());
  }, [clearTimer, showBubble]);

  const returnToIdleAfter = useCallback(
    (delay: number, expectedState: PetState) => {
      clearTimer(stateTimerRef);
      stateTimerRef.current = window.setTimeout(() => {
        if (stateRef.current !== expectedState) {
          return;
        }

        if (expectedState === 'angry') {
          resetClickChain();
        }

        const nextState = isHungryRef.current ? 'hungry' : 'idle';
        setState(nextState);
      }, delay);
    },
    [clearTimer, resetClickChain, setState]
  );

  const handlePetClick = useCallback(() => {
    if (isWorkingRef.current) {
      return;
    }
    scheduleSleep();

    if (stateRef.current === 'angry') {
      return;
    }

    clickCountRef.current += 1;
    clearTimer(clickChainTimerRef);
    clickChainTimerRef.current = window.setTimeout(() => {
      clickCountRef.current = 0;
    }, CLICK_CHAIN_RESET_DELAY);

    if (clickCountRef.current >= ANGRY_CLICK_THRESHOLD) {
      resetClickChain();
      setState('angry');
      showBubble('别戳啦！');
      returnToIdleAfter(ANGRY_DURATION, 'angry');
      return;
    }

    setState('happy');
    showBubble('嘿嘿~');
    onInteractionRef.current?.('click');
    returnToIdleAfter(HAPPY_DURATION, 'happy');
  }, [clearTimer, resetClickChain, returnToIdleAfter, scheduleSleep, setState, showBubble]);

  const wakeFromSleep = useCallback(() => {
    if (stateRef.current === 'sleep') {
      setState(isHungryRef.current ? 'hungry' : 'idle');
      clearBubble();
      scheduleDialogue();
      onInteractionRef.current?.('wake');
    }

    scheduleSleep();
  }, [clearBubble, scheduleDialogue, scheduleSleep, setState]);

  useEffect(() => {
    const wasHungry = prevHungryRef.current;
    prevHungryRef.current = isHungry;

    if (isHungry && !wasHungry && !isWorking) {
      clearTimer(stateTimerRef);
      clearTimer(sleepTimerRef);
      setState('hungry');
      scheduleDialogue();
    } else if (!isHungry && wasHungry && !isWorking) {
      clearTimer(stateTimerRef);
      setState('idle');
      scheduleSleep();
      scheduleDialogue();
    }
  }, [isHungry, isWorking, clearTimer, setState, scheduleDialogue, scheduleSleep]);

  useEffect(() => {
    const wasWorking = prevWorkingRef.current;
    prevWorkingRef.current = isWorking;

    if (isWorking && !wasWorking) {
      clearTimer(dialogueTimerRef);
      clearTimer(stateTimerRef);
      clearTimer(sleepTimerRef);
      clearBubble();
      setState('working');
    } else if (!isWorking && wasWorking) {
      clearTimer(stateTimerRef);
      setState(isHungryRef.current ? 'hungry' : 'idle');
      scheduleSleep();
      scheduleDialogue();
    }
  }, [isWorking, clearTimer, clearBubble, setState, scheduleDialogue, scheduleSleep]);

  useEffect(() => {
    scheduleSleep();
    scheduleDialogue();

    return () => {
      clearTimer(stateTimerRef);
      clearTimer(sleepTimerRef);
      clearTimer(bubbleTimerRef);
      clearTimer(dialogueTimerRef);
      clearTimer(clickChainTimerRef);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    petState,
    bubbleText,
    showBubble,
    handlePetClick,
    registerInteraction,
    wakeFromSleep
  };
}
