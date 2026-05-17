export type PetStatus = 'idle' | 'hungry' | 'sleep' | 'working';

export type PetAction = 'none' | 'happyJump' | 'angryShake' | 'blink' | 'eating' | 'dragging' | 'wake';

export type PetVisualState = PetStatus | 'happy' | 'angry' | 'dragging';

export type PetState = PetVisualState;

export type FeedPayload = {
  hungerRestore: number;
  cost: number;
};

export type WorkPayload = {
  duration: number;
  reward: number;
};

export type MoveDelta = {
  x: number;
  y: number;
};

export type FloatText = {
  id: number;
  amount: number;
};

export type PetParticleKind = 'heart' | 'star' | 'spark' | 'coin' | 'food' | 'sweat' | 'zzz';

export type PetParticle = {
  id: number;
  kind: PetParticleKind;
  x: number;
  y: number;
  delay: number;
  size: number;
};
