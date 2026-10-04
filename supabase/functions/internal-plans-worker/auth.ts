export function configuredSecretKeys(raw: string | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];

    const values = Object.values(parsed);
    if (!values.length || !values.every((value) =>
      typeof value === 'string' && /^sb_secret_\S+$/.test(value))) return [];
    return values as string[];
  } catch {
    return [];
  }
}

export function isAuthorizedWorkerRequest(req: Request, rawSecretKeys: string | undefined): boolean {
  const presentedKey = req.headers.get('apikey');
  return Boolean(presentedKey && configuredSecretKeys(rawSecretKeys).includes(presentedKey));
}
