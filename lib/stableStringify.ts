const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === "[object Object]";

const sortObject = (value: Record<string, unknown>): Record<string, unknown> => {
  const entries = Object.entries(value)
    .map(([key, v]) => [key, normalize(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return entries.reduce<Record<string, unknown>>((acc, [key, v]) => {
    acc[key] = v;
    return acc;
  }, {});
};

const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (isPlainObject(value)) {
    return sortObject(value);
  }

  return value;
};

export const stableStringify = (value: unknown): string =>
  JSON.stringify(normalize(value));
