import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  useColorScheme,
  View,
} from "react-native";

const GLASS_WIDTH = 68;
const GLASS_HEIGHT = 86;
const BEER_TOP = 8;
const FOAM = [
  { left: -6, top: -12, size: 26 },
  { left: 12, top: -18, size: 30 },
  { left: 34, top: -15, size: 28 },
  { left: 52, top: -9, size: 24 },
];
const BUBBLES = [
  { left: 14, size: 5, delay: 0 },
  { left: 30, size: 4, delay: 500 },
  { left: 44, size: 6, delay: 250 },
  { left: 22, size: 3, delay: 900 },
];

/**
 * A beer for finishing a quiz, drawn with views: the glass pours full, the
 * head foams up over the rim and the mug tips as if for a toast, then bubbles
 * keep rising. Everything runs on the native driver; Reduce Motion shows the
 * full glass straight away.
 */
export default function BeerMug() {
  const dark = useColorScheme() === "dark";
  const [values] = useState(() => ({
    enter: new Animated.Value(0),
    fill: new Animated.Value(0),
    foam: FOAM.map(() => new Animated.Value(0)),
    tilt: new Animated.Value(0),
    bubbles: BUBBLES.map(() => new Animated.Value(0)),
  }));
  const [still, setStill] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loops: Animated.CompositeAnimation[] = [];
    let pour: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        values.enter.setValue(1);
        values.fill.setValue(1);
        values.foam.forEach((foam) => foam.setValue(1));
        setStill(true);
        return;
      }
      const spring = (value: Animated.Value, delay = 0) =>
        Animated.spring(value, {
          toValue: 1,
          delay,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        });
      pour = Animated.sequence([
        spring(values.enter),
        Animated.timing(values.fill, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.stagger(
          70,
          values.foam.map((foam) => spring(foam)),
        ),
        Animated.sequence([
          Animated.timing(values.tilt, {
            toValue: 1,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(values.tilt, {
            toValue: 0,
            friction: 3,
            tension: 90,
            useNativeDriver: true,
          }),
        ]),
      ]);
      pour.start(({ finished }) => {
        if (!finished || cancelled) return;
        loops = values.bubbles.map((bubble, index) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(BUBBLES[index].delay),
              Animated.timing(bubble, {
                toValue: 1,
                duration: 1800,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(bubble, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          ),
        );
        loops.forEach((loop) => loop.start());
      });
    });
    return () => {
      cancelled = true;
      pour?.stop();
      loops.forEach((loop) => loop.stop());
    };
  }, [values]);

  const glass = dark ? "#646B7A" : "#C3C9D4";
  const beerDepth = GLASS_HEIGHT - BEER_TOP;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="🍺"
      style={{ height: GLASS_HEIGHT + 30, justifyContent: "flex-end" }}
    >
      <Animated.View
        style={{
          width: GLASS_WIDTH + 24,
          height: GLASS_HEIGHT,
          opacity: values.enter,
          transform: [
            {
              scale: values.enter.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
            {
              rotate: values.tilt.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "-14deg"],
              }),
            },
          ],
        }}
      >
        {/* Handle */}
        <View
          style={{
            position: "absolute",
            left: GLASS_WIDTH - 4,
            top: 18,
            width: 28,
            height: 44,
            borderWidth: 5,
            borderLeftWidth: 0,
            borderColor: glass,
            borderTopRightRadius: 18,
            borderBottomRightRadius: 18,
          }}
        />
        {/* Glass */}
        <View
          style={{
            width: GLASS_WIDTH,
            height: GLASS_HEIGHT,
            borderWidth: 4,
            borderTopWidth: 0,
            borderColor: glass,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            borderCurve: "continuous",
            backgroundColor: dark ? "#262B35" : "#F4F7FB",
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: beerDepth,
              backgroundColor: "#F2A93B",
              experimental_backgroundImage:
                "linear-gradient(180deg, #FFD15C 0%, #F29F24 100%)",
              transform: [
                {
                  translateY: values.fill.interpolate({
                    inputRange: [0, 1],
                    outputRange: [beerDepth + 6, 0],
                  }),
                },
              ],
            }}
          >
            {still
              ? null
              : BUBBLES.map((bubble, index) => (
                  <Animated.View
                    key={index}
                    style={{
                      position: "absolute",
                      bottom: 4,
                      left: bubble.left,
                      width: bubble.size,
                      height: bubble.size,
                      borderRadius: bubble.size / 2,
                      backgroundColor: "rgba(255, 250, 225, 0.85)",
                      opacity: values.bubbles[index].interpolate({
                        inputRange: [0, 0.15, 0.8, 1],
                        outputRange: [0, 1, 1, 0],
                      }),
                      transform: [
                        {
                          translateY: values.bubbles[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -(beerDepth - 18)],
                          }),
                        },
                      ],
                    }}
                  />
                ))}
          </Animated.View>
          {/* Glint on the glass */}
          <View
            style={{
              position: "absolute",
              left: 7,
              top: 10,
              bottom: 12,
              width: 6,
              borderRadius: 3,
              backgroundColor: "rgba(255, 255, 255, 0.45)",
            }}
          />
        </View>
        {/* Head of foam spilling over the rim */}
        {FOAM.map((puff, index) => (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              left: puff.left,
              top: puff.top,
              width: puff.size,
              height: puff.size,
              borderRadius: puff.size / 2,
              backgroundColor: dark ? "#FFF3D6" : "#FFF7E2",
              boxShadow: dark
                ? undefined
                : "0 1px 1px rgba(160, 110, 20, 0.18)",
              transform: [{ scale: values.foam[index] }],
            }}
          />
        ))}
        <Animated.View
          style={{
            position: "absolute",
            left: -3,
            top: 6,
            width: 10,
            height: 18,
            borderRadius: 5,
            backgroundColor: dark ? "#FFF3D6" : "#FFF7E2",
            transform: [{ scaleY: values.foam[0] }],
          }}
        />
      </Animated.View>
    </View>
  );
}
