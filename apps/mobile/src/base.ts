// Paired backend base URL (the ngrok tunnel scanned/pasted at pairing).
// Persisted in SecureStore on native; every request in the app prefixes this.
// expo-secure-store has NO web implementation, so on web we fall back to
// localStorage — same async interface, so callers don't branch.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "kibitzer.base";
const isWeb = Platform.OS === "web";

const strip = (url: string) => url.replace(/\/$/, "");

/** The stored base URL, or null if the app has never been paired. */
export const getBase = (): Promise<string | null> =>
  isWeb
    ? Promise.resolve(globalThis.localStorage?.getItem(KEY) ?? null)
    : SecureStore.getItemAsync(KEY);

/** Store a base URL, stripping any trailing slash so we can concat paths cleanly. */
export const setBase = (url: string): Promise<void> =>
  isWeb
    ? Promise.resolve(globalThis.localStorage?.setItem(KEY, strip(url)))
    : SecureStore.setItemAsync(KEY, strip(url));

/** Forget the pairing (used to re-pair against a new tunnel). */
export const clearBase = (): Promise<void> =>
  isWeb
    ? Promise.resolve(globalThis.localStorage?.removeItem(KEY))
    : SecureStore.deleteItemAsync(KEY);
