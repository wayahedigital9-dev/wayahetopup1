// Pure resolver: authoritative saved values beat environment defaults, including explicit blanks.
export function resolveDigiflazzSettings(settings: Record<string, any>, fallback: Record<string, any>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(settings, key);
  const value = (primary: string, alias?: string, defaultValue = '') =>
    String(has(primary) ? settings[primary] ?? '' : alias && has(alias) ? settings[alias] ?? '' : defaultValue).trim();
  const testing = has('digiflazzMode') ? settings.digiflazzMode === 'DEVELOPMENT' : Boolean(fallback.TESTING);
  const keyField = testing ? 'digiflazzDevelopmentKey' : 'digiflazzProductionKey';
  // Never use a production/generic key to stand in for a missing development key.
  const apiKey = testing
    ? value(keyField, undefined, has('digiflazzMode') ? '' : fallback.API_KEY)
    : value(keyField, 'digiflazzApiKey', has('digiflazzMode') ? '' : fallback.API_KEY);
  return {
    ...fallback,
    USERNAME: value('digiflazzUsername', 'digiflazzUser', fallback.USERNAME),
    API_KEY: apiKey,
    TESTING: testing,
    WHITELIST_IP: value('digiflazzWhitelistIp', undefined, fallback.WHITELIST_IP),
    OUTBOUND_PROXY: value('digiflazzOutboundProxy', undefined, fallback.OUTBOUND_PROXY),
    WEBHOOK_SECRET: value('digiflazzWebhookSecret', 'digiflazzSecretCode', fallback.WEBHOOK_SECRET),
    SECRET_CODE: value('digiflazzWebhookSecret', 'digiflazzSecretCode', fallback.SECRET_CODE),
    WEBHOOK_URL: value('digiflazzWebhookUrl', undefined, fallback.WEBHOOK_URL),
  };
}
