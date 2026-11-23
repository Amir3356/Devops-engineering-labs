/**
 * Small helpers shared by the models to read backend payloads safely.
 * Backend services are not consistent (snake_case from Postgres rows,
 * camelCase from model.toJSON()), so models read fields through these.
 */

/** Return the first value that is not undefined/null among the given keys. */
export const pick = (raw, ...keys) => {
  if (!raw) return undefined;
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return undefined;
};

export const toNumber = (value, fallback = 0) => {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

export const toInt = (value, fallback = 0) => {
  const n = typeof value === 'number' ? Math.trunc(value) : parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const toStr = (value, fallback = '') =>
  value === undefined || value === null ? fallback : String(value).trim();

/** ISO string or null. */
export const toIsoDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Map an array (or anything) through a factory, dropping empty results. */
export const listOf = (factory) => (rows) =>
  Array.isArray(rows) ? rows.map(factory).filter(Boolean) : [];
