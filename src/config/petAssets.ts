import type { PetVisualState } from '../domain/pet';

export const PET_IMAGES: Record<PetVisualState, string> = {
  idle: '/pet/idle.png',
  happy: '/pet/happy.png',
  angry: '/pet/angry.png',
  sleep: '/pet/sleep.png',
  hungry: '/pet/angry.png',
  working: '/pet/idle.png'
};

export const FALLBACK_PET_IMAGE = PET_IMAGES.idle;
