const TOKEN_VERSION = 3;
const SIGNATURE_BYTES = 64;
const PAYLOAD_LENGTH_BYTES = 4;
const PAYLOAD_LENGTH_OFFSET = 1 + SIGNATURE_BYTES;
const PAYLOAD_OFFSET = PAYLOAD_LENGTH_OFFSET + PAYLOAD_LENGTH_BYTES;
const TEST_EXPIRY_SECONDS = 2_147_483_647;

const encode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary);
};

export const webMcpOriginTrialTokenFixture = (
  isThirdParty: boolean,
  expiry = TEST_EXPIRY_SECONDS,
): string => {
  const payload = new TextEncoder().encode(
    JSON.stringify({
      expiry,
      feature: "WebMCP",
      isThirdParty,
      origin: "https://www.webmcpifier.test:443",
    }),
  );
  const bytes = new Uint8Array(PAYLOAD_OFFSET + payload.length);
  bytes[0] = TOKEN_VERSION;
  new DataView(bytes.buffer).setUint32(PAYLOAD_LENGTH_OFFSET, payload.length);
  bytes.set(payload, PAYLOAD_OFFSET);
  return encode(bytes);
};

export const FIRST_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN = webMcpOriginTrialTokenFixture(false);
export const THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN = webMcpOriginTrialTokenFixture(true);
