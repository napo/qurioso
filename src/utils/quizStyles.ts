import React from 'react';

// Answer keys remain compatible with saved quizzes; shapes distinguish options.
// All answer surfaces now use tints of the original petrolio/mandarino palette.
const petrolioOption = {
  bg: 'bg-surface-soft', hover: 'hover:bg-surface-hover active:bg-surface-hover',
  border: 'border-petrolio', text: 'text-ink', badge: 'bg-white text-petrolio',
  ring: 'focus:ring-petrolio', shadow: 'shadow-petrolio/10',
};
const mandarinoOption = {
  bg: 'bg-[#fff2e6]', hover: 'hover:bg-[#ffe3c9] active:bg-[#ffe3c9]',
  border: 'border-mandarino', text: 'text-ink', badge: 'bg-white text-accent-ink',
  ring: 'focus:ring-petrolio', shadow: 'shadow-mandarino/10',
};
export const OPTION_COLORS = {
  red: mandarinoOption,
  blue: petrolioOption,
  yellow: { ...mandarinoOption, bg: 'bg-white' },
  green: { ...petrolioOption, bg: 'bg-white' },
  purple: { ...petrolioOption, bg: 'bg-surface-hover' },
  orange: { ...mandarinoOption, bg: 'bg-[#ffe3c9]' },
};

export const COLOR_KEYS: ('red' | 'blue' | 'yellow' | 'green' | 'purple' | 'orange')[] = [
  'red',
  'blue',
  'yellow',
  'green',
  'purple',
  'orange',
];

export const SHAPE_KEYS: ('triangle' | 'diamond' | 'circle' | 'square' | 'star' | 'hexagon')[] = [
  'triangle',
  'diamond',
  'circle',
  'square',
  'star',
  'hexagon',
];

export const SHAPE_ICONS: Record<string, string> = {
  triangle: '▲',
  diamond: '◆',
  circle: '●',
  square: '■',
  star: '★',
  hexagon: '⬢',
};
