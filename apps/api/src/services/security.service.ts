import dns from "dns/promises";
import net from "net";

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  domain?: string;
  ip?: string;
  error?: string;
}

export interface VerificationCheckResult {
  verified: boolean;
  method?: "http_token" | "dns_txt" | "dev_bypass";
  details?: string;
}

export class SecurityService {
  /**
   * Checks if an IPv4 or IPv6 address belongs to private, loopback, link-local, or cloud metadata ranges.
   */
  public static isPrivateOrRestrictedIp(ip: string): boolean {
    // IPv4 checks
    if (net.isIPv4(ip)) {
      const parts = ip.split(".").map(Number);
      if (parts.length !== 4) return true;

      // 0.0.0.0/8 (Current network)
      if (parts[0] === 0) return true;

      // 127.0.0.0/8 (Loopback)
      if (parts[0] === 127) return true;

      // 10.0.0.0/8 (Private)
      if (parts[0] === 10) return true;

      // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

      // 192.168.0.0/16 (Private)
      if (parts[0] === 192 && parts[1] === 168) return true;

      // 169.254.0.0/16 (Link-local / AWS / GCP / Azure metadata 169.254.169.254)
      if (parts[0] === 169 && parts[1] === 254) return true;

      // 224.0.0.0/4 (Multicast)
      if (parts[0] >= 224 && parts[0] <= 239) return true;

      // 240.0.0.0/4 (Reserved)
      if (parts[0] >= 240) return true;

      return false;
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      // Loopback ::1
      if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
      // Unspecified ::
      if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
      // Unique local addresses fc00::/7
      if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
      // Link-local fe80::/10
      if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
      // IPv4 mapped ::ffff:127.0.0.1
      if (normalized.includes("::ffff:")) {
        const ipv4Part = normalized.split("::ffff:")[1];
        if (ipv4Part && net.isIPv4(ipv4Part)) {
          return SecurityService.isPrivateOrRestrictedIp(ipv4Part);
        }
      }
      return false;
    }

    // Not a valid IP
    return true;
  }

  /**
   * Validates target URL against SSRF and protocol restrictions.
   */
  public static async validateTargetUrl(rawUrl: string, allowLocalDev = false): Promise<UrlValidationResult> {
    if (!rawUrl || typeof rawUrl !== "string") {
      return { isValid: false, error: "URL is required and must be a valid string." };
    }

    let parsed: URL;
    try {
      let candidate = rawUrl.trim();
      if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
        candidate = `https://${candidate}`;
      }
      parsed = new URL(candidate);
    } catch {
      return { isValid: false, error: "Malformed URL format." };
    }

    // Protocol check
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { isValid: false, error: "Only HTTP and HTTPS protocols are supported." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block cloud metadata hostnames explicitly
    const blockedHostnames = [
      "metadata.google.internal",
      "metadata.internal",
      "instance-data",
      "169.254.169.254"
    ];
    if (blockedHostnames.includes(hostname)) {
      return { isValid: false, error: "Access to internal cloud metadata services is strictly prohibited." };
    }

    const isDevEnv =
      allowLocalDev ||
      process.env.NODE_ENV === "development" ||
      process.env.PAUSE_AUTH === "true" ||
      process.env.ALLOW_LOCAL_SCAN === "true";

    // Port check: In production allow only 80 and 443
    const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;
    if (!isDevEnv && port !== 80 && port !== 443) {
      return { isValid: false, error: `Invalid port ${port}. Only standard web ports (80, 443) are allowed.` };
    }

    // Check if localhost
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (isLocalhost) {
      if (isDevEnv) {
        return {
          isValid: true,
          normalizedUrl: parsed.origin + parsed.pathname,
          domain: hostname,
          ip: "127.0.0.1"
        };
      }
      return { isValid: false, error: "Scanning localhost or internal loopback addresses is not permitted in production." };
    }

    // DNS Resolution check for Anti-SSRF
    try {
      const lookupResult = await dns.lookup(hostname);
      const resolvedIp = lookupResult.address;

      if (SecurityService.isPrivateOrRestrictedIp(resolvedIp)) {
        if (!isDevEnv) {
          return {
            isValid: false,
            error: `Target resolved to restricted private IP (${resolvedIp}). SSRF protection blocked this request.`
          };
        }
      }

      return {
        isValid: true,
        normalizedUrl: parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname),
        domain: hostname,
        ip: resolvedIp
      };
    } catch (err: any) {
      return {
        isValid: false,
        error: `Could not resolve domain '${hostname}': ${err.message || "DNS lookup failed"}`
      };
    }
  }

  /**
   * Verifies domain ownership via HTTP token or DNS TXT record.
   */
  public static async verifyDomainOwnership(domain: string, expectedToken: string): Promise<VerificationCheckResult> {
    // In local development or paused auth mode, allow automatic verification
    if (process.env.NODE_ENV === "development" || process.env.PAUSE_AUTH === "true") {
      return {
        verified: true,
        method: "dev_bypass",
        details: "Automatically verified in development / dev mode."
      };
    }

    // Method 1: Check HTTP token at /.well-known/tracepilot-verification.txt
    try {
      const wellKnownUrl = `https://${domain}/.well-known/tracepilot-verification.txt`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(wellKnownUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "TracePilot-Domain-Verifier/1.0" }
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const text = (await resp.text()).trim();
        if (text.includes(expectedToken)) {
          return {
            verified: true,
            method: "http_token",
            details: `Successfully verified via HTTP endpoint ${wellKnownUrl}`
          };
        }
      }
    } catch {
      // Continue to DNS fallback
    }

    // Method 2: Check DNS TXT record
    try {
      const txtRecords = await dns.resolveTxt(`_tracepilot-challenge.${domain}`);
      const flattened = txtRecords.flat().join(" ");
      if (flattened.includes(`tracepilot-verification=${expectedToken}`) || flattened.includes(expectedToken)) {
        return {
          verified: true,
          method: "dns_txt",
          details: `Successfully verified via DNS TXT record on _tracepilot-challenge.${domain}`
        };
      }
    } catch {
      // Try apex domain TXT
      try {
        const rootTxtRecords = await dns.resolveTxt(domain);
        const rootFlattened = rootTxtRecords.flat().join(" ");
        if (rootFlattened.includes(`tracepilot-verification=${expectedToken}`) || rootFlattened.includes(expectedToken)) {
          return {
            verified: true,
            method: "dns_txt",
            details: `Successfully verified via DNS TXT record on ${domain}`
          };
        }
      } catch {
        // DNS lookup failed
      }
    }

    return {
      verified: false,
      details: "Could not verify domain via HTTP token (/.well-known/tracepilot-verification.txt) or DNS TXT records."
    };
  }
}
