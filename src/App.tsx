import { CSSProperties, MouseEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { PET_INTERACTION, PET_TIMING } from './config/petRules';
import { PET_SPRITE_FRAMES } from './config/petAssets';
import type { FloatText, PetParticle, PetParticleKind, PetVisualState } from './domain/pet';
import { PetSprite } from './components/PetSprite';
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

function getParticleText(kind: PetParticleKind) {
  switch (kind) {
    case 'heart':
      return '♥';
    case 'star':
      return '★';
    case 'spark':
      return '!';
    case 'coin':
      return '+';
    case 'food':
      return '●';
    case 'sweat':
      return '滴';
    case 'zzz':
      return 'Z';
  }
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

  const {
    petStatus,
    petAction,
    petVisualState,
    bubbleText,
    showBubble,
    handlePetClick,
    registerInteraction,
    wakeFromSleep,
    startDragging,
    stopDragging,
    playEating
  } =
    usePetStateMachine(isHungry, isWorking, handleInteraction);

  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [floatTexts, setFloatTexts] = useState<FloatText[]>([]);
  const [particles, setParticles] = useState<PetParticle[]>([]);
  const [dragTilt, setDragTilt] = useState(0);
  const floatIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const spawnParticles = useCallback((kind: PetParticleKind, count: number) => {
    const nextParticles = Array.from({ length: count }, (_, index) => ({
      id: particleIdRef.current++,
      kind,
      x: 34 + Math.random() * 32,
      y: 26 + Math.random() * 24,
      delay: index * 45,
      size: 12 + Math.random() * 8
    }));

    setParticles((prev) => [...prev, ...nextParticles]);
    window.setTimeout(() => {
      const ids = new Set(nextParticles.map((particle) => particle.id));
      setParticles((prev) => prev.filter((particle) => !ids.has(particle.id)));
    }, PET_TIMING.particleDurationMs + count * 45);
  }, []);

  useEffect(() => {
    Object.values(PET_SPRITE_FRAMES).flat().forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  useEffect(() => {
    void window.desktopPet.getAlwaysOnTop().then(setIsAlwaysOnTop);
    return window.desktopPet.onAlwaysOnTopChanged(setIsAlwaysOnTop);
  }, []);

  useEffect(() => {
    return window.desktopPet.onFeed(({ hungerRestore, cost }) => {
      if (spendPoints(cost)) {
        feed(hungerRestore);
        playEating();
        spawnParticles('food', 7);
        spawnParticles('heart', 4);
      } else {
        showBubble('积分不够...', 2000);
        spawnParticles('sweat', 3);
      }
    });
  }, [feed, playEating, showBubble, spawnParticles, spendPoints]);

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
        spawnParticles('coin', 8);
      } else {
        showBubble('今日打工积分已满...', 2500);
      }
      clearLastReward();
    }
  }, [lastReward, addPoints, spawnFloat, clearLastReward, showBubble, spawnParticles]);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      return;
    }

    const result = handlePetClick();
    if (result === 'happy') {
      spawnParticles('star', 6);
      spawnParticles('heart', 3);
    } else if (result === 'angry') {
      spawnParticles('spark', 8);
    }
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
    if (!dragState.isDragging && totalMoveX <= PET_INTERACTION.dragThresholdPx && totalMoveY <= PET_INTERACTION.dragThresholdPx) {
      return;
    }

    if (!dragState.isDragging) {
      dragState.isDragging = true;
      startDragging();
    }

    if (totalMoveX > PET_INTERACTION.dragThresholdPx || totalMoveY > PET_INTERACTION.dragThresholdPx) {
      dragState.isDragging = true;
    }

    setDragTilt(Math.max(-12, Math.min(12, delta.x * 0.8)));
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
    setDragTilt(0);
    stopDragging();
  }

  return (
    <main
      className="pet-window"
      style={{ '--pet-drag-tilt': `${dragTilt}deg` } as CSSProperties}
      onContextMenu={(event) => event.preventDefault()}
    >
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

      {particles.map((particle) => (
        <span
          key={particle.id}
          className={`pet-particle pet-particle-${particle.kind}`}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animationDelay: `${particle.delay}ms`,
            fontSize: `${particle.size}px`
          }}
        >
          {getParticleText(particle.kind)}
        </span>
      ))}

      {isWorking && (
        <div className="pet-work-timer">
          打工中... {formatDurationSeconds(remainingSeconds)}
        </div>
      )}

      <button
        className={`pet pet-${petVisualState} pet-status-${petStatus} pet-action-${petAction}`}
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
            <PetSprite visualState={petVisualState} action={petAction} />
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
