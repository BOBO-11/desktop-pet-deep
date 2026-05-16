import { MouseEvent, PointerEvent, SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FALLBACK_PET_IMAGE, PET_IMAGES } from './config/petAssets';
import { PET_INTERACTION, PET_TIMING } from './config/petRules';
import type { FloatText, PetState } from './domain/pet';
import { useHunger } from './hooks/useHunger';
import { usePetStateMachine } from './hooks/usePetStateMachine';
import { usePoints } from './hooks/usePoints';
import { useWork } from './hooks/useWork';
import { formatDurationSeconds } from './utils/format';

type DragState = {
  startScreenX: number;
  startScreenY: number;
  lastScreenX: number;
  lastScreenY: number;
  isDragging: boolean;
};

function getHungerColor(percent: number) {
  if (percent < 25) return '#e74c3c';
  if (percent < 50) return '#f39c12';
  return '#2ecc71';
}

export function App() {
  const { hungerPercent, isHungry, feed } = useHunger();
  const { points, tryEarnPoints, spendPoints, addPoints } = usePoints();
  const { isWorking, remainingSeconds, startWork, lastReward, clearLastReward } = useWork();

  const spawnFloat = useCallback((amount: number) => {
    const id = floatIdRef.current++;
    setFloatTexts((prev) => [...prev, { id, amount }]);
    window.setTimeout(() => {
      setFloatTexts((prev) => prev.filter((f) => f.id !== id));
    }, PET_TIMING.floatingTextDurationMs);
  }, []);

  const handleInteraction = useCallback(
    (_type: string) => {
      const earned = tryEarnPoints();
      if (earned > 0) {
        spawnFloat(earned);
      }
    },
    [tryEarnPoints, spawnFloat]
  );

  const { petState, bubbleText, showBubble, handlePetClick, registerInteraction, wakeFromSleep } =
    usePetStateMachine(isHungry, isWorking, handleInteraction);

  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [previousPetState, setPreviousPetState] = useState<PetState | null>(null);
  const [floatTexts, setFloatTexts] = useState<FloatText[]>([]);
  const floatIdRef = useRef(0);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const lastPetStateRef = useRef<PetState>(petState);
  const imageFadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void window.desktopPet.getAlwaysOnTop().then(setIsAlwaysOnTop);
    return window.desktopPet.onAlwaysOnTopChanged(setIsAlwaysOnTop);
  }, []);

  useEffect(() => {
    return window.desktopPet.onFeed(({ hungerRestore, cost }) => {
      if (spendPoints(cost)) {
        feed(hungerRestore);
      } else {
        showBubble('积分不够...', 2000);
      }
    });
  }, [feed, showBubble, spendPoints]);

  useEffect(() => {
    return window.desktopPet.onStartWork(({ duration, reward }) => {
      if (isWorking) {
        showBubble('已经在打工啦...', 2000);
        return;
      }
      startWork(duration, reward);
    });
  }, [isWorking, showBubble, startWork]);

  useEffect(() => {
    if (lastReward > 0) {
      const actual = addPoints(lastReward);
      if (actual > 0) {
        spawnFloat(actual);
      } else {
        showBubble('今日打工积分已满...', 2500);
      }
      clearLastReward();
    }
  }, [lastReward, addPoints, spawnFloat, clearLastReward, showBubble]);

  useEffect(() => {
    if (lastPetStateRef.current === petState) {
      return;
    }

    if (imageFadeTimerRef.current !== null) {
      window.clearTimeout(imageFadeTimerRef.current);
    }

    setPreviousPetState(lastPetStateRef.current);
    lastPetStateRef.current = petState;
    imageFadeTimerRef.current = window.setTimeout(() => {
      setPreviousPetState(null);
      imageFadeTimerRef.current = null;
    }, PET_TIMING.imageFadeDurationMs);
  }, [petState]);

  useEffect(() => {
    return () => {
      if (imageFadeTimerRef.current !== null) {
        window.clearTimeout(imageFadeTimerRef.current);
      }
    };
  }, []);

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    if (!event.currentTarget.src.endsWith(FALLBACK_PET_IMAGE)) {
      event.currentTarget.src = FALLBACK_PET_IMAGE;
    }
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      return;
    }

    handlePetClick();
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    registerInteraction();
    dragStateRef.current = {
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      lastScreenX: event.screenX,
      lastScreenY: event.screenY,
      isDragging: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;

    if (!dragState) {
      return;
    }

    const delta = {
      x: event.screenX - dragState.lastScreenX,
      y: event.screenY - dragState.lastScreenY
    };

    if (delta.x === 0 && delta.y === 0) {
      return;
    }

    const totalMoveX = Math.abs(event.screenX - dragState.startScreenX);
    const totalMoveY = Math.abs(event.screenY - dragState.startScreenY);
    if (totalMoveX > PET_INTERACTION.dragThresholdPx || totalMoveY > PET_INTERACTION.dragThresholdPx) {
      dragState.isDragging = true;
    }

    window.desktopPet.moveBy(delta);
    dragState.lastScreenX = event.screenX;
    dragState.lastScreenY = event.screenY;
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragStateRef.current?.isDragging) {
      suppressNextClickRef.current = true;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
  }

  return (
    <main className="pet-window" onContextMenu={(event) => event.preventDefault()}>
      <div className="pet-hunger-bar">
        <div
          className="pet-hunger-fill"
          style={{ width: `${hungerPercent}%`, backgroundColor: getHungerColor(hungerPercent) }}
        />
      </div>

      {floatTexts.map((ft) => (
        <div key={ft.id} className="pet-points-float">
          +{ft.amount}
        </div>
      ))}

      {isWorking && (
        <div className="pet-work-timer">
          打工中... {formatDurationSeconds(remainingSeconds)}
        </div>
      )}

      <button
        className={`pet pet-${petState}`}
        type="button"
        aria-label="桌宠"
        onClick={handleClick}
        onMouseEnter={wakeFromSleep}
        onContextMenu={(event) => {
          event.preventDefault();
          registerInteraction();
          handleInteraction('contextMenu');
          window.desktopPet.showContextMenu();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="pet-motion">
          <span className="pet-sprite-stage">
            {previousPetState && (
              <img
                className="pet-image pet-image-exit"
                src={PET_IMAGES[previousPetState]}
                alt=""
                draggable={false}
                onError={handleImageError}
              />
            )}
            <img
              key={petState}
              className="pet-image pet-image-enter"
              src={PET_IMAGES[petState]}
              alt=""
              draggable={false}
              onError={handleImageError}
            />
          </span>
        </span>
      </button>

      {bubbleText && (
        <div key={bubbleText} className="pet-bubble" aria-live="polite">
          {bubbleText}
        </div>
      )}

      <div className="pet-points">积分 {points}</div>

      <div className="status" aria-live="polite">
        {isAlwaysOnTop ? '置顶' : '普通'}
      </div>
    </main>
  );
}
