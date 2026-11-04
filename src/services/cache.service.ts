import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 120, checkperiod: 60 });
interface CacheEntry<T> { data: T; fetchedAt: string }

export const cacheService = {
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<{ data: T; cached: boolean; fetchedAt: string }> {
    const cached = cache.get<CacheEntry<T>>(key);
    if (cached !== undefined) {
      return { ...cached, cached: true };
    }

    const data = await fetcher();
    const entry = { data, fetchedAt: new Date().toISOString() };

    if (ttl !== undefined) {
      cache.set(key, entry, ttl);
    } else {
      cache.set(key, entry);
    }

    return { ...entry, cached: false };
  },

  invalidate(keys: string | string[]): void {
    const k = Array.isArray(keys) ? keys : [keys];
    cache.del(k);
  },

  invalidateSession(sessionId: string): void {
    cache.del(cache.keys().filter(key => key.split(':').includes(sessionId)));
  },

  flush(): void {
    cache.flushAll();
  },

  size(): number {
    return cache.keys().length;
  },

  getStats(): { keys: number; hits: number; misses: number } {
    const stats = cache.getStats();
    return {
      keys: cache.keys().length,
      hits: stats.hits || 0,
      misses: stats.misses || 0,
    };
  },
};
