const BULLET_SYMBOL = "\u25CF";
const BULLET_LINE_PATTERN = /^(\s*)(?:[-*]|\u2022|\u25CF)\s+/gm;

export function normalizeBulletTextInput(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(BULLET_LINE_PATTERN, `$1${BULLET_SYMBOL} `);
}

export function normalizeBulletTextForDisplay(value?: string | null): string {
  if (typeof value !== "string") return "";
  return normalizeBulletTextInput(value).trim();
}
