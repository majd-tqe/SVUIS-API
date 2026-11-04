import { svuisClient } from '../adapters/svuis-client.js';
import { cacheService } from './cache.service.js';

export async function getUpstreamHealth() {
  const result = await cacheService.getOrFetch('upstream-health', () => svuisClient.isReachable(), 30);
  return { reachable: result.data, checkedAt: result.fetchedAt };
}
