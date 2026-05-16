export const PET_TIMING = {
  happyDurationMs: 2000,
  angryDurationMs: 3000,
  sleepDelayMs: 10 * 60 * 1000,
  clickChainResetDelayMs: 1200,
  bubbleDurationMs: 2000,
  dialogueMinDelayMs: 30 * 1000,
  dialogueMaxDelayMs: 60 * 1000,
  dialogueBubbleDurationMs: 5000,
  imageFadeDurationMs: 180,
  floatingTextDurationMs: 1000,
  workTickMs: 250
} as const;

export const PET_INTERACTION = {
  angryClickThreshold: 5,
  dragThresholdPx: 4
} as const;

export const HUNGER_RULES = {
  max: 100,
  hungryThreshold: 10,
  decayIntervalMs: 60 * 1000,
  decayPerInterval: 1
} as const;

export const POINT_RULES = {
  interactionCooldownMs: 5000,
  pointsPerMinute: 10,
  pointsPerDay: 100,
  workPointsPerDay: 150,
  minInteractionReward: 1,
  maxInteractionReward: 2
} as const;
