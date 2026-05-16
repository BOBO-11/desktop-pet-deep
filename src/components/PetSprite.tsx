import { CSSProperties } from 'react';
import { PET_SPRITE_FRAMES } from '../config/petAssets';
import type { PetAction, PetVisualState } from '../domain/pet';
import { usePetSpriteFrame } from '../hooks/usePetSpriteFrame';

type PetSpriteProps = {
  visualState: PetVisualState;
  action: PetAction;
  className?: string;
  paused?: boolean;
  frameOverride?: number | null;
};

export function PetSprite({ visualState, action, className, paused = false, frameOverride = null }: PetSpriteProps) {
  const frame = usePetSpriteFrame(visualState, paused);
  const spriteFrame = frameOverride ?? frame;
  const frameList = PET_SPRITE_FRAMES[visualState];
  const imageUrl = frameList[spriteFrame] ?? frameList[0];
  const style = {
    backgroundImage: `url(${imageUrl})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    backgroundPosition: 'center'
  } as CSSProperties;

  return <span className={`pet-sprite-layer ${className ?? ''} pet-action-${action}`} style={style} />;
}
