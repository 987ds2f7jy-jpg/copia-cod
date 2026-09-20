const PLACEHOLDER = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

function normalizeTemplateValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500);
  }
  return '';
}

/** Plain-text only replacement. Missing values become an empty string. */
export function renderNotificationTemplate(template: string, data: Record<string, unknown> = {}) {
  return String(template || '').replace(PLACEHOLDER, (_match, key: string) => normalizeTemplateValue(data[key]));
}
