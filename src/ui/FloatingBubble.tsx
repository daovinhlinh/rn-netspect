import React, { useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { S, T } from "./theme";

const SIZE = 52;
const MARGIN = 10;
/** Below this travel the gesture is treated as a tap, not a drag. */
const DRAG_SLOP = 6;
/** Keeps the bubble clear of the status bar and home indicator without a safe-area dep. */
const EDGE_INSET = 56;

/**
 * Survives unmount/remount (e.g. the host toggling the overlay) so the bubble does not
 * jump back to its default corner. Module scope is the right lifetime here — it is one
 * bubble per app.
 */
const lastPosition = { x: -1, y: -1 };

export function FloatingBubble({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const { width, height } = useWindowDimensions();

  const initial = useMemo(() => {
    if (lastPosition.x >= 0) return { x: lastPosition.x, y: lastPosition.y };
    return { x: width - SIZE - MARGIN, y: height * 0.45 };
  }, [width, height]);

  const pan = useRef(new Animated.ValueXY(initial)).current;
  const scale = useRef(new Animated.Value(1)).current;
  // Read in the release handler, where the animated values' current numbers are needed.
  const position = useRef(initial);
  const dragged = useRef(false);

  // The badge re-renders on every captured request, so `onPress` is a fresh closure each
  // time. Going through a ref keeps the PanResponder stable — rebuilding it mid-drag
  // would drop the gesture.
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Claim the gesture only once it is clearly a drag, so a plain tap still fires
        // and so a touch that starts on the bubble but belongs to a scroll underneath
        // is not stolen.
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > DRAG_SLOP || Math.abs(g.dy) > DRAG_SLOP,

        onPanResponderGrant: () => {
          dragged.current = false;
          pan.setOffset({ ...position.current });
          pan.setValue({ x: 0, y: 0 });
          Animated.spring(scale, {
            toValue: 1.12,
            useNativeDriver: true,
            friction: 7,
          }).start();
        },

        onPanResponderMove: (event, gesture) => {
          if (
            Math.abs(gesture.dx) > DRAG_SLOP ||
            Math.abs(gesture.dy) > DRAG_SLOP
          ) {
            dragged.current = true;
          }
          Animated.event([null, { dx: pan.x, dy: pan.y }], {
            useNativeDriver: false,
          })(event, gesture);
        },

        onPanResponderRelease: (_e, gesture) => {
          pan.flattenOffset();
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 7,
          }).start();

          if (!dragged.current) {
            onPressRef.current();
            return;
          }

          const rawX = position.current.x + gesture.dx;
          const rawY = position.current.y + gesture.dy;
          // Snap to whichever vertical edge the bubble's centre is nearer.
          const snapX =
            rawX + SIZE / 2 < width / 2 ? MARGIN : width - SIZE - MARGIN;
          const snapY = Math.min(
            Math.max(rawY, EDGE_INSET),
            height - SIZE - EDGE_INSET,
          );

          position.current = { x: snapX, y: snapY };
          lastPosition.x = snapX;
          lastPosition.y = snapY;

          Animated.spring(pan, {
            toValue: position.current,
            useNativeDriver: true,
            friction: 8,
            tension: 90,
          }).start();
        },

        onPanResponderTerminate: () => {
          pan.flattenOffset();
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 7,
          }).start();
        },
      }),
    [pan, scale, width, height],
  );

  return (
    // box-none: the wrapper fills the screen so the bubble can sit anywhere, but only
    // the bubble itself takes touches. Everything else falls through to the app beneath.
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.bubble,
          { transform: [...pan.getTranslateTransform(), { scale }] },
        ]}
      >
        <Text style={styles.glyph}>⇅</Text>
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel} numberOfLines={1}>
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: T.bubble,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
    // Elevation keeps it above native-stack screens on Android.
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  glyph: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 22,
    height: 20,
    paddingHorizontal: S.xs,
    borderRadius: 10,
    backgroundColor: T.error,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: T.bg,
  },
  badgeLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
});
