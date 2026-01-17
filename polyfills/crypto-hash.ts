import { createHash } from "crypto";

// Polyfill for crypto.hash (required for Vite 7+ with Node.js compatibility)
// This polyfill ensures crypto.hash is available before Vite tries to use it
if (typeof globalThis.crypto === "undefined" || typeof (globalThis.crypto as any).hash !== "function") {
  if (typeof globalThis.crypto === "undefined") {
    globalThis.crypto = {} as Crypto;
  }
  (globalThis.crypto as any).hash = (algorithm: string, data: string | Buffer, outputEncoding?: "hex" | "base64" | "base64url") => {
    const hash = createHash(algorithm).update(data);
    if (outputEncoding) {
      return hash.digest(outputEncoding);
    }
    return hash.digest("hex");
  };
}
