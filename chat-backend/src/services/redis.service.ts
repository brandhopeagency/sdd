import Redis from 'ioredis';

export type RedisStatus = 'connected' | 'disconnected' | 'reconnecting';

let client: InstanceType<typeof Redis> | null = null;
let status: RedisStatus = 'disconnected';

function getConfig() {
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    host: process.env.REDIS_HOST || (isDev ? 'localhost' : ''),
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT) || 2000,
    commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT) || 1000,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
  };
}

export async function connect(): Promise<void> {
  if (client) return;

  const config = getConfig();
  client = new Redis(config);

  client.on('connect', () => {
    status = 'connected';
    const env = process.env.NODE_ENV || 'development';
    console.log(`[Redis] Connected: ${config.host}:${config.port} (env=${env})`);
  });

  client.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('close', () => {
    status = 'disconnected';
    console.warn('[Redis] Connection closed');
  });

  client.on('reconnecting', () => {
    status = 'reconnecting';
    console.log('[Redis] Reconnecting...');
  });

  await client.connect();
}

export async function disconnect(): Promise<void> {
  if (!client) return;
  await client.quit();
  client = null;
  status = 'disconnected';
  console.log('[Redis] Disconnected');
}

function getClient(): InstanceType<typeof Redis> {
  if (!client) {
    throw new Error('Redis client not initialized — call connect() first');
  }
  return client;
}

export function getStatus(): RedisStatus {
  return status;
}

export function isHealthy(): boolean {
  return status === 'connected';
}

// ── Typed command wrappers ──

export async function get(key: string): Promise<string | null> {
  return getClient().get(key);
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await getClient().set(key, value, 'EX', ttlSeconds);
  } else {
    await getClient().set(key, value);
  }
}

export async function del(...keys: string[]): Promise<number> {
  return getClient().del(...keys);
}

export async function sadd(key: string, ...members: string[]): Promise<number> {
  return getClient().sadd(key, ...members);
}

export async function srem(key: string, ...members: string[]): Promise<number> {
  return getClient().srem(key, ...members);
}

export async function smembers(key: string): Promise<string[]> {
  return getClient().smembers(key);
}

export function multi() {
  return getClient().multi();
}

export function getRawClient(): InstanceType<typeof Redis> | null {
  return client;
}

export default {
  connect,
  disconnect,
  getStatus,
  isHealthy,
  get,
  set,
  del,
  sadd,
  srem,
  smembers,
  multi,
  getRawClient,
};
