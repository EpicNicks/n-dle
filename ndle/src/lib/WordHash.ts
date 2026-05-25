/** Encode a word to a URL-safe base64 string */
export function encodeWord(word: string): string {
  return btoa(word.toLowerCase())
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Decode a URL-safe base64 string back to a word */
export function decodeWord(hash: string): string {
  const base64 = hash.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return atob(base64).toUpperCase();
  } catch {
    return "";
  }
}
