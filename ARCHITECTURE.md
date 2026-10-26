# Architecture

A map of the codebase: what each file does, why it exists, and how a request flows from
the wire to the screen. For *using* the library, see [README.md](./README.md).

~3,400 lines across 28 source files. No runtime dependencies beyond `react` and
`react-native` peers.

---

## The one rule that shapes everything

**Logic lives in `src/core/`, presentation lives in `src/ui/`.**

`src/core/` and `src/export/` import nothing from `react` or `react-native`[^1]. That is
what lets `test/core.test.ts` exercise capture, redaction, search, the JSON tree, and
every export format in plain Node with no renderer and no simulator — 171 assertions in
under half a second.

When you add behaviour, put the decision in `core/` and let the component render the
result. The pattern already repeats four times: `search.ts` → `RequestList`,
`json.ts` → `JsonTree`, `bodyView.ts` → `RequestDetail`, `store.ts` → `useNetspect`.

[^1]: `export/session.ts` is the single exception — it touches `Clipboard` and `Share`.
`test/react-native-stub.ts` stands in for those four symbols.

---

## Layers

```
         host app
            │  Netspect.init(), <NetspectOverlay/>
            ▼
   ┌──────────────────┐
   │   src/index.ts   │  the entire public surface
   └──────────────────┘
            │
   ┌────────┴─────────┬──────────────────┬─────────────────┐
   ▼                  ▼                  ▼                 ▼
 core/              export/            info/              ui/
 capture,           cURL, text,        env + device       bubble, list,
 storage,           HAR, clipboard     (host-injected)    detail, tree
 redaction,                                                     │
 tree, search                                                   │
   ▲                                                            │
   └──────────────── reads, never the reverse ──────────────────┘
```

Dependencies point one way: `ui/` → `core/`. Nothing in `core/` knows a component exists.

---

## How one request becomes a row

```
app calls axios/fetch
  → XMLHttpRequest.prototype.send          core/xhrPatch.ts   (patched at startup)
  → readRequestBody(body)                  core/bodies.ts
  → store.push({ outcome:'pending' })      core/store.ts      → UI shows it in flight
  … network …
  → 'loadend' fires                        core/xhrPatch.ts
  → readResponseBody(xhr, outcome)         core/bodies.ts     (RN getter hazards handled here)
  → store.update(id, {...})                core/store.ts
  → coalesced notify                       core/store.ts      (one render per tick)
  → useSyncExternalStore                   ui/useNetspect.ts
  → <RequestList>                          ui/RequestList.tsx
```

Redaction is **not** in that path. The buffer holds raw values; masking happens when data
is shown or exported. See [Redaction](#redaction-happens-late) below.

---

## `src/core/` — capture, storage, and all pure logic

| File | Lines | Responsibility |
|---|--:|---|
| `xhrPatch.ts` | 199 | **The heart.** Patches `XMLHttpRequest.prototype.{open,send,setRequestHeader}` |
| `bodies.ts` | 200 | Reading request/response bodies safely out of an RN XHR |
| `store.ts` | 113 | Ring buffer, pub/sub, body-byte eviction |
| `redact.ts` | 118 | Header/body/env masking, applied at display time |
| `json.ts` | 353 | Paths, tree flattening, auto-expansion, copy text |
| `bodyView.ts` | 61 | Resolves which of six ways a body can be rendered |
| `search.ts` | 49 | Filter matching across URL, params, and bodies |
| `netspect.ts` | 59 | The public facade (`init`, `record`, `pause`, `clear`…) |
| `axiosCorrelate.ts` | 51 | Groups retries of one logical request |
| `id.ts` | 6 | Monotonic ids and a `performance.now()` shim |

### `xhrPatch.ts`

Patches the **prototype**, not the global constructor. Replacing the class would break
`instanceof` and the statics (`XMLHttpRequest.DONE`) and would fight other patchers;
prototype patching composes with Reactotron — each captures the previous function — and
also covers code that deep-imports `react-native/Libraries/Network/XMLHttpRequest`
instead of using the global.

Two non-obvious constraints are enforced here:

- **Only terminal events are subscribed** (`loadend`, `error`, `timeout`, `abort`). RN's
  `addEventListener` flips an internal `_incrementalEvents` flag for `readystatechange`
  and `progress` specifically, which changes native→JS bridge traffic for *every* request
  in the app. Subscribing to either would be a real performance regression.
- **The correlation header is swallowed** in `setRequestHeader` — recorded for grouping,
  never sent over the wire.

Per-instance state lives in a `WeakMap`, so a request abandoned before `send` leaves
nothing behind and no enumerable property is added to an object the app owns.

### `bodies.ts`

Three RN-specific hazards drive this file's shape, all documented inline:

1. `xhr.responseText` **throws** unless `responseType` is `''` or `'text'`.
2. The `response` getter for `'blob'` calls `BlobManager.createFromOptions()` and hands
   out a `Blob` **the app also owns** — a double release would free the native blob out
   from under the app. We read the private `_response` descriptor for its size instead.
3. The `response` getter for `'arraybuffer'` base64-decodes the whole payload on every
   read.

`FormData` is *described*, never read — pulling file bytes into a log buffer would defeat
the point of streaming an upload.

### `store.ts`

Newest-first array plus a `Map` index. Three things worth knowing:

- **Notifications are coalesced** to a macrotask. One login flow fires half a dozen
  requests in a tick, each with a start and a finish; without this that is a dozen list
  renders for one user action.
- **`getSnapshot` returns a stable identity** between mutations, which is what makes
  `useSyncExternalStore` safe under React 19 strict mode.
- **Bodies are evicted before entries.** Under memory pressure the oldest *payloads* are
  dropped while metadata is kept, so the list stays navigable after a heavy session.

### `json.ts`

The JSON tree, entirely pure. A path like `$.data.items[0].code` is simultaneously the
row id, the expanded-set member, and (minus the root) the human-readable copy path — one
canonical representation, no second source of truth.

`flattenJson` walks with an **explicit stack**, not recursion, and emits only rows whose
ancestors are expanded, so cost is proportional to what is visible rather than to the
whole document. `defaultExpanded` walks **breadth-first** with a node budget: BFS is what
makes a `{success, code, data:{…}}` envelope open all the way to the useful level instead
of spending the budget inside the first branch.

### `bodyView.ts`

`describeBody()` collapses every failure mode into one tagged union, so `RequestDetail`
has no branching logic of its own and each branch is testable:

| Mode | Cause |
|---|---|
| `tree` | parsed as JSON — the normal path |
| `truncated` | hit the 32 KB cap mid-JSON, so `JSON.parse` throws |
| `text` | not JSON at all (an HTML error page) |
| `binary` | a `<blob 48122 bytes>` placeholder |
| `evicted` | the body was dropped to stay under the byte budget |
| `none` | no body |

It also exports `isUnredactedFallback`, which exists because of a real gap — see below.

---

## `src/export/` — getting data out

| File | Lines | Responsibility |
|---|--:|---|
| `session.ts` | 111 | Clipboard/Share/file sinks; `exportEntry`, `exportBody`, `exportSession` |
| `har.ts` | 91 | HAR 1.2, openable in any HAR viewer |
| `text.ts` | 71 | Human-readable report; `statusLabel` |
| `curl.ts` | 52 | A copy-pasteable cURL command |

`session.ts` owns the only clipboard call. `copyToClipboard()` is exported so `JsonTree`
can copy a single node without re-implementing the
`getConfig().sinks.copy ?? Clipboard.setString` fallback.

Two details that look arbitrary but are not:

- **cURL uses `--data-raw`, not `-d`.** `-d` strips newlines, and an `@`-prefixed value
  would be read as a filename.
- **Large sessions go to a file, not `Share`.** Android's binder limit makes `Share` throw
  `TransactionTooLargeException` well before 1 MB, so anything over ~400 KB uses the
  `writeFile` sink when the host supplied one, falling back to the clipboard.

---

## `src/ui/` — presentation only

| File | Lines | Responsibility |
|---|--:|---|
| `RequestDetail.tsx` | 324 | Four tabs; **each owns its own scroll container** |
| `JsonTree.tsx` | 279 | Virtualized tree rows, selection, per-row copy |
| `parts/primitives.tsx` | 239 | `Btn` `Chip` `Segmented` `KV` `CodeBlock` `SearchInput` `SectionTitle` `Collapsible` |
| `FloatingBubble.tsx` | 193 | Draggable FAB with edge snapping |
| `RequestList.tsx` | 190 | Filterable list with retry-attempt badges |
| `NetspectOverlay.tsx` | 173 | The single exported component; modal host |
| `SettingsPanel.tsx` | 130 | Capture toggles, reveal gate, export, limits |
| `InfoPanel.tsx` | 33 | Env + device, from host-injected providers |
| `theme.ts` | 52 | Fixed dark palette, spacing, `statusColor()` |
| `useNetspect.ts` | 16 | `useSyncExternalStore` bridge to the store |

### Why `RequestDetail` has four scroll containers

It used to share one `<ScrollView>` across all tabs. A vertical `FlatList` cannot live
inside a vertical `ScrollView` — it warns, virtualizes incorrectly, and grows unbounded —
so introducing the tree forced each tab to own its scroller while the back button, URL,
and tab bar stay fixed above. Summary and cURL use `ScrollView`; the body tabs hand their
scrolling to `JsonTree`'s `FlatList` (with the headers block as `ListHeaderComponent`), or
fall back to a `ScrollView` for Raw.

### `FloatingBubble` without a gesture library

`PanResponder` + `Animated`, no `react-native-gesture-handler`. The wrapper fills the
screen with `pointerEvents="box-none"` so only the bubble takes touches and everything
else falls through to the app underneath. `onMoveShouldSetPanResponder` claims the gesture
only past a 6px threshold, so a tap still opens the inspector and a scroll starting on the
bubble is not stolen. `onPress` is held in a ref: the badge re-renders on every captured
request, and rebuilding the `PanResponder` mid-drag would drop the gesture.

### `JsonTree` interaction

- **Tap a container** → expand/collapse.
- **Tap a leaf** → select it.
- **Long-press anything** → select it (RN suppresses `onPress` when a long press fires, so
  a container can be selected without toggling).
- **Tap ⧉ on any row** → copy that node immediately; containers copy as a pretty subtree,
  leaves as the bare value.
- **Selection** → a sticky bar shows the full path with Value / Subtree / Path.

Every row reserves a 3px transparent left border so selecting one never shifts its text
sideways, and the pressed state is deliberately weaker than the selected state so
"touching" and "selected" never look alike.

`removeClippedSubviews` is deliberately **not** set — combined with `Pressable` rows on
Android it has a history of blanking text on fast scroll.

---

## Supporting files

| File | Purpose |
|---|---|
| `src/index.ts` | The entire public API. If it is not exported here, it is internal |
| `src/types.ts` | `NetspectEntry`, `NetspectConfig`, `InfoProviders`, `ExportSinks` |
| `src/config.ts` | Defaults + the runtime config holder; `getConfig()` / `setConfig()` |
| `src/info/collect.ts` | Merges host-injected providers with RN-core facts |
| `test/core.test.ts` | 171 assertions against a `FakeXHR` |
| `test/react-native-stub.ts` | Stubs `Platform`, `Dimensions`, `Share`, `Clipboard` |

### Why device info is injected, not read

`collect.ts` calls `getConfig().providers.env()` / `.device()` — functions the **host**
supplies. The library never imports `react-native-config` or `react-native-device-info`.

This is not stylistic. Metro resolves `require` statically at bundle time, so a
`try { require('react-native-device-info') } catch {}` would be a **build** failure in a
project without that package, not a catchable runtime error. Injection is the only way to
stay droppable into any RN project.

---

## Redaction happens late

**The buffer holds raw values. Masking is applied when data is shown or exported.**

The first implementation masked on the way *in*. That was destructive: it made the
"Reveal secrets" toggle structurally unable to reveal anything, and generated cURL
permanently un-runnable. Every display and export path now runs values through
`viewHeaders` / `viewBody` first.

The JSON tree inherits this for free — it is built from `viewBody(text, reveal)`, so rows
hold references into the *already redacted* parse. There is no second path from a tree
node back to the raw buffer, which is why partial copy cannot leak a token.

### Two known gaps, both pinned by tests

1. **`redactBodyText` returns its input unchanged when it cannot parse.** A truncated or
   non-JSON body containing a token is shown and copied in the clear even with Reveal off.
   `isUnredactedFallback()` detects this and the UI says so out loud rather than letting it
   pass silently.
2. **`redactNode` stops at depth 8** while the tree renders to depth 24, so a secret nested
   deeper than 8 levels is not masked.

Both are pre-existing, both are asserted in `test/core.test.ts` so they surface in the
suite rather than in production, and neither is a reason to skip the real control: gating
the overlay to non-production builds.

---

## Adding something

| You want to… | Touch |
|---|---|
| capture a new protocol | a new `core/*Patch.ts`, called from `core/netspect.ts` |
| change what a row shows | `ui/RequestList.tsx`; matching logic in `core/search.ts` |
| add an export format | `export/`, then wire into `export/session.ts` |
| mask something new | `src/config.ts` defaults — no code change needed |
| change tree behaviour | `core/json.ts` and add assertions; `ui/JsonTree.tsx` only renders |
| add a config knob | `types.ts` → `config.ts` defaults → read via `getConfig()` |

Before committing: `yarn typecheck && yarn test`.
