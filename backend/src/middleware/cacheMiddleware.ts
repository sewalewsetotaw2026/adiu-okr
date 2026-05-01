import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redisService';

/**
 * Middleware factory for caching GET requests
 * @param resource The resource name (e.g., 'employees', 'analytics')
 * @param ttlSeconds Cache expiration time
 * @param userSpecific Whether the cache key should be specific to the requesting user
 */
export const cacheMiddleware = (resource: string, ttlSeconds: number = 3600, userSpecific: boolean = false) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const companyId = req.user?.company_id;
    if (!companyId) {
      console.warn(`[Cache] No companyId found for request to ${req.path}`);
      return next();
    }

    // Generate unique key based on URL, query, and company
    let cacheKey = redisService.generateKey(companyId, resource, req.path, req.query);

    if (userSpecific && req.user?.user_id) {
      cacheKey = `${cacheKey}:user:${req.user.user_id}`;
    }

    try {
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        console.log(`[Cache Hit] Key: ${cacheKey}`);
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cachedData);
      }

      console.log(`[Cache Miss] Key: ${cacheKey}`);
      res.setHeader('X-Cache', 'MISS');

      // Monkey-patch res.json to capture and cache the response
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        // Only cache successful responses
        if (res.statusCode === 200) {
          console.log(`[Cache Store] Key: ${cacheKey}`);
          redisService.set(cacheKey, body, ttlSeconds).catch(err =>
            console.error(`Failed to set cache for ${cacheKey}:`, err)
          );
        } else {
          console.log(`[Cache Skip] Key: ${cacheKey} (Status: ${res.statusCode})`);
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error(`Cache middleware error for ${cacheKey}:`, error);
      next();
    }
  };
};
