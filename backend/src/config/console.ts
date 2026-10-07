import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * ┌──────────────────────────────────────────────────────────────┐
 * │  BAGIAN 1: TERMINAL / CONSOLE SETTINGS                      │
 * │  Setting server, port, database, URL frontend                │
 * │  Biasanya TIDAK perlu diubah untuk development               │
 * └──────────────────────────────────────────────────────────────┘
 */
export const CONSOLE_CONFIG = {
  /** Port server backend */
  PORT: Number(process.env.PORT) || 4000,

  /** Mode: 'development' | 'production' */
  NODE_ENV: process.env.NODE_ENV || 'development',

  /** URL frontend React/Vite */
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  /** Connection string PostgreSQL */
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/wayahedigital_db?schema=public',

  /** Supabase Database & API Settings */
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '',

  /** MongoDB Connection Settings (Legacy / Fallback) */
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGODB_DBNAME: process.env.MONGODB_DBNAME || '',
  MONGODB_DBNAME_TRANS: process.env.MONGODB_DBNAME_TRANS || '',

  /** Token admin untuk proteksi /api/supabase/exec-sql & endpoint sensitif */
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || process.env.ADMIN_API_KEY || 'wayahe_admin_secret_token_1234',

  /** Apakah mode production? */
  get isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },
};

export default CONSOLE_CONFIG;
