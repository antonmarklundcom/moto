import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

// Las cabeceras se calculan al hacer el build: VENDERCRM_URL tiene que estar en
// el entorno del build para que la CSP permita vc-attribution.js (DECISIONS.md ADR-26).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Sin optimización en el servidor (G-22): las variantes WebP se generan al
  // subir y el loader elige la justa. Los anchos coinciden con las variantes.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [320, 640, 1024, 1600],
    imageSizes: [160, 240],
  },
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
