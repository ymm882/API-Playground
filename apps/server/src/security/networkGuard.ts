import { lookup } from "node:dns/promises";
import net from "node:net";

export async function assertPublicHostname(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });

  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new Error("当前站点不可用");
    }
  }
}

function isPrivateAddress(address: string) {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;

    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }

  return true;
}
