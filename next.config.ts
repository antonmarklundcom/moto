import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

// Las cabeceras se calculan al hacer el build: VENDERCRM_URL tiene que estar en
// el entorno del build para que la CSP permita vc-attribution.js (DECISIONS.md ADR-26).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          vendercrmUrl: process.env.VENDERCRM_URL,
          isDev: process.env.NODE_ENV !== "production",
        }),
      },
    ];
  },
};

export default nextConfig;
