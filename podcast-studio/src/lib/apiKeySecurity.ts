import crypto from "node:crypto";

const fingerprint = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);

const maskValue = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  return `[REDACTED:${fingerprint(normalized)}:${normalized.length}]`;
};

export const ApiKeySecurity = {
  maskKey(value: string): string {
    return maskValue(value);
  },

  summarize(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      return { exists: false, length: 0 } as const;
    }

    return {
      exists: true,
      length: normalized.length,
      fingerprint: fingerprint(normalized),
      masked: maskValue(normalized),
    } as const;
  },
} as const;

export default ApiKeySecurity;
