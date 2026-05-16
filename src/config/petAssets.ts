import type { PetVisualState } from '../domain/pet';

export const PET_SPRITE_FRAMES: Record<PetVisualState, readonly string[]> = {
  idle: ['/pet/frames/cutout/idle-1.png', '/pet/frames/cutout/idle-2.png', '/pet/frames/cutout/idle-3.png'],
  happy: ['/pet/frames/cutout/happy-1.png', '/pet/frames/cutout/happy-2.png', '/pet/frames/cutout/happy-3.png'],
  angry: ['/pet/frames/cutout/angry-1.png', '/pet/frames/cutout/angry-2.png', '/pet/frames/cutout/angry-3.png'],
  sleep: ['/pet/frames/cutout/sleep-1.png', '/pet/frames/cutout/sleep-2.png', '/pet/frames/cutout/sleep-3.png'],
  hungry: ['/pet/frames/cutout/hungry-1.png', '/pet/frames/cutout/hungry-2.png', '/pet/frames/cutout/hungry-3.png'],
  working: ['/pet/frames/cutout/working-1.png', '/pet/frames/cutout/working-2.png', '/pet/frames/cutout/working-3.png']
};

export const PET_SPRITE_FRAME_MS: Record<PetVisualState, number> = {
  idle: 180,
  happy: 120,
  angry: 90,
  sleep: 240,
  hungry: 180,
  working: 140
};
