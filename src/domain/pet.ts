export type PetState = 'idle' | 'happy' | 'angry' | 'sleep' | 'hungry' | 'working';

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
