// Pure resolver: authoritative saved values from MongoDB beat environment defaults, including explicit blanks.
export function resolveQiospaySettings(settings: Record<string, any>, fallback: Record<string, any>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(settings, key);
  const value = (primary: string, alias?: string, defaultValue = '') =>
    String(has(primary) ? settings[primary] ?? '' : alias && has(alias) ? settings[alias] ?? '' : defaultValue).trim();
  const testing = has('qiospayMode') ? settings.qiospayMode === 'DEVELOPMENT' : Boolean(fallback.TESTING);
  return {
    ...fallback,
    MERCHANT_CODE: value('qiospayMerchantCode', 'qiospayMerchantKey', fallback.MERCHANT_CODE),
    API_KEY: value('qiospayApiKey', 'qiospayApiKey', fallback.API_KEY),
    EXPECTED_NMID: value('qiospayExpectedNmid', 'qiospayNmid', fallback.EXPECTED_NMID),
    CALLBACK_SECRET: value('qiospayCallbackSecret', 'qiospaySecretKey', fallback.CALLBACK_SECRET),
    ADMIN_TOKEN: value('qiospayAdminToken', 'qiospayAdminApiKey', fallback.ADMIN_TOKEN),
    SECRET_KEY: value('qiospaySecretKey', 'qiospaySecretKey', fallback.SECRET_KEY),
    MERCHANT_NAME: value('qiospayMerchantName', undefined, fallback.MERCHANT_NAME),
    QR_STRING: value('qiospayQrisString', 'qiospayQrString', fallback.QR_STRING),
    QRIS_STRING: value('qiospayQrisString', 'qiospayQrString', fallback.QRIS_STRING),
    LOCAL_DYNAMIC_CONFIRMED: has('qiospayLocalDynamicConfirmed') ? settings.qiospayLocalDynamicConfirmed !== 'false' : fallback.LOCAL_DYNAMIC_CONFIRMED,
    TESTING: testing,
    // ── Virtual Account H2H ──────────────────────
    H2H_USERNAME: value('qiospayH2hUsername', 'qiospayUsername', fallback.H2H_USERNAME),
    H2H_PIN: value('qiospayH2hPin', 'qiospayUsApikey', fallback.H2H_PIN),
    VA_ENABLED: has('qiospayVaEnabled') ? settings.qiospayVaEnabled !== 'false' : fallback.VA_ENABLED,
    VA_CALLBACK_URL: value('qiospayVaCallbackUrl', undefined, fallback.VA_CALLBACK_URL || ''),
    VA_BANKS: settings.qiospayVaBanks
      ? String(settings.qiospayVaBanks).split(',').map((e: string) => e.trim()).filter(Boolean)
      : fallback.VA_BANKS,
  };
}
