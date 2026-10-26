import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { collectInfo } from '../info/collect';
import { KV, SectionTitle } from './parts/primitives';
import { S, T } from './theme';

export function InfoPanel() {
  // Collected once per mount: these values do not change while the panel is open,
  // and `getUniqueId`-style providers can be slow.
  const sections = useMemo(() => collectInfo(), []);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <SectionTitle>{section.title}</SectionTitle>
          <KV rows={section.rows} />
        </View>
      ))}
      <Text style={styles.note}>
        Values for keys that look like credentials are masked. Everything here comes from
        providers the host app supplies.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: S.md, paddingBottom: S.xl },
  section: { marginBottom: S.xl },
  note: { color: T.textDim, fontSize: 11, fontStyle: 'italic' },
});
