import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!rawUrl || !serviceKey) {
  throw new Error('Supabase environment variables are not configured');
}

// supabase-js expects the bare project URL, not a /rest/v1 path.
const baseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(baseUrl, serviceKey);
