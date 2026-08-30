// Pairing screen. If already paired → redirect to /feed. Otherwise scan the QR the
// backend prints (encodes its ngrok URL) or paste it; validate with GET /persona, store, route.
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getBase, setBase } from "../src/base";
import { validateBase } from "../src/api";
import { ScalePressable } from "../src/components/ScalePressable";
import { colors, fonts, radius, spacing } from "../src/theme";

export default function PairScreen() {
  const [checking, setChecking] = useState(true);
  const [manualUrl, setManualUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  // Synchronous guard: `onBarcodeScanned` fires at frame rate, so a state flag
  // (set async) lets several callbacks through before it flips. A ref blocks the
  // first extra fire in the same frame.
  const busy = useRef(false);

  // Already paired? Skip straight to the feed.
  useEffect(() => {
    getBase().then((base) => {
      if (base) router.replace("/feed");
      else setChecking(false);
    });
  }, []);

  async function pair(url: string) {
    if (busy.current) return;
    busy.current = true;
    setValidating(true);
    setError(null);
    try {
      const normalized = await validateBase(url);
      await setBase(normalized);
      router.replace("/feed"); // success navigates away — leave busy latched
    } catch {
      setError("Couldn't reach that address. Check the URL and try again.");
      setScanning(false);
      busy.current = false; // allow a retry
    } finally {
      setValidating(false);
    }
  }

  async function startScan() {
    setError(null);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        // Distinguish a hard deny (no OS prompt possible) from a soft one.
        if (permission && !permission.canAskAgain) {
          setError("Camera is blocked. Enable it in Settings, or paste the URL.");
          void Linking.openSettings();
        } else {
          setError("Camera permission is needed to scan the pairing QR.");
        }
        return;
      }
    }
    setScanning(true);
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (scanning) {
    return (
      <View style={styles.flex}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={
            validating ? undefined : ({ data }) => void pair(data)
          }
        />
        <View style={styles.scanFrame} pointerEvents="none" />
        <View style={styles.scanOverlay}>
          <Text style={styles.scanHint}>Point at the pairing QR</Text>
          <ScalePressable style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </ScalePressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(320).springify().damping(16)} style={styles.brand}>
        <View style={styles.brandDot} />
        <Text style={styles.brandWord}>KIBITZER</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(320).delay(60).springify().damping(16)}>
        <Text style={styles.title}>Pair with a session</Text>
        <Text style={styles.subtitle}>
          Scan the QR the backend prints on boot, or paste its URL.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(320).delay(120).springify().damping(16)}>
        <ScalePressable style={styles.scanButton} onPress={startScan} accessibilityRole="button">
          <Text style={styles.scanButtonText}>Scan QR</Text>
        </ScalePressable>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(320).delay(180).springify().damping(16)}
        style={styles.pasteBlock}
      >
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.or}>or paste</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="https://xyz.ngrok-free.app"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={manualUrl}
          onChangeText={setManualUrl}
        />
        <ScalePressable
          style={[
            styles.connectButton,
            (validating || manualUrl.trim().length === 0) && styles.connectButtonDisabled,
          ]}
          onPress={() => pair(manualUrl)}
          disabled={validating || manualUrl.trim().length === 0}
          accessibilityRole="button"
        >
          {validating ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text style={styles.connectButtonText}>Connect</Text>
          )}
        </ScalePressable>

        {error ? (
          <Animated.Text entering={FadeInDown.duration(180)} style={styles.error}>
            {error}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: "center", padding: spacing.xxl, gap: spacing.xl, backgroundColor: colors.bg },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  brandDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  brandWord: {
    color: colors.text,
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    letterSpacing: 1.5,
  },
  title: { fontSize: 24, fontFamily: fonts.displaySemibold, color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.xxl, lineHeight: 20 },
  scanButton: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: "center",
  },
  scanButtonText: { color: colors.onAccent, fontSize: 16, fontWeight: "700" },
  pasteBlock: { gap: spacing.md, marginTop: spacing.sm },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  connectButton: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 13,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  connectButtonDisabled: { opacity: 0.45 },
  connectButtonText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  error: { color: colors.danger, marginTop: spacing.xs, fontSize: 13 },
  scanOverlay: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing.md,
  },
  scanFrame: {
    position: "absolute",
    top: "28%",
    left: "14%",
    right: "14%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    opacity: 0.85,
  },
  scanHint: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: "rgba(8,9,12,0.75)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  cancelBtn: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  cancelText: { color: colors.text, fontSize: 14, fontWeight: "600" },
});
