// Paired backend base URL (the ngrok tunnel scanned/pasted at pairing).
// Persisted in SecureStore; every request in the app prefixes this.
import * as SecureStore from "expo-secure-store";

const KEY = "kibitzer.base";

/** The stored base URL, or null if the app has never been paired. */
export const getBase = () => SecureStore.getItemAsync(KEY);

/** Store a base URL, stripping any trailing slash so we can concat paths cleanly. */
export const setBase = (url: string) =>
  SecureStore.setItemAsync(KEY, url.replace(/\/$/, ""));

/** Forget the pairing (used to re-pair against a new tunnel). */
export const clearBase = () => SecureStore.deleteItemAsync(KEY);
