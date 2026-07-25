import Redis from 'ioredis';
import crypto from 'crypto';

class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private connectionErrorCount: number = 0;
  private static readonly MAX_RETRIES = 3;
  private hasGivenUp: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD;

    try {
      console.log(`[Redis] Initializing client... URL: ${redisUrl ? 'Yes' : 'No'}, Host: ${redisHost}, Port: ${redisPort}`);

      const commonOptions = {
        maxRetriesPerRequest: 1, // Fail fast on requests
        enableOfflineQueue: false, // Don't queue commands if disconnected
        retryStrategy: (times: number) => {
           if (times > RedisService.MAX_RETRIES) {
               console.warn(`[Redis] Failed to connect after ${RedisService.MAX_RETRIES} attempts. Running without Redis caching.`);
               this.hasGivenUp = true;
               return null; // Stop retrying
           }
           console.log(`[Redis] Retry attempt ${times}/${RedisService.MAX_RETRIES}...`);
           return Math.min(times * 500, 3000);
        },
      };

      if (redisUrl) {
        this.client = new Redis(redisUrl, commonOptions);
      } else {
        this.client = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          ...commonOptions,
        });
      }

      this.client.on('connect', () => {
        this.isConnected = true;
        this.connectionErrorCount = 0;
        this.hasGivenUp = false;
        console.log('Successfully connected to Redis');
      });

      this.client.on('error', (error) => {
        this.connectionErrorCount++;
        this.isConnected = false;
        
        // Only log the first error and when giving up, suppress repeated ECONNREFUSED spam
        if (this.connectionErrorCount <= 1) {
          console.error('Redis connection error:', error.message || error);
        }
      });

      this.client.on('end', () => {
          if (this.hasGivenUp) {
            console.warn('[Redis] Client disconnected after max retries. Service will operate without caching.');
          }
          this.client = null;
          this.isConnected = false;
      });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      this.client = null;
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error getting key ${key} from Redis:`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      console.error(`Error setting key ${key} in Redis:`, error);
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Error deleting key ${key} from Redis:`, error);
    }
  }

  /**
   * Delete keys matching a pattern
   * Uses SCAN instead of KEYS to avoid blocking the server
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.client) {
      console.warn(`[Redis] Cannot delByPattern ${pattern}: Client not initialized`);
      return;
    }
    try {
      let cursor = '0';
      let totalDeleted = 0;

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      console.log(`[Redis] delByPattern: Deleted ${totalDeleted} keys for pattern "${pattern}"`);
    } catch (error) {
      console.error(`Error deleting keys with pattern ${pattern} from Redis:`, error);
    }
  }

  /**
   * Helper to generate a multi-tenant key
   */
  generateKey(companyId: number, resource: string, identifier: string = 'list', params: any = {}): string {
    // Create a canonical version of params by sorting keys
    // Exclude cache-busting timestamp parameters like '_ts' or '_'
    // BUT allow a specific '_cache_bypass' to change the key or be handled
    const sortedParams = Object.keys(params)
      .filter(key => key !== '_ts' && key !== '_')
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    // If _cache_bypass is present, we append a random suffix to forcedly miss the cache
    // effectively generating a new key every time this param is sent
    if (params._cache_bypass) {
      sortedParams._cache_bypass = Date.now().toString();
    }

    const queryPart = Object.keys(params).length > 0
      ? `:${crypto.createHash('md5').update(JSON.stringify(sortedParams)).digest('hex')}`
      : '';
    return `company:${companyId}:${resource}:${identifier}${queryPart}`;
  }
}

export const redisService = new RedisService();
