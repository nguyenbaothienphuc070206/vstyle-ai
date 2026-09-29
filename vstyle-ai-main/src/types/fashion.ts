/**
 * Re-export all domain models from domain.ts
 * Providing backward compatibility aliases for existing UI and components
 */

export * from './domain';

// Backward compatibility aliases
import {
  CultureSource,
  AdaptiveAdjustment,
  Event,
  Character,
} from './domain';

export type Source = CultureSource;
export type AdaptiveRule = AdaptiveAdjustment;
export type EventItem = Event;
export type CharacterItem = Character;
export type WeatherItem = import('./domain').WeatherContext;
