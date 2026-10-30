import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';

config({ path: path.join(process.cwd(), '.env') });

/**
 * `z.coerce.boolean()` treats any non-empty string (including "false") as
 * true. New feature flags use this parser so `.env` values behave as expected.
 */
const booleanEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_MODEL_MINI: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_USE_RESPONSES: z.coerce.boolean().default(false),
  OPENAI_VECTOR_STORE_IDS: z.string().default(''),
  OPENAI_INGEST_TO_VECTOR_STORES: z.coerce.boolean().default(false),
  OLLAMA_HOST: z.string().default('llm-ollama'),
  OLLAMA_PORT: z.string().default('11434'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/infosec'),
  CHROMA_PERSIST_DIRECTORY: z.string().default('./data/chroma'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Request 360 feature flag and defaults
  REQUEST_360_ENABLED: z.coerce.boolean().default(true),
  DEFAULT_TIMEZONE: z.string().default('Europe/Madrid'),

  // Document storage: "local" (default) or "s3" (AWS S3 / MinIO compatible)
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads/requests'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  // Notifications
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('infosec@board.local'),
  NOTIFY_WEBHOOK_URL: z.string().optional(),
  EMAIL_INBOUND_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().default('http://localhost:5173'),

  // SLA scheduler
  SLA_SCHEDULER_ENABLED: z.coerce.boolean().default(true),
  SLA_SCHEDULER_INTERVAL_MS: z.coerce.number().default(15 * 60 * 1000),

  // CVE ingestion (NVD + CISA KEV)
  NVD_API_KEY: z.string().optional(),
  NVD_API_BASE_URL: z.string().default('https://services.nvd.nist.gov/rest/json/cves/2.0'),
  NVD_SYNC_ENABLED: booleanEnv.default(true),
  NVD_SYNC_INTERVAL_MS: z.coerce.number().default(2 * 60 * 60 * 1000),
  NVD_BACKFILL_START: z.string().default('2026-01-01'),
  NVD_INGEST_REJECTED: booleanEnv.default(false),
  NVD_REQUEST_TIMEOUT_MS: z.coerce.number().default(90000),
  KEV_FEED_URL: z.string().default('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'),
  KEV_SYNC_ENABLED: booleanEnv.default(true),
  KEV_SYNC_INTERVAL_MS: z.coerce.number().default(6 * 60 * 60 * 1000),
  CVE_MATCHER_ENABLED: booleanEnv.default(true),
  CVE_SYNC_START_DELAY_MS: z.coerce.number().default(60000),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
