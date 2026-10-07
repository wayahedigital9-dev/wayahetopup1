// Empty/redacted credentials mean "unchanged", never a credential deletion.
export function mergeSettings(existing: Record<string, any> = {}, incoming: Record<string, any> = {}) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (/key|secret|token|password|mongodbUri|supabaseDbUrl/i.test(key)) {
      if (value == null || (typeof value === 'string' && (!value.trim() || /\*{3,}|•{3,}|\.{3}|…|^\[?redacted\]?$/i.test(value)))) continue;
    }
    merged[key] = value;
  }
  return merged;
}
