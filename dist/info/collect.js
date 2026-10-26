"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectInfo = collectInfo;
const react_native_1 = require("react-native");
const config_1 = require("../config");
const redact_1 = require("../core/redact");
/** Facts available from RN core alone — no native-module dependency. */
function runtimeRows() {
    const { width, height, scale } = react_native_1.Dimensions.get('window');
    const hermes = globalThis.HermesInternal;
    return [
        ['platform', react_native_1.Platform.OS],
        ['platformVersion', String(react_native_1.Platform.Version)],
        ['__DEV__', String(__DEV__)],
        ['engine', hermes ? 'Hermes' : 'JSC'],
        ...(hermes?.getRuntimeProperties
            ? [['hermesVersion', String(hermes.getRuntimeProperties()['OSS Release Version'] ?? '?')]]
            : []),
        ['window', `${Math.round(width)}×${Math.round(height)} @${scale}x`],
        ...(react_native_1.Platform.OS === 'ios'
            ? [['isPad', String(react_native_1.Platform.isPad ?? false)]]
            : []),
    ];
}
function collectInfo() {
    const { providers } = (0, config_1.getConfig)();
    const sections = [];
    if (providers.device) {
        try {
            const device = providers.device();
            sections.push({
                title: 'App & device',
                rows: Object.keys(device)
                    .sort()
                    .filter((key) => device[key] != null)
                    .map((key) => [key, String(device[key])]),
            });
        }
        catch (error) {
            sections.push({ title: 'App & device', rows: [['error', String(error)]] });
        }
    }
    sections.push({ title: 'Runtime', rows: runtimeRows() });
    if (providers.env) {
        try {
            const env = (0, redact_1.redactEnv)(providers.env());
            sections.push({
                title: 'Environment',
                rows: Object.entries(env),
            });
        }
        catch (error) {
            sections.push({ title: 'Environment', rows: [['error', String(error)]] });
        }
    }
    return sections;
}
//# sourceMappingURL=collect.js.map