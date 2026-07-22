const DEFAULT_NETWORK_SETTINGS = {
  name: "Mofu Networks",
  description: "Mofu Networks is an experimental network within DN42",
  asn: "4242422670",
};

const LEGACY_KIOUBIT_DOMAIN = "iedon.net";
const LEGACY_KIOUBIT_NOT_ALLOWED_ASNS = [4242422189];
const REQUIRED_CORS_METHODS = ["GET", "POST", "OPTIONS"];

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);

function nonEmptyString(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  return value.trim();
}

function booleanValue(value, fallback) {
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseAsnList(value) {
  if (typeof value !== "string" || value.trim() === "") return [];

  return [
    ...new Set(
      value
        .split(",")
        .map((asn) => Number(asn.trim()))
        .filter((asn) => Number.isSafeInteger(asn) && asn > 0)
    ),
  ];
}

function isLegacyKioubitAsnList(value) {
  return (
    Array.isArray(value) &&
    value.length === LEGACY_KIOUBIT_NOT_ALLOWED_ASNS.length &&
    value.every((asn, index) => asn === LEGACY_KIOUBIT_NOT_ALLOWED_ASNS[index])
  );
}

function normalizeCorsMethods(value) {
  const methods = new Set(REQUIRED_CORS_METHODS);
  nonEmptyString(value, "")
    .split(",")
    .map((method) => method.trim().toUpperCase())
    .filter(Boolean)
    .forEach((method) => methods.add(method));

  return [...methods].join(", ");
}

function removeInvalidPreflightHeaders(headers) {
  Object.keys(headers).forEach((key) => {
    const normalized = key.toLowerCase();
    if (
      normalized === "access-control-request-method" ||
      normalized === "access-control-request-headers"
    ) {
      delete headers[key];
    }
  });
}

/**
 * Applies deployment-specific environment overrides after loading config.js.
 * This keeps an existing private config.js usable when the tracked defaults
 * change, which is especially important for Docker Compose bind mounts.
 */
export function applyRuntimeConfig(settings, env = {}) {
  const networkSettings = settings.networkSettings || {};
  settings.networkSettings = {
    name: nonEmptyString(
      env.NET_NAME,
      networkSettings.name || DEFAULT_NETWORK_SETTINGS.name
    ),
    description: nonEmptyString(
      env.NET_DESC,
      networkSettings.description || DEFAULT_NETWORK_SETTINGS.description
    ),
    asn: nonEmptyString(
      env.NET_ASN,
      String(networkSettings.asn || DEFAULT_NETWORK_SETTINGS.asn)
    ),
    migrateLegacyDefaults: booleanValue(
      env.MIGRATE_LEGACY_NETWORK_SETTINGS,
      networkSettings.migrateLegacyDefaults !== false
    ),
  };

  const openAuthSettings = settings.openAuthSettings || {};
  const providers = Array.isArray(openAuthSettings.providers)
    ? [...new Set(openAuthSettings.providers)]
    : [];
  const kioubitEnabled = booleanValue(
    env.KIOUBIT_OPENAUTH_ENABLED,
    providers.includes("kioubit")
  );

  if (kioubitEnabled && !providers.includes("kioubit")) {
    providers.unshift("kioubit");
  } else if (!kioubitEnabled) {
    const index = providers.indexOf("kioubit");
    if (index !== -1) providers.splice(index, 1);
  }

  const kioubitSettings = openAuthSettings.kioubit || {};
  let kioubitDomain = nonEmptyString(
    env.KIOUBIT_OPENAUTH_DOMAIN,
    kioubitSettings.myDomain
  );
  if (!kioubitDomain || kioubitDomain === LEGACY_KIOUBIT_DOMAIN) {
    kioubitDomain = "dn42.mofu.party";
  }

  let notAllowed = kioubitSettings.notAllowed;
  if (hasOwn(env, "KIOUBIT_OPENAUTH_NOT_ALLOWED_ASNS")) {
    notAllowed = parseAsnList(env.KIOUBIT_OPENAUTH_NOT_ALLOWED_ASNS);
  } else if (isLegacyKioubitAsnList(notAllowed)) {
    notAllowed = [Number(settings.networkSettings.asn)];
  }

  openAuthSettings.providers = providers;
  openAuthSettings.kioubit = {
    ...kioubitSettings,
    myDomain: kioubitDomain,
    notAllowed: Array.isArray(notAllowed)
      ? notAllowed
      : [Number(settings.networkSettings.asn)],
    publicKey: kioubitSettings.publicKey || "./kioubitAuth.pem",
  };
  settings.openAuthSettings = openAuthSettings;

  const preflightHeaders = { ...(settings.preflightHeaders || {}) };
  removeInvalidPreflightHeaders(preflightHeaders);
  preflightHeaders["Access-Control-Allow-Methods"] = normalizeCorsMethods(
    nonEmptyString(
      env.CORS_ALLOW_METHODS,
      preflightHeaders["Access-Control-Allow-Methods"]
    )
  );
  preflightHeaders["Access-Control-Max-Age"] = nonEmptyString(
    env.CORS_MAX_AGE,
    preflightHeaders["Access-Control-Max-Age"] || "86400"
  );
  settings.preflightHeaders = preflightHeaders;

  const corsHeaders = { ...(settings.corsHeaders || {}) };
  corsHeaders["Access-Control-Allow-Origin"] = nonEmptyString(
    env.CORS_ALLOW_ORIGIN,
    corsHeaders["Access-Control-Allow-Origin"] || "*"
  );
  corsHeaders["Access-Control-Allow-Headers"] = nonEmptyString(
    env.CORS_ALLOW_HEADERS,
    corsHeaders["Access-Control-Allow-Headers"] ||
      "X-PeerAPI-Version, Content-Type, Authorization"
  );
  settings.corsHeaders = corsHeaders;

  return settings;
}
