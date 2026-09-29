/**
 * Re-export all domain models from domain.ts
 * Providing backward compatibility aliases for existing UI and components
 */

export type * from './domain.ts';

// Backward compatibility aliases
import type {
  CultureSource,
  AdaptiveAdjustment,
  Event,
  Character,
} from './domain.ts';

export type Source = CultureSource;
export type AdaptiveRule = AdaptiveAdjustment;
export type EventItem = Event;
export type CharacterItem = Character;
export type WeatherItem = import('./domain.ts').WeatherContext;
