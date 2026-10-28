import { SnowEffect } from './effects.js?v=13';
import { RainEffect } from './rain-effect.js?v=13';
// Future effects register here; application and control-panel code stay weather-independent.
export const weatherDefinitions = [
  { id: 'snow', label: 'Snow', title: 'Snowfall', particleLabel: 'flakes', create: () => new SnowEffect() },
  { id: 'rain', label: 'Rain', title: 'Rainfall', particleLabel: 'drops', create: () => new RainEffect() },
];
