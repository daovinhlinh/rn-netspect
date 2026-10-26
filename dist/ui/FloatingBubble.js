"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloatingBubble = FloatingBubble;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const theme_1 = require("./theme");
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
function FloatingBubble({ count, onPress, }) {
    const { width, height } = (0, react_native_1.useWindowDimensions)();
    const initial = (0, react_1.useMemo)(() => {
        if (lastPosition.x >= 0)
            return { x: lastPosition.x, y: lastPosition.y };
        return { x: width - SIZE - MARGIN, y: height * 0.45 };
    }, [width, height]);
    const pan = (0, react_1.useRef)(new react_native_1.Animated.ValueXY(initial)).current;
    const scale = (0, react_1.useRef)(new react_native_1.Animated.Value(1)).current;
    // Read in the release handler, where the animated values' current numbers are needed.
    const position = (0, react_1.useRef)(initial);
    const dragged = (0, react_1.useRef)(false);
    // The badge re-renders on every captured request, so `onPress` is a fresh closure each
    // time. Going through a ref keeps the PanResponder stable — rebuilding it mid-drag
    // would drop the gesture.
    const onPressRef = (0, react_1.useRef)(onPress);
    onPressRef.current = onPress;
    const responder = (0, react_1.useMemo)(() => react_native_1.PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Claim the gesture only once it is clearly a drag, so a plain tap still fires
        // and so a touch that starts on the bubble but belongs to a scroll underneath
        // is not stolen.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > DRAG_SLOP || Math.abs(g.dy) > DRAG_SLOP,
        onPanResponderGrant: () => {
            dragged.current = false;
            pan.setOffset({ ...position.current });
            pan.setValue({ x: 0, y: 0 });
            react_native_1.Animated.spring(scale, {
                toValue: 1.12,
                useNativeDriver: true,
                friction: 7,
            }).start();
        },
        onPanResponderMove: (event, gesture) => {
            if (Math.abs(gesture.dx) > DRAG_SLOP ||
                Math.abs(gesture.dy) > DRAG_SLOP) {
                dragged.current = true;
            }
            react_native_1.Animated.event([null, { dx: pan.x, dy: pan.y }], {
                useNativeDriver: false,
            })(event, gesture);
        },
        onPanResponderRelease: (_e, gesture) => {
            pan.flattenOffset();
            react_native_1.Animated.spring(scale, {
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
            const snapX = rawX + SIZE / 2 < width / 2 ? MARGIN : width - SIZE - MARGIN;
            const snapY = Math.min(Math.max(rawY, EDGE_INSET), height - SIZE - EDGE_INSET);
            position.current = { x: snapX, y: snapY };
            lastPosition.x = snapX;
            lastPosition.y = snapY;
            react_native_1.Animated.spring(pan, {
                toValue: position.current,
                useNativeDriver: true,
                friction: 8,
                tension: 90,
            }).start();
        },
        onPanResponderTerminate: () => {
            pan.flattenOffset();
            react_native_1.Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                friction: 7,
            }).start();
        },
    }), [pan, scale, width, height]);
    return (
    // box-none: the wrapper fills the screen so the bubble can sit anywhere, but only
    // the bubble itself takes touches. Everything else falls through to the app beneath.
    react_1.default.createElement(react_native_1.View, { style: react_native_1.StyleSheet.absoluteFill, pointerEvents: "box-none" },
        react_1.default.createElement(react_native_1.Animated.View, { ...responder.panHandlers, style: [
                styles.bubble,
                { transform: [...pan.getTranslateTransform(), { scale }] },
            ] },
            react_1.default.createElement(react_native_1.Text, { style: styles.glyph }, "\u21C5"),
            count > 0 && (react_1.default.createElement(react_native_1.View, { style: styles.badge },
                react_1.default.createElement(react_native_1.Text, { style: styles.badgeLabel, numberOfLines: 1 }, count > 99 ? "99+" : count))))));
}
const styles = react_native_1.StyleSheet.create({
    bubble: {
        position: "absolute",
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: theme_1.T.bubble,
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
        paddingHorizontal: theme_1.S.xs,
        borderRadius: 10,
        backgroundColor: theme_1.T.error,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: theme_1.T.bg,
    },
    badgeLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
});
//# sourceMappingURL=FloatingBubble.js.map