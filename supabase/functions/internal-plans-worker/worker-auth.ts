/** Authorize only a currently configured server-side Supabase secret key. */
export function isWorkerSecretKeyAuthorized(
  apikey: string | null,
  configuredKeysJson: string | undefined,
): boolean {
  if (!apikey || !configuredKeysJson) return false;

  try {
    const configuredKeys: unknown = JSON.parse(configuredKeysJson);
    if (!configuredKeys || typeof configuredKeys !== 'object' || Array.isArray(configuredKeys)) {
      return false;
    }

    return Object.values(configuredKeys).some(
      (key) => typeof key === 'string' && key.startsWith('sb_secret_') && key === apikey,
    );
  } catch {
    return false;
  }
}
