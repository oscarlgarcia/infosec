import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';

config({ path: path.join(process.cwd(), '.env') });

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
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
