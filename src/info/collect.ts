import { Dimensions, Platform } from 'react-native';

import { getConfig } from '../config';
import { redactEnv } from '../core/redact';

export type InfoSection = { title: string; rows: Array<[string, string]> };

/** Facts available from RN core alone — no native-module dependency. */
function runtimeRows(): Array<[string, string]> {
  const { width, height, scale } = Dimensions.get('window');
  const hermes = (globalThis as any).HermesInternal;
  return [
    ['platform', Platform.OS],
    ['platformVersion', String(Platform.Version)],
    ['__DEV__', String(__DEV__)],
    ['engine', hermes ? 'Hermes' : 'JSC'],
    ...(hermes?.getRuntimeProperties
      ? ([['hermesVersion', String(hermes.getRuntimeProperties()['OSS Release Version'] ?? '?')]] as Array<
          [string, string]
        >)
      : []),
    ['window', `${Math.round(width)}×${Math.round(height)} @${scale}x`],
    ...(Platform.OS === 'ios'
      ? ([['isPad', String((Platform as any).isPad ?? false)]] as Array<[string, string]>)
      : []),
  ];
}

export function collectInfo(): InfoSection[] {
  const { providers } = getConfig();
  const sections: InfoSection[] = [];

  if (providers.device) {
    try {
      const device = providers.device();
      sections.push({
        title: 'App & device',
        rows: Object.keys(device)
          .sort()
          .filter((key) => device[key] != null)
          .map((key) => [key, String(device[key])] as [string, string]),
      });
    } catch (error) {
      sections.push({ title: 'App & device', rows: [['error', String(error)]] });
    }
  }

  sections.push({ title: 'Runtime', rows: runtimeRows() });

  if (providers.env) {
    try {
      const env = redactEnv(providers.env());
      sections.push({
        title: 'Environment',
        rows: Object.entries(env) as Array<[string, string]>,
      });
    } catch (error) {
      sections.push({ title: 'Environment', rows: [['error', String(error)]] });
    }
  }

  return sections;
}
