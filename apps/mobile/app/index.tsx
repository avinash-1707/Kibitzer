// Pairing screen. If already paired → redirect to /feed. Otherwise scan the QR the
// backend prints (encodes its ngrok URL) or paste it; validate with GET /persona, store, route.
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { getBase, setBase } from "../src/base";
import { validateBase } from "../src/api";

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
        <ActivityIndicator />
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
        <View style={styles.scanOverlay}>
          <Text style={styles.scanHint}>Point at the pairing QR</Text>
          <Button title="Cancel" onPress={() => setScanning(false)} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pair with a session</Text>
      <Text style={styles.subtitle}>
        Scan the QR the backend prints on boot, or paste its URL.
      </Text>

      <TouchableOpacity style={styles.scanButton} onPress={startScan}>
        <Text style={styles.scanButtonText}>Scan QR</Text>
      </TouchableOpacity>

      <Text style={styles.or}>or paste</Text>

      <TextInput
        style={styles.input}
        placeholder="https://xyz.ngrok-free.app"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={manualUrl}
        onChangeText={setManualUrl}
      />
      <Button
        title={validating ? "Connecting…" : "Connect"}
        onPress={() => pair(manualUrl)}
        disabled={validating || manualUrl.trim().length === 0}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 12 },
  scanButton: {
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  scanButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  or: { textAlign: "center", color: "#999", marginVertical: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { color: "#c00", marginTop: 8 },
  scanOverlay: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12,
  },
  scanHint: {
    color: "#fff",
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
