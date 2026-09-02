export function formatInteger(value) {
  const number = normalizeNumber(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(number);
}

export function formatCompact(value) {
  const number = normalizeNumber(value);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: number >= 10000 ? 1 : 0,
  }).format(number).toLowerCase();
}

export function formatMetricValue(value, mode = "commas") {
  if (mode === "raw") return String(normalizeNumber(value));
  if (mode === "compact") return formatCompact(value);
  return formatInteger(value);
}

export function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    throw new TypeError("Expected a non-negative finite number.");
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError("Expected a non-negative finite number.");
  }
  return Math.floor(number);
}
