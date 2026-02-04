import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  TARGET_API_KEY: z.string().min(1),
  BATCH_SIZE: z.coerce.number().default(5000),
  RATE_LIMIT_DELAY_MS: z.coerce.number().default(6000), // 10 req/min = 1 req per 6s
});

export const env = envSchema.parse(process.env);
