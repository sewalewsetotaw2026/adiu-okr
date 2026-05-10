const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function formatOkrNumber(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions,
) {
  const normalized = Number(value ?? 0);
  if (!Number.isFinite(normalized)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    ...options,
  }).format(normalized);
}

export function formatOkrPercent(value: number | string | null | undefined) {
  return `${formatOkrNumber(value)}%`;
}

export function formatOkrCount(value: number | string | null | undefined) {
  return numberFormatter.format(Number(value ?? 0) || 0);
}
