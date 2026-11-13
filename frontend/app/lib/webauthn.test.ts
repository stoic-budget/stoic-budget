import { describe, expect, it } from 'vitest';
import { fromBase64Url, isPasskeyPromptDismissed, toBase64Url } from './webauthn';

describe('webauthn helpers', () => {
  it('round-trips bytes through base64url without padding', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255, 62, 63]);
    const encoded = toBase64Url(bytes.buffer);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(new Uint8Array(fromBase64Url(encoded))).toEqual(bytes);
  });

  it('reads the base64url the server sends, whatever its length', () => {
    for (const text of ['a', 'ab', 'abc', 'abcd']) {
      const encoded = toBase64Url(new TextEncoder().encode(text).buffer as ArrayBuffer);
      expect(new TextDecoder().decode(fromBase64Url(encoded))).toBe(text);
    }
  });

  it('treats a closed or timed-out prompt as dismissed, and nothing else', () => {
    expect(isPasskeyPromptDismissed(new DOMException('x', 'NotAllowedError'))).toBe(true);
    expect(isPasskeyPromptDismissed(new DOMException('x', 'AbortError'))).toBe(true);
    expect(isPasskeyPromptDismissed(new DOMException('x', 'InvalidStateError'))).toBe(false);
    expect(isPasskeyPromptDismissed(new Error('NotAllowedError'))).toBe(false);
  });
});
