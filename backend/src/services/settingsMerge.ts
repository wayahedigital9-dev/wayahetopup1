// Empty/redacted credentials mean "unchanged", never a credential deletion.
export function mergeSettings(existing: Record<string, any> = {}, incoming: Record<string, any> = {}) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || /^has[A-Z]/.test(key) || value === undefined) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = mergeSettings(existing?.[key] && typeof existing[key] === 'object' ? existing[key] : {}, value);
      continue;
    }
    if (key === 'apiConfigs' && (value == null || Array.isArray(value))) continue;
    if (/key|secret|token|password|mongodbUri|supabaseDbUrl/i.test(key)) {
      if (value == null || (typeof value === 'string' && (!value.trim() || /\*{3,}|•{3,}|\.{3}|…|^\[?redacted\]?$/i.test(value)))) continue;
    }
    merged[key] = value;
  }
  return merged;
}
