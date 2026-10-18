/** Generate a stable, collision-resistant id for a place record. */
export function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `place-${Date.now().toString(36)}-${random}`;
}
