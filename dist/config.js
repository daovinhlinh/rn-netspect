"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIgnoredContentType = exports.isIgnoredUrl = exports.getConfig = exports.DEFAULTS = void 0;
exports.setConfig = setConfig;
exports.resetConfig = resetConfig;
exports.DEFAULTS = {
    enabled: true,
    captureBodies: true,
    maxEntries: 200,
    maxBodyBytes: 32 * 1024,
    maxTotalBodyBytes: 4 * 1024 * 1024,
    // Metro's own chatter would otherwise bury real traffic in dev.
    ignoreUrls: [/\/(symbolicate|logs|inspector)\b/, /\/hot\b/, /localhost:8081/, /10\.0\.2\.2:8081/],
    ignoreContentTypes: [/^(image|video|audio|font)\//i],
    redactHeaders: ['authorization', 'cookie', 'set-cookie', 'proxy-authorization', 'x-api-key'],
    redactBodyKeys: /(access|refresh|id)_?token|password|passcode|otp|\bpin\b|secret|credential|cvv|authorization/i,
    redactEnvKeys: /(KEY|SECRET|TOKEN|PASSWORD|CLIENT_ID|CLIENT_TOKEN|APP_ID)$/,
    providers: {},
    sinks: {},
};
let current = { ...exports.DEFAULTS };
const getConfig = () => current;
exports.getConfig = getConfig;
function setConfig(patch) {
    current = {
        ...current,
        ...patch,
        // Nested objects are merged rather than replaced, so a host can add one sink
        // or one provider without having to restate the others.
        providers: { ...current.providers, ...patch.providers },
        sinks: { ...current.sinks, ...patch.sinks },
    };
}
function resetConfig() {
    current = { ...exports.DEFAULTS };
}
const isIgnoredUrl = (url) => current.ignoreUrls.some((re) => re.test(url));
exports.isIgnoredUrl = isIgnoredUrl;
const isIgnoredContentType = (contentType) => !!contentType && current.ignoreContentTypes.some((re) => re.test(contentType));
exports.isIgnoredContentType = isIgnoredContentType;
//# sourceMappingURL=config.js.map