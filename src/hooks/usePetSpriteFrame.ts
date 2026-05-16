import { useEffect, useRef, useState } from 'react';
import { PET_SPRITE_FRAME_MS } from '../config/petAssets';
import type { PetVisualState } from '../domain/pet';

const FRAME_SEQUENCE = [0, 1, 2, 1];

export function usePetSpriteFrame(visualState: PetVisualState, paused = false) {
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    frameRef.current = 0;
    setFrame(0);

    if (paused) {
      return () => {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }

    const step = () => {
      frameRef.current = (frameRef.current + 1) % FRAME_SEQUENCE.length;
      setFrame(FRAME_SEQUENCE[frameRef.current]);
      timerRef.current = window.setTimeout(step, PET_SPRITE_FRAME_MS[visualState]);
    };

    setFrame(FRAME_SEQUENCE[0]);
    timerRef.current = window.setTimeout(step, PET_SPRITE_FRAME_MS[visualState]);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [paused, visualState]);

  return frame;
}
