/** Replaces {name} placeholders in a translated string. */
export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => key in values ? String(values[key]) : match);
