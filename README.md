# rn-netspect

An in-app network inspector for React Native that **works in release builds**, opened from
a draggable floating bubble. Captures requests/responses, shows env & device info, and
exports a session as text, cURL, or HAR.

Built for the case Reactotron and Flipper can't cover: a tester hits a bug on an installed
staging APK/IPA and the only evidence is a screenshot.

**Zero runtime dependencies.** `react` and `react-native` peers, nothing else — no theming
library, no gesture library, no native modules to link.

---

## Install

It is a private git dependency. Add it to `dependencies`, pinned to a release tag:

```jsonc
// package.json
"rn-netspect": "git+https://github.com/daovinhlinh/rn-netspect.git#v0.1.0"
```

```sh
yarn install
```

No Metro config, no `tsconfig` paths, no `pod install` — there is no native code. The
package ships prebuilt CommonJS in `dist/` with type declarations, so nothing is compiled
at install time.

> **Use the full `git+https://` URL, not the `daovinhlinh/rn-netspect#v0.1.0` shorthand.**
> yarn 1 routes the shorthand through its GitHub resolver, which fetches an *unauthenticated*
> `codeload.github.com` tarball and therefore 404s on a private repo. The full URL falls
> through to yarn's plain git resolver, which shells out to real `git` and so picks up your
> credential helper. Upgrade with `yarn upgrade rn-netspect` after bumping the tag;
> `yarn.lock` pins the resolved commit, so installs stay reproducible.

### Developing against a local checkout

Installing from a tag means editing the library no longer shows up in the app. To iterate,
keep a sibling checkout and point Metro at it behind an env var — opt-in, so normal runs
keep the clean `node_modules` graph:

```js
// metro.config.js
const path = require('path');
const NETSPECT = path.resolve(__dirname, '../rn-netspect');
const NETSPECT_PKG = 'rn-netspect';

// Opt in with NETSPECT_LOCAL=1. Every piece below is required for an out-of-tree source
// directory; see the inline notes.
const localOverride = process.env.NETSPECT_LOCAL
  ? {
      watchFolders: [NETSPECT],
      resolver: {
        // This, not `extraNodeModules`, is what redirects the package. `extraNodeModules`
        // is only a *fallback* — Metro consults it after normal node_modules resolution
        // fails. Once rn-netspect is a real dependency that lookup succeeds, so an
        // `extraNodeModules: { 'rn-netspect': NETSPECT }` entry silently does nothing and
        // you keep bundling the installed copy while believing you are editing live.
        resolveRequest: (context, moduleName, platform) => {
          if (moduleName === NETSPECT_PKG || moduleName.startsWith(`${NETSPECT_PKG}/`)) {
            const subpath = moduleName.slice(NETSPECT_PKG.length + 1);
            return context.resolveRequest(
              // Resolve as if the request came from inside the checkout, so Metro applies
              // its normal extension and platform search to the source tree.
              { ...context, originModulePath: path.join(NETSPECT, 'package.json') },
              `./src/${subpath || 'index'}`,
              platform,
            );
          }
          return context.resolveRequest(context, moduleName, platform);
        },
        // Metro resolves bare imports relative to the importing file, so without this it
        // walks up from the sibling checkout, finds no node_modules, and fails — first on
        // the `@babel/runtime` helpers Babel injects into these files.
        nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
        extraNodeModules: {
          // Pin the app's single copies so there is no duplicate React.
          react: path.resolve(__dirname, 'node_modules/react'),
          'react-native': path.resolve(__dirname, 'node_modules/react-native'),
        },
        // The sibling repo is a watchFolder, so its own node_modules would be crawled as a
        // second copy of the module graph.
        blockList: [
          new RegExp(`^${path.join(NETSPECT, 'node_modules').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`),
        ],
      },
    }
  : {};

module.exports = mergeConfig(getDefaultConfig(__dirname), localOverride);
```

Confirm which copy you are actually bundling by checking the sourcemap rather than trusting
the flag — `sources` should name `rn-netspect/src/*.ts` with the override on and
`node_modules/rn-netspect/dist/*.js` with it off:

```sh
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output /tmp/b.js --sourcemap-output /tmp/b.map
node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/b.map','utf8'))
  .sources.filter(s => /netspect/.test(s)).slice(0, 3))"
```

```sh
NETSPECT_LOCAL=1 yarn start --reset-cache
```

`--reset-cache` is required when switching the flag either way. Note that Metro then reads
the sibling source while TypeScript still reads the installed `dist/`, so editor types lag
a local edit until the next `yarn build` in the library.

> **Do not** symlink the app's `node_modules` into the sibling checkout to make its
> typecheck work. The symlink lands inside `watchFolders`, so Metro crawls the app's entire
> module graph a second time through it and resolution breaks outright. Run `yarn install`
> in the sibling repo instead — `blockList` keeps it out of the app's graph.

## Use

Two integration points. **Start capture from your entry file**, before anything can fire a
request:

```ts
// index.js — must run before ./App is imported
import './netspect.install';
```

```ts
// netspect.install.ts
import Netspect from 'rn-netspect';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';

Netspect.init({
  enabled: __DEV__ || Config.ENV !== 'production',
  providers: {
    env: () => Config as unknown as Record<string, string | undefined>,
    device: () => ({
      appVersion: DeviceInfo.getVersion(),
      buildNumber: DeviceInfo.getBuildNumber(),
      bundleId: DeviceInfo.getBundleId(),
      model: DeviceInfo.getModel(),
      isEmulator: DeviceInfo.isEmulatorSync(),
    }),
  },
});
```

Then render the overlay **last** in your tree, so it paints above the navigator:

```tsx
<NetspectOverlay />
```

That's it. The XHR patch covers axios, `fetch`, and anything else built on
`XMLHttpRequest` — you do not hand it your HTTP client.

### Optional: group retries

```ts
Netspect.attachAxios(authAxiosInstance);
```

Stamps a correlation header that the interceptor records and then **strips before the
request is sent**, so a 401-refresh-replay or a 3× network retry reads as one row badged
`attempt 2/4` instead of as unrelated entries.

### Optional: log native traffic

```ts
Netspect.record({ method: 'GET', url, status: 200, durationMs: 412 });
```

## API

| Call | Purpose |
|---|---|
| `Netspect.init(config?)` | Installs the patch. Idempotent; a no-op when `enabled: false`. |
| `Netspect.configure(patch)` | Updates config at runtime. Merges `providers`/`sinks`. |
| `Netspect.pause()` / `.resume()` | Stop/start recording without removing the patch. |
| `Netspect.record(entry)` | Log a request the patch cannot see. |
| `Netspect.attachAxios(instance)` | Correlation stamping. Returns an eject function. |
| `Netspect.clear()` / `.getEntries()` / `.stats()` | Buffer access. |
| `Netspect.uninstall()` | Restore the original prototype methods (mainly for tests). |
| `<NetspectOverlay />` | Bubble + inspector. Renders `null` when disabled. |

Config defaults live in `src/config.ts`: 200 entries, 32 KB per body, a 4 MB global body
ceiling, and ignore patterns for Metro's own traffic and for image/video/font responses.

## Security

**This ships inside your binary.** Anyone holding the device can read every request URL,
payload, and response body for the account they are signed into.

**Redaction is applied when data is shown or exported, not when it is captured.** The
in-memory buffer holds raw values; every display and export path runs them through
`viewHeaders`/`viewBody` first. This is deliberate — masking at capture time would be
destructive, which would make the "Reveal secrets" toggle a lie and generated cURL
permanently un-runnable. It does mean the raw values live in the ring buffer, but they
already live in the app's own memory and in `xhr._response`; the buffer is not a new class
of exposure, and the overlay is what gates access to it.

Mitigations, all default-on:

- `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`, and `X-Api-Key` header
  values display as `Bearer ••••••••(len 847)` — prefix and length preserved, which is
  usually all you need to diagnose.
- JSON body keys matching `/(access|refresh|id)_?token|password|otp|pin|secret|…/i` are
  masked recursively, in the UI and in every export (report, HAR, and the body of
  generated cURL).
- Env values for keys ending in `KEY`/`SECRET`/`TOKEN`/`PASSWORD`/`CLIENT_ID`/`APP_ID` show
  as `first4…last4`.
- Unmasking requires the **Reveal secrets** toggle in Settings, which is in-memory only and
  resets on app restart. A masked cURL command carries a `# NOTE` explaining it will not
  authenticate as-is.

Redaction hides credentials, not business data. **The real control is `enabled`** — gate it
to non-production builds. For a true code strip, alias the package to a no-op module in your
production babel env.

## What it cannot capture

Anything that never reaches JavaScript:

- **Native file transfer** — `react-native-blob-util` / `ReactNativeBlobUtil.fetch()`,
  `react-native-fs` downloads.
- **WebSocket frames** — `WebSocket` is native in RN.
- Map tiles, push messaging, and native image loading.

Use `Netspect.record()` for those.

## Design notes

Things that look like style choices but are load-bearing:

- **The prototype is patched, not the global constructor.** Replacing the class breaks
  `instanceof` and the statics, and fights other patchers. Patching
  `XMLHttpRequest.prototype.{open,send,setRequestHeader}` composes with Reactotron (each
  captures the previous function) and also covers code that deep-imports
  `react-native/Libraries/Network/XMLHttpRequest` rather than using the global. In dev with
  Reactotron attached, both tools log the same traffic — expected, not a bug.
- **Only terminal events are subscribed** (`loadend`, `error`, `timeout`, `abort`). RN's
  `addEventListener` flips `_incrementalEvents = true` for `readystatechange` and
  `progress` specifically, which changes native→JS bridge traffic for *every* request in
  the app.
- **`xhr.response` is never read for `blob`.** That getter calls
  `BlobManager.createFromOptions()` and hands out a `Blob` the app also owns; a double
  release would free the native blob out from under the app. The private `_response`
  descriptor is read for its size instead. `arraybuffer` is skipped for a cheaper reason —
  its getter base64-decodes the whole payload on every read.
- **`responseText` is never read** unless `responseType` is `''` or `'text'`; the getter
  throws otherwise.
- **`FormData` is described, never read.** Pulling file bytes into a log buffer would
  defeat the point of streaming an upload.
- **Generated cURL uses `--data-raw`,** not `-d`: `-d` strips newlines and an `@`-prefixed
  value would be read as a filename.
- **Store notifications are coalesced** to a microtask. One login flow fires half a dozen
  requests in a tick, each with a start and a finish; without coalescing that is a dozen
  list renders for one user action.
- **Bodies are evicted before entries.** Under memory pressure the oldest payloads are
  dropped while metadata is kept, so the list stays navigable after a heavy session.
- **The UI uses plain `react-native` `StyleSheet` and a fixed dark palette.** A debug
  overlay should look identical in every host app, and binding to the host's theme is
  exactly what would make this non-portable. If your project has a lint rule mandating a
  theming library for all styles, this package is deliberately exempt — keep it outside the
  rule's glob (any directory other than your app's `src/`).

## Development

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for a file-by-file map of the codebase, the
request→row data flow, and the reasoning behind the non-obvious parts.

```
yarn install
yarn test        # assertions against a fake XHR, in plain node — no simulator
yarn typecheck
yarn build       # emit dist/ (CommonJS + .d.ts)
```

`test/core.test.ts` drives the capture core through a `FakeXHR` that reproduces the RN
hazards above — a throwing `responseText` getter and instrumented `response` getters that
fail the suite if the blob/arraybuffer paths are ever read. It also asserts that nothing
subscribes to `readystatechange`/`progress`, that the correlation header never reaches the
wire, and that no export path leaks a secret while masked. `test/react-native-stub.ts`
stands in for `react-native` so the suite needs no simulator.

## Releasing

```sh
yarn version --new-version 0.1.1
```

That one command is the whole release. The lifecycle hooks run `yarn test` and
`yarn typecheck`, then `yarn build`, then stage `dist/` into the version commit, tag it, and
push with `--follow-tags`. Consumers bump the tag in their `package.json` and
`yarn upgrade rn-netspect`.

**`dist/` is committed, not gitignored.** That is deliberate for a git dependency: yarn
clones the tag and uses the tree as-is, so a consumer's `yarn install` needs no TypeScript,
no `prepare` script, and has no build step that can fail on someone else's machine. The
cost is that `dist/` shows as dirty while you work on `src/`; the `version` hook rebuilds it
from scratch at release, so whatever is committed always matches the tagged source.

## Roadmap

WebSocket frame capture · native file-transfer capture · request mocking and overrides ·
network throttling · console-log capture · persistence across restarts.
