import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// This explicitly loads the .env from your current directory
dotenv.config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // We use a fallback check to throw a clearer error if it's missing
    url: process.env.DATABASE_URL,
  },
});