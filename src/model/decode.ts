/** Decode a spec file: UTF-8 when valid, otherwise Windows-1252 (typical for Excel "CSV" exports). */
export function decodeBytes(buf: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}
