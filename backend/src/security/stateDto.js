// Shared by the standalone backend and the serverless fallback. Deny by default:
// persisted documents are not API DTOs, including documents inside the catalog.
function pickScalars(value, fields) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const key of fields.split(' ')) {
    const v = value[key];
    if (typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) out[key] = v;
  }
  return out;
}

function list(value, mapper) {
  return Array.isArray(value) ? value.filter(v => v && typeof v === 'object' && !Array.isArray(v)).map(mapper) : [];
}

function publicProduct(product) {
  const out = pickScalars(product, 'id categoryId provider name sku supplierSku providerProductId providerCode sellerName digiflazzCategory digiflazzType nominal description sellingPrice discountPrice quotaDetails duration speed networkLocation deliveryMethod isActive isDeleted stock badge iconUrl hasVariants selectedVariantId selectedVariantName isManualCustom isCustomPrice smmServiceId ratePer1000 smmMin smmMax smmRefill smmCategory needsPriceReview');
  if (Array.isArray(product.terms)) out.terms = product.terms.filter(v => typeof v === 'string');
  if (Array.isArray(product.variants)) out.variants = list(product.variants, variant =>
    pickScalars(variant, 'id name duration speed sellingPrice discountPrice stock sku badge description providerVariantId isActive isDeleted'));
  return out;
}

export function toPublicState(state) {
  const data = state && typeof state === 'object' ? state : {};
  const settings = pickScalars(data.settings, 'siteName supportWhatsApp supportEmail supportHours logoUrl systemStatus systemMaintenanceMessage paymentGatewayProvider');
  if (data.settings?.categoryStatus) settings.categoryStatus = Object.fromEntries(
    Object.entries(pickScalars(data.settings.categoryStatus, 'pulsa kuota game premium wifi smm gateway_tambahan ai_gateway pln')).filter(([, value]) => typeof value === 'boolean'));
  if (data.settings?.discountPopup) settings.discountPopup = pickScalars(data.settings.discountPopup,
    'isEnabled targetAudience title tagline description promoCode discountAmount bannerUrl badgeText');
  return {
    products: list(data.products, publicProduct),
    categories: list(data.categories, item => pickScalars(item, 'id name slug description icon color')),
    catalogs: list(data.catalogs, item => pickScalars(item, 'id title subtitle description iconType iconUrl targetTab badge isActive')),
    banners: list(data.banners, item => pickScalars(item, 'id badge tagline title subtitle ctaText ctaCategory secondaryCtaText secondaryCtaAction imageUrl imageTag accentColor isActive order photoLayout showTextOverlay')),
    promos: list(data.promos, item => pickScalars(item, 'id code title description isActive discountPercentage maxDiscount validUntil')),
    settings,
  };
}

// Admin view: catalog DTO but retains admin-manageable identifiers while
// stripping authentication material. Used by future authenticated admin
// endpoints — never mutates the persisted document.
function stripAuthFromUser(u) {
  if (!u || typeof u !== 'object') return null;
  const { password, passwordHash, googleAuthSecret, totpSecret, otpSecret, ...rest } = u;
  // keep email, id, etc.
  return rest;
}
function stripAuthFromProduct(p) {
  if (!p || typeof p !== 'object') return p;
  const { password, ...rest } = p;
  return rest;
}
function stripAuthFromWifiBatch(b) {
  if (!b || typeof b !== 'object') return b;
  const { password, ...rest } = b;
  return rest;
}
export function toAdminState(state) {
  const pub = toPublicState(state);
  const data = state && typeof state === 'object' ? state : {};
  // Admin retains users without auth material
  if (Array.isArray(data.users)) {
    pub.users = data.users.map(stripAuthFromUser).filter(Boolean);
  } else {
    pub.users = [];
  }
  if (Array.isArray(data.wifiBatches)) {
    pub.wifiBatches = data.wifiBatches.map(stripAuthFromWifiBatch);
  }
  // Strip admin auth from settings but keep identifiers
  if (pub.settings && typeof pub.settings === 'object') {
    // toPublicState already stripped secrets above; ensure adminPassword / googleAuthSecret gone
    delete pub.settings.adminPassword;
    delete pub.settings.googleAuthSecret;
    delete pub.settings.totpSecret;
  }
  // Ensure products in admin view also have password stripped (toPublicState already does)
  if (Array.isArray(pub.products)) {
    pub.products = pub.products.map(stripAuthFromProduct);
  }
  return pub;
}

