import { LEVEL_TIERS } from '../types/index.js';

export function calculateLevel(xp: number): number {
  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_TIERS[i].minXp) {
      return LEVEL_TIERS[i].level;
    }
  }
  return 1;
}

export function getFlairForLevel(level: number): string {
  const tier = LEVEL_TIERS.find(t => t.level === level);
  return tier ? tier.flair : LEVEL_TIERS[0].flair;
}
