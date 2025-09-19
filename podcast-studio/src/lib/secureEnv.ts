import crypto from "node:crypto";

const normalizeValue = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const fingerprint = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);

export type SecureEnvInfo = {
  exists: boolean;
  length: number;
  fingerprint?: string;
};

const getValue = (key: string): string | undefined => normalizeValue(process.env[key]);

export const SecureEnv = {
  get: getValue,

  getWithDefault(key: string, fallback: string): string {
    const envValue = getValue(key);
    if (typeof envValue === "string") {
      return envValue;
    }

    const normalizedFallback = normalizeValue(fallback);
    return typeof normalizedFallback === "string" ? normalizedFallback : fallback;
  },

  exists(key: string): boolean {
    return typeof getValue(key) === "string";
  },

  getInfo(key: string): SecureEnvInfo {
    const value = getValue(key);

    if (!value) {
      return { exists: false, length: 0 };
    }

    return { exists: true, length: value.length, fingerprint: fingerprint(value) };
  },
} as const;

export default SecureEnv;
