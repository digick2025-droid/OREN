/**
 * Rate-limiting en mémoire (fenêtre fixe), sans dépendance externe.
 *
 * Adapté à un déploiement mono-instance ou à une protection best-effort par
 * instance. Pour un vrai multi-instance, remplacer le store par Postgres/Redis
 * en gardant la même signature. On stocke un compteur par clé + un horodatage
 * de fin de fenêtre, avec purge paresseuse des entrées expirées.
 *
 * ⚠️ À n'utiliser que dans du code serveur (route handlers, server actions).
 */

interface Bucket {
  count: number;
  /** Timestamp (ms) de fin de la fenêtre courante. */
  resetAt: number;
}

interface RateLimitStore {
  buckets: Map<string, Bucket>;
  lastSweep: number;
}

// Survit aux invocations dans un même process (mais pas au cold start).
const globalStore = globalThis as unknown as {
  __orenRateLimit?: RateLimitStore;
};

function store(): RateLimitStore {
  if (!globalStore.__orenRateLimit) {
    globalStore.__orenRateLimit = { buckets: new Map(), lastSweep: 0 };
  }
  return globalStore.__orenRateLimit;
}

export interface RateLimitOptions {
  /** Nombre max de requêtes autorisées dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en millisecondes. */
  windowMs: number;
}

export interface RateLimitResult {
  /** true = requête autorisée ; false = quota dépassé. */
  ok: boolean;
  /** Requêtes restantes dans la fenêtre courante. */
  remaining: number;
  /** Secondes avant réinitialisation (utile pour l'en-tête Retry-After). */
  retryAfterSeconds: number;
}

/**
 * Consomme une unité de quota pour `key`. Renvoie ok=false si dépassé.
 *
 * @param key   Clé logique (ex. `otp:ip:1.2.3.4`, `otp:phone:+237...`).
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const s = store();

  // Purge paresseuse (au plus une fois par fenêtre) pour éviter les fuites.
  if (now - s.lastSweep > windowMs) {
    for (const [k, b] of s.buckets) {
      if (b.resetAt <= now) s.buckets.delete(k);
    }
    s.lastSweep = now;
  }

  const bucket = s.buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    s.buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Applique plusieurs limites (ex. par IP ET par numéro) et renvoie le premier
 * dépassement rencontré. Toutes les limites fournies sont consommées.
 */
export function rateLimitAll(
  checks: Array<{ key: string; options: RateLimitOptions }>,
): RateLimitResult {
  let worst: RateLimitResult | null = null;
  for (const { key, options } of checks) {
    const result = rateLimit(key, options);
    if (!result.ok && (!worst || result.retryAfterSeconds > worst.retryAfterSeconds)) {
      worst = result;
    }
  }
  return worst ?? { ok: true, remaining: 0, retryAfterSeconds: 0 };
}

/** Extrait une IP cliente exploitable depuis les en-têtes d'une requête. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
