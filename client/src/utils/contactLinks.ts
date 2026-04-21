export function toExternalHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function toTelegramHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^t\.me\//i.test(trimmed)) return `https://${trimmed}`;

  const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return `https://t.me/${username}`;
}