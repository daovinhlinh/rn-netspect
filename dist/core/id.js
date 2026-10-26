"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.now = exports.nextId = void 0;
let counter = 0;
/** Monotonic, collision-free within a session. Avoids a uuid dependency. */
const nextId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;
exports.nextId = nextId;
const now = () => globalThis.performance?.now?.() ?? Date.now();
exports.now = now;
//# sourceMappingURL=id.js.map