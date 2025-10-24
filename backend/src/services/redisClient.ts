import { createClient } from 'redis';

/**
 * Redis client singleton for session state management
 * Enables horizontal backend scaling and persistent session state
 */

type SafeRedisClient = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  connect: () => Promise<void>;
  quit: () => Promise<void>;
  disconnect: () => Promise<void>;
  isOpen: boolean;
  setEx: (key: string, ttlSeconds: number, value: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  rPush: (key: string, value: string) => Promise<number>;
  lTrim: (key: string, start: number, stop: number) => Promise<string>;
  lRange: (key: string, start: number, stop: number) => Promise<string[]>;
  set: (key: string, value: string, options?: { NX?: boolean; EX?: number }) => Promise<string | null>;
};

let redisClient: SafeRedisClient | null = null;
let isConnecting = false;
let connectionFailed = false;

/**
 * Get the Redis URL from environment or default to localhost
 */
function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

/**
 * Create and configure Redis client
 */
function createRedisClient(): SafeRedisClient {
  const url = getRedisUrl();
  
  const client = createClient({
    url,
    socket: {
      reconnectStrategy: retries => {
        // Exponential backoff with max 5 seconds
        const delay = Math.min(retries * 50, 5000);
        console.log(`[redis] Reconnection attempt ${retries}, waiting ${delay}ms...`);
        return delay;
      },
    },
  }) as unknown as SafeRedisClient;

  // Event handlers
  client.on('error', (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[redis] ❌ Redis Client Error:', msg);
    connectionFailed = true;
  });

  client.on('connect', () => {
    console.log('[redis] 🔌 Redis Client Connecting...');
    connectionFailed = false;
  });

  client.on('ready', () => {
    console.log('[redis] ✅ Redis Client Connected and Ready');
    connectionFailed = false;
  });

  client.on('reconnecting', () => {
    console.log('[redis] 🔄 Redis Client Reconnecting...');
  });

  client.on('end', () => {
    console.log('[redis] 🔌 Redis Client Connection Ended');
  });

  return client;
}

/**
 * Connect to Redis
 * Safe to call multiple times - will only connect once
 */
export async function connectRedis(): Promise<void> {
  // Already connected
  if (redisClient?.isOpen) {
    console.log('[redis] Already connected');
    return;
  }

  // Connection in progress
  if (isConnecting) {
    console.log('[redis] Connection already in progress, waiting...');
    // Wait for connection to complete
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  // Skip if Redis URL not configured
  if (!process.env.REDIS_URL) {
    console.log('[redis] ⚠️  REDIS_URL not configured, skipping Redis connection');
    console.log('[redis] ℹ️  Sessions will use in-memory storage (not suitable for production)');
    return;
  }

  try {
    isConnecting = true;
    console.log(`[redis] Connecting to Redis at ${getRedisUrl()}...`);
    
    redisClient = createRedisClient();
    await redisClient.connect();
    
    console.log('[redis] ✅ Redis connected successfully');
  } catch (error) {
    console.error('[redis] ❌ Failed to connect to Redis:', error);
    console.error('[redis] ⚠️  Falling back to in-memory storage');
    redisClient = null;
    connectionFailed = true;
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnect from Redis gracefully
 */
export async function disconnectRedis(): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    if (redisClient.isOpen) {
      console.log('[redis] Disconnecting from Redis...');
      await redisClient.quit();
      console.log('[redis] ✅ Redis disconnected');
    }
  } catch (error) {
    console.error('[redis] ❌ Error disconnecting from Redis:', error);
    // Force close if quit fails
    try {
      await redisClient.disconnect();
    } catch (disconnectError) {
      console.error('[redis] ❌ Error force disconnecting:', disconnectError);
    }
  } finally {
    redisClient = null;
  }
}

/**
 * Get the Redis client instance
 * Returns null if not connected
 */
export function getRedisClient(): SafeRedisClient | null {
  if (!redisClient?.isOpen) {
    return null;
  }
  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient?.isOpen === true && !connectionFailed;
}

/**
 * Get connection status for health checks
 */
export function getRedisStatus(): {
  connected: boolean;
  url: string | null;
  error: boolean;
} {
  return {
    connected: redisClient?.isOpen === true,
    url: process.env.REDIS_URL || null,
    error: connectionFailed,
  };
}

/**
 * Safely set a value in Redis with TTL
 * Falls back to in-memory if Redis unavailable
 *
 * @param key - Redis key
 * @param value - Value to store
 * @param ttlSeconds - Time to live in seconds
 * @returns true if stored in Redis, false if fallback used
 */
export async function setWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const client = getRedisClient();
  
  if (!client) {
    // Redis not available - caller should handle fallback
    return false;
  }

  try {
    await client.setEx(key, ttlSeconds, value);
    return true;
  } catch (error) {
    console.error(`[redis] ❌ Error setting key ${key}:`, error);
    return false;
  }
}

/**
 * Safely get a value from Redis
 * Returns null if Redis unavailable or key not found
 *
 * @param key - Redis key
 * @returns Value or null
 */
export async function get(key: string): Promise<string | null> {
  const client = getRedisClient();
  
  if (!client) {
    // Redis not available - caller should handle fallback
    return null;
  }

  try {
    return await client.get(key);
  } catch (error) {
    console.error(`[redis] ❌ Error getting key ${key}:`, error);
    return null;
  }
}

/**
 * Safely delete a key from Redis
 *
 * @param key - Redis key
 * @returns true if deleted, false otherwise
 */
export async function del(key: string): Promise<boolean> {
  const client = getRedisClient();
  
  if (!client) {
    return false;
  }

  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`[redis] ❌ Error deleting key ${key}:`, error);
    return false;
  }
}

/**
 * Atomically append an item to a Redis list (RPUSH)
 */
export async function rpush(key: string, value: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.rPush(key, value);
    return true;
  } catch (error) {
    console.error(`[redis] ❌ Error RPUSH ${key}:`, error);
    return false;
  }
}

/**
 * Trim a Redis list to a specific range (LTRIM)
 */
export async function ltrim(key: string, start: number, stop: number): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.lTrim(key, start, stop);
    return true;
  } catch (error) {
    console.error(`[redis] ❌ Error LTRIM ${key}:`, error);
    return false;
  }
}

/**
 * Read a range from a Redis list (LRANGE)
 */
export async function lrange(key: string, start: number, stop: number): Promise<string[] | null> {
  const client = getRedisClient();
  if (!client) return null;
  try {
    return await client.lRange(key, start, stop);
  } catch (error) {
    console.error(`[redis] ❌ Error LRANGE ${key}:`, error);
    return null;
  }
}

/**
 * Set key if not exists with TTL (SET NX EX)
 */
export async function setNxWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  try {
    const res = await client.set(key, value, { NX: true, EX: ttlSeconds });
    return res === 'OK';
  } catch (error) {
    console.error(`[redis] ❌ Error SET NX ${key}:`, error);
    return false;
  }
}
