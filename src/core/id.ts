let counter = 0;

/** Monotonic, collision-free within a session. Avoids a uuid dependency. */
export const nextId = (): string => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const now = (): number => globalThis.performance?.now?.() ?? Date.now();
