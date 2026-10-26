import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { prettyJson } from '../core/bodies';
import { describeBody, isUnredactedFallback, type BodyView } from '../core/bodyView';
import { viewHeaders } from '../core/redact';
import { toCurl } from '../export/curl';
import { exportBody, exportEntry } from '../export/session';
import { statusLabel } from '../export/text';
import type { NetspectEntry } from '../types';
import { JsonTree } from './JsonTree';
import { Btn, CodeBlock, Collapsible, KV, SectionTitle, Segmented } from './parts/primitives';
import { S, statusColor, T } from './theme';

const TABS = ['Summary', 'Request', 'Response', 'cURL'] as const;
type Tab = (typeof TABS)[number];

const VIEWS = ['Tree', 'Raw'] as const;
type BodyMode = (typeof VIEWS)[number];

/**
 * Header sections remember their state for the session, the way `FloatingBubble` keeps
 * its position. Defaults differ per tab: response headers are mostly noise, while request
 * headers (auth, device, version) are more often what you opened the entry to check.
 */
const headersOpen = { request: true, response: false };

type Which = 'request' | 'response';

export function RequestDetail({
  entry,
  reveal,
  onBack,
  onToast,
}: {
  entry: NetspectEntry;
  reveal: boolean;
  onBack: () => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('Summary');
  const color = statusColor(entry.status, entry.outcome);

  const run = async (format: 'text' | 'curl' | 'har') => {
    const result = await exportEntry(entry, format, { reveal });
    onToast(result.message);
  };

  const copyBody = async (which: Which) => {
    const result = await exportBody(entry, which, { reveal });
    onToast(result.message);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Btn label="‹ Back" onPress={onBack} />
        <View style={[styles.statusPill, { borderColor: color }]}>
          <Text style={[styles.statusText, { color }]}>{statusLabel(entry)}</Text>
        </View>
        <Text style={styles.duration}>{entry.durationMs}ms</Text>
      </View>

      <Text style={styles.url} selectable>
        <Text style={styles.method}>{entry.method} </Text>
        {entry.url}
      </Text>

      <View style={styles.tabs}>
        <Segmented tabs={TABS} value={tab} onChange={setTab} />
      </View>

      {/* Exactly one pane, each flex:1 with its own scroll container. A vertical FlatList
          cannot live inside a shared vertical ScrollView, so the tree forces this split. */}
      {tab === 'Summary' && <SummaryTab entry={entry} onRun={run} onCopyBody={copyBody} />}
      {tab === 'Request' && (
        <BodyTab which="request" entry={entry} reveal={reveal} onToast={onToast} onCopyBody={copyBody} />
      )}
      {tab === 'Response' && (
        <BodyTab which="response" entry={entry} reveal={reveal} onToast={onToast} onCopyBody={copyBody} />
      )}
      {tab === 'cURL' && <CurlTab entry={entry} reveal={reveal} onRun={run} />}
    </View>
  );
}

function SummaryTab({
  entry,
  onRun,
  onCopyBody,
}: {
  entry: NetspectEntry;
  onRun: (format: 'text' | 'curl' | 'har') => void;
  onCopyBody: (which: Which) => void;
}) {
  return (
    <ScrollView style={styles.pane} contentContainerStyle={styles.paneContent}>
      <SectionTitle>Overview</SectionTitle>
      <KV
        rows={[
          ['outcome', entry.outcome],
          ['status', String(entry.status || '—')],
          ['duration', `${entry.durationMs}ms`],
          ['started', new Date(entry.startedAt).toISOString()],
          ['response size', `${entry.responseBodyBytes} chars`],
          ...(entry.responseUrl && entry.responseUrl !== entry.url
            ? ([['redirected to', entry.responseUrl]] as Array<[string, string]>)
            : []),
          ...(entry.correlationId
            ? ([['correlation', entry.correlationId]] as Array<[string, string]>)
            : []),
        ]}
      />
      <View style={styles.actions}>
        <Btn
          label="Copy response"
          onPress={() => onCopyBody('response')}
          tone="accent"
          disabled={!entry.responseBody || entry.bodyEvicted}
        />
        <Btn label="Copy report" onPress={() => onRun('text')} tone="accent" />
        <Btn label="Copy cURL" onPress={() => onRun('curl')} tone="accent" />
        <Btn label="Share HAR" onPress={() => onRun('har')} />
      </View>
    </ScrollView>
  );
}

function BodyTab({
  which,
  entry,
  reveal,
  onToast,
  onCopyBody,
}: {
  which: Which;
  entry: NetspectEntry;
  reveal: boolean;
  onToast: (message: string) => void;
  onCopyBody: (which: Which) => void;
}) {
  const [openHeaders, setOpenHeaders] = useState(headersOpen[which]);
  const [view, setView] = useState<BodyMode>('Tree');

  const headers = which === 'request' ? entry.requestHeaders : entry.responseHeaders;
  const headerRows = useMemo(
    () => Object.entries(viewHeaders(headers, reveal)),
    [headers, reveal],
  );
  const body = useMemo(() => describeBody(entry, which, reveal), [entry, which, reveal]);

  const toggleHeaders = () => {
    const next = !openHeaders;
    headersOpen[which] = next;
    setOpenHeaders(next);
  };

  const isFormData = which === 'request' && entry.requestBodyKind === 'formdata';

  const headerBlock = (
    <>
      <Collapsible title="Headers" count={headerRows.length} open={openHeaders} onToggle={toggleHeaders}>
        <KV rows={headerRows} />
      </Collapsible>
      <View style={styles.gap} />
      <SectionTitle>Body</SectionTitle>
    </>
  );

  // The tree owns its own FlatList, so it replaces the pane's scroll container entirely.
  if (body.mode === 'tree' && view === 'Tree' && !isFormData) {
    return (
      <View style={styles.pane}>
        <View style={styles.toolbar}>
          <View style={styles.toolbarSeg}>
            <Segmented tabs={VIEWS} value={view} onChange={setView} />
          </View>
        </View>
        <JsonTree
          // Resets expansion and selection when the entry or the reveal state changes.
          key={`${entry.id}:${which}:${reveal}`}
          root={body.value}
          truncated={body.truncated}
          listHeader={headerBlock}
          onToast={onToast}
          onCopyWhole={() => onCopyBody(which)}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.pane} contentContainerStyle={styles.paneContent}>
      {body.mode === 'tree' && !isFormData && (
        <View style={styles.toolbarSeg}>
          <Segmented tabs={VIEWS} value={view} onChange={setView} />
        </View>
      )}
      {headerBlock}
      <RawBody
        which={which}
        entry={entry}
        body={body}
        reveal={reveal}
        isFormData={isFormData}
        onCopyBody={onCopyBody}
      />
    </ScrollView>
  );
}

function RawBody({
  which,
  entry,
  body,
  reveal,
  isFormData,
  onCopyBody,
}: {
  which: Which;
  entry: NetspectEntry;
  body: BodyView;
  reveal: boolean;
  isFormData: boolean;
  onCopyBody: (which: Which) => void;
}) {
  if (isFormData) {
    return (
      <KV
        rows={(entry.formParts ?? []).map(
          (part) =>
            [part.name, part.filename ? `<file ${part.filename}>` : (part.value ?? '')] as [
              string,
              string,
            ],
        )}
      />
    );
  }

  if (body.mode === 'evicted') {
    return (
      <Text style={styles.warn}>
        Body was dropped to stay under the memory budget. Metadata above is intact.
      </Text>
    );
  }

  if (body.mode === 'none') return <Text style={styles.dim}>(empty)</Text>;
  if (body.mode === 'binary') return <Text style={styles.dim}>{body.text}</Text>;

  const bytes = which === 'request' ? entry.requestBody?.length ?? 0 : entry.responseBodyBytes;

  return (
    <>
      <CodeBlock text={prettyJson(body.text)} />
      {body.mode === 'truncated' && (
        <Text style={styles.warn}>
          Truncated mid-JSON at {bytes.toLocaleString()} chars — cannot build a tree.
        </Text>
      )}
      {body.mode === 'tree' && body.truncated && (
        <Text style={styles.warn}>Truncated — the tail of this body is missing.</Text>
      )}
      {/* `redactBodyText` passes a body through untouched when it cannot parse it, so this
          is shown in the clear despite Reveal being off. Say so rather than hide it. */}
      {isUnredactedFallback(body, reveal) && (
        <Text style={styles.warn}>Not redacted — this body could not be parsed as JSON.</Text>
      )}
      <View style={styles.actions}>
        <Btn label="Copy JSON" onPress={() => onCopyBody(which)} tone="accent" />
      </View>
    </>
  );
}

function CurlTab({
  entry,
  reveal,
  onRun,
}: {
  entry: NetspectEntry;
  reveal: boolean;
  onRun: (format: 'text' | 'curl' | 'har') => void;
}) {
  return (
    <ScrollView style={styles.pane} contentContainerStyle={styles.paneContent}>
      <SectionTitle>{reveal ? 'Runnable' : 'Secrets masked'}</SectionTitle>
      <CodeBlock text={toCurl(entry, { reveal })} />
      <View style={styles.actions}>
        <Btn label="Copy cURL" onPress={() => onRun('curl')} tone="accent" />
      </View>
      {!reveal && (
        <Text style={styles.warn}>
          Turn on &ldquo;Reveal secrets&rdquo; in Settings to copy a command that will actually
          authenticate.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.md },
  statusPill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: S.sm, paddingVertical: 2 },
  statusText: { fontSize: 12, fontWeight: '700' },
  duration: { marginLeft: 'auto', color: T.textDim, fontSize: 12 },

  url: { color: T.text, fontSize: 12, paddingHorizontal: S.md, paddingTop: S.sm },
  method: { color: T.accent, fontWeight: '800' },

  tabs: { padding: S.md },
  pane: { flex: 1 },
  paneContent: { paddingHorizontal: S.md, paddingBottom: S.xl },

  toolbar: { paddingHorizontal: S.md },
  toolbarSeg: { maxWidth: 180 },

  gap: { height: S.lg },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg, flexWrap: 'wrap' },
  warn: { color: T.warn, fontSize: 12, marginTop: S.sm },
  dim: { color: T.textDim, fontSize: 12, fontStyle: 'italic' },
});
