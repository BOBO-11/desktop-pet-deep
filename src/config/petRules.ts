export const PET_TIMING = {
  happyDurationMs: 2000,
  angryDurationMs: 3000,
  sleepDelayMs: 10 * 60 * 1000,
  clickBurstWindowMs: 900,
  bubbleDurationMs: 2000,
  dialogueMinDelayMs: 30 * 1000,
  dialogueMaxDelayMs: 60 * 1000,
  dialogueBubbleDurationMs: 5000,
  imageFadeDurationMs: 180,
  floatingTextDurationMs: 1000,
  particleDurationMs: 1200,
  workTickMs: 250,
  blinkMinDelayMs: 5 * 1000,
  blinkMaxDelayMs: 12 * 1000,
  blinkDurationMs: 180,
  eatingDurationMs: 900,
  wakeDurationMs: 650
} as const;

export const PET_INTERACTION = {
  angryClickThreshold: 5,
  dragThresholdPx: 4
} as const;

export const HUNGER_RULES = {
  max: 100,
  hungryThreshold: 20,
  decayIntervalMs: 2 * 60 * 1000,
  decayPerInterval: 1
} as const;

export const POINT_RULES = {
  interactionCooldownMs: 10 * 1000,
  pointsPerMinute: 4,
  pointsPerDay: 40,
  workPointsPerDay: 180,
  minInteractionReward: 1,
  maxInteractionReward: 1
} as const;
