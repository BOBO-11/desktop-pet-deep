import type { PetVisualState } from '../domain/pet';

const petFrame = (fileName: string) => `${import.meta.env.BASE_URL}pet/frames/cutout/${fileName}.png`;

export const PET_SPRITE_FRAMES: Record<PetVisualState, readonly string[]> = {
  idle: [petFrame('idle-1'), petFrame('idle-2'), petFrame('idle-3')],
  happy: [petFrame('happy-1'), petFrame('happy-2'), petFrame('happy-3')],
  angry: [petFrame('angry-1'), petFrame('angry-2'), petFrame('angry-3')],
  sleep: [petFrame('sleep-1'), petFrame('sleep-2'), petFrame('sleep-3')],
  hungry: [petFrame('hungry-1'), petFrame('hungry-2'), petFrame('hungry-3')],
  working: [petFrame('working-1'), petFrame('working-2'), petFrame('working-3')],
  dragging: [petFrame('dragging-1'), petFrame('dragging-2'), petFrame('dragging-3')]
};

export const PET_SPRITE_FRAME_MS: Record<PetVisualState, number> = {
  idle: 180,
  happy: 120,
  angry: 90,
  sleep: 240,
  hungry: 180,
  working: 140,
  dragging: 120
};
