import "server-only";
import { getDb, type Db } from "./client";

export type { Db };

// Lazily-initialised so importing this module never opens a connection by itself.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
