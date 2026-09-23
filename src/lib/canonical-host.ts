// Host canónico (SEO: sin duplicados www/sin www). Puro: lo usa next.config.ts.

/** La variante con/sin "www" del host de SITE_URL, que redirige a SITE_URL; `null` en local o con una IP. */
export function otherWwwHost(siteUrl: string | undefined): { from: string; to: string } | null {
  try {
    const url = new URL(siteUrl ?? "");
    if (url.hostname === "localhost" || /^[\d.]+$/.test(url.hostname) || !url.hostname.includes(".")) return null;
    const from = url.hostname.startsWith("www.") ? url.hostname.slice(4) : `www.${url.hostname}`;
    return { from, to: url.origin };
  } catch {
    return null;
  }
}
