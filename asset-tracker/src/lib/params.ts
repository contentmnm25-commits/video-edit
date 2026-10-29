/** Read a single string from Next's searchParams record. */
export function param(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key];
  return typeof v === "string" && v.length ? v : undefined;
}

export function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export const isUuid = (v: string | undefined): v is string => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));
