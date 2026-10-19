// Preserve saved color keys. Answer surfaces stay neutral; only symbols carry
// identity colors, shared by the presenter and player. Red/green mark results.
const neutralOption = {
  bg: 'bg-surface-soft', hover: 'hover:bg-surface-hover active:bg-surface-hover',
  border: 'border-line', text: 'text-ink',
  ring: 'focus:ring-petrolio', shadow: 'shadow-petrolio/10',
};
export const OPTION_COLORS = {
  red: { ...neutralOption, badge: 'bg-white text-violet-700' },
  blue: { ...neutralOption, badge: 'bg-white text-blue-700' },
  yellow: { ...neutralOption, badge: 'bg-white text-amber-700' },
  green: { ...neutralOption, badge: 'bg-white text-cyan-700' },
  purple: { ...neutralOption, badge: 'bg-white text-fuchsia-700' },
  orange: { ...neutralOption, badge: 'bg-white text-orange-700' },
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
