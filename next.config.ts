import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy.
 *
 * Le PDF est rendu dans une <iframe srcdoc> (voir src/services/pdf/index.ts et
 * src/app/express/page.tsx). Un document `srcdoc` hérite de la CSP de la page
 * qui l'englobe : il faut donc autoriser ce dont ce HTML a besoin.
 *   - `style-src 'unsafe-inline'` : le template PDF s'appuie entièrement sur des
 *     balises <style> et des attributs style="" en ligne.
 *   - `img-src` : le logo de l'entreprise est chargé depuis Supabase Storage
 *     (https) et peut aussi arriver en data:/blob:.
 *   - `frame-src 'self'` : autorise l'iframe srcdoc (about:srcdoc).
 *
 * Next.js injecte des scripts inline pour l'hydratation (sans nonce ici), d'où
 * `script-src 'unsafe-inline'`. `'unsafe-eval'` n'est ajouté qu'en dev (HMR).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
]
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
