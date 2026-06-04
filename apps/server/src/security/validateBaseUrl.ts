import type { AppConfig } from "../types.js";

export const BASE_URL_NOT_ALLOWED_MESSAGE = "非多元探索旗下站点，不适用于本网站";
export const HTTPS_URL_INVALID_MESSAGE = "请输入正确的 HTTPS API 地址";

export function validateBaseUrl(input: string, config?: AppConfig): string {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(HTTPS_URL_INVALID_MESSAGE);
  }

  if (url.protocol !== "https:") {
    throw new Error(HTTPS_URL_INVALID_MESSAGE);
  }

  const hostname = url.hostname.toLowerCase();
  const blockedHosts = normalizeHosts(config?.blockedHosts ?? []);
  const extraAllowedHosts = normalizeHosts(config?.extraAllowedHosts ?? []);
  const allowedDomainSuffixes = normalizeSuffixes(config?.allowedDomainSuffixes ?? [".ai-wx.cn"]);

  if (blockedHosts.includes(hostname)) {
    throw new Error(BASE_URL_NOT_ALLOWED_MESSAGE);
  }

  if (extraAllowedHosts.includes(hostname)) {
    return url.origin;
  }

  if (!allowedDomainSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error(BASE_URL_NOT_ALLOWED_MESSAGE);
  }

  return url.origin;
}

function normalizeHosts(hosts: string[]) {
  return hosts.map((host) => host.trim().toLowerCase()).filter(Boolean);
}

function normalizeSuffixes(suffixes: string[]) {
  return suffixes
    .map((suffix) => suffix.trim().toLowerCase())
    .filter(Boolean)
    .map((suffix) => (suffix.startsWith(".") ? suffix : `.${suffix}`));
}
