"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEntries = void 0;
exports.useEntry = useEntry;
const react_1 = require("react");
const store_1 = require("../core/store");
/** `getSnapshot` returns a stable identity between mutations, so this is strict-mode safe. */
const useEntries = () => (0, react_1.useSyncExternalStore)(store_1.store.subscribe, store_1.store.getSnapshot, store_1.store.getSnapshot);
exports.useEntries = useEntries;
function useEntry(id) {
    const entries = (0, exports.useEntries)();
    if (!id)
        return undefined;
    // Reading through the snapshot (rather than `store.get`) keeps this subscribed to
    // updates, so the detail view live-updates while a request is still pending.
    return entries.find((entry) => entry.id === id);
}
//# sourceMappingURL=useNetspect.js.map