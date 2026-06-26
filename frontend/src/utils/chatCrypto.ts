// End-to-end encryption for chat using Web Crypto API
// Key exchange: ECDH P-256  |  Message encryption: AES-GCM 256-bit
// Private keys never leave the browser (stored in localStorage as JWK)

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const AES  = { name: 'AES-GCM', length: 256 }      as const;

const LS_PRIV = 'chat_ecdh_private';
const LS_PUB  = 'chat_ecdh_public';

// ── Key pair (generate once, persist in localStorage) ─────────────────────

export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  const privJwkRaw = localStorage.getItem(LS_PRIV);
  const pubJwkRaw  = localStorage.getItem(LS_PUB);

  if (privJwkRaw && pubJwkRaw) {
    const privateKey = await crypto.subtle.importKey('jwk', JSON.parse(privJwkRaw), ECDH, true, ['deriveKey']);
    const publicKey  = await crypto.subtle.importKey('jwk', JSON.parse(pubJwkRaw),  ECDH, true, []);
    return { privateKey, publicKey };
  }

  const pair = await crypto.subtle.generateKey(ECDH, true, ['deriveKey']);
  const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pubJwk  = await crypto.subtle.exportKey('jwk', pair.publicKey);
  localStorage.setItem(LS_PRIV, JSON.stringify(privJwk));
  localStorage.setItem(LS_PUB,  JSON.stringify(pubJwk));
  return pair;
}

export async function getPublicKeyJwk(): Promise<JsonWebKey> {
  const pair = await getOrCreateKeyPair();
  return crypto.subtle.exportKey('jwk', pair.publicKey);
}

// ── Import a remote user's public key from JWK ───────────────────────────

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ECDH, false, []);
}

// ── Derive the shared AES key for a conversation ─────────────────────────
// Both sides derive the same key: ECDH(myPrivate, theirPublic)

export async function deriveSharedKey(myPrivate: CryptoKey, theirPublic: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    AES,
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── Encrypt a plaintext message ───────────────────────────────────────────

export async function encryptMessage(
  key: CryptoKey,
  text: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv      = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const buf     = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    ciphertext: uint8ToBase64(new Uint8Array(buf)),
    iv:         uint8ToBase64(iv),
  };
}

// ── Decrypt a received message ────────────────────────────────────────────

export async function decryptMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const cipherBuf = base64ToUint8(ciphertext);
  const ivBuf     = base64ToUint8(iv);
  const plainBuf  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf.buffer as BufferSource }, key, cipherBuf.buffer as BufferSource);
  return new TextDecoder().decode(plainBuf);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function uint8ToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function base64ToUint8(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
