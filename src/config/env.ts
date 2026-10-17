import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST is required'),
  POSTGRES_PORT: z.coerce.number().int().positive('POSTGRES_PORT must be a positive integer'),
  POSTGRES_DB: z.string().min(1, 'POSTGRES_DB is required'),
  POSTGRES_USER: z.string().min(1, 'POSTGRES_USER is required'),
  POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD is required'),
  VECTOR_DIMENSION: z.coerce.number().int().positive().default(1536),
  REDIS_HOST: z.string().min(1, 'REDIS_HOST is required').default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive('REDIS_PORT must be a positive integer').default(6380),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(rawEnv: Record<string, string | undefined> = process.env): AppConfig {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errorDetails}`);
  }
  return result.data;
}

// In test environment, allow dynamic configuration without top-level throw
export const env: AppConfig = process.env.NODE_ENV === 'test' 
  ? (process.env.POSTGRES_HOST ? loadConfig() : ({} as AppConfig))
  : loadConfig();
