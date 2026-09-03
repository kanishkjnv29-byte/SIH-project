import 'dotenv/config';
import { existsSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const hasLegacyPair = Boolean(anonKey) && Boolean(serviceKey);
const hasNewPair = Boolean(publishableKey) && Boolean(secretKey);

const missing = [];
if (!url) missing.push('SUPABASE_URL');

if (!hasLegacyPair && !hasNewPair) {
  if (anonKey || serviceKey) {
    if (!anonKey) missing.push('SUPABASE_ANON_KEY');
    if (!serviceKey) missing.push('SUPABASE_SERVICE_KEY');
  } else if (publishableKey || secretKey) {
    if (!publishableKey) missing.push('SUPABASE_PUBLISHABLE_KEY');
    if (!secretKey) missing.push('SUPABASE_SECRET_KEY');
  } else {
    missing.push('SUPABASE_ANON_KEY/SUPABASE_SERVICE_KEY (or SUPABASE_PUBLISHABLE_KEY/SUPABASE_SECRET_KEY)');
  }
}

if (missing.length > 0) {
  console.error('❌ Missing required environment variable(s):');
  for (const name of missing) console.error(`   - ${name}`);
  process.exit(1);
}

const secretForClient = hasLegacyPair ? serviceKey : secretKey;
// supabase-js wants the bare project URL, not a /rest/v1 path some dashboards copy.
const baseUrl = url.replace(/\/rest\/v1\/?$/, '');
const secrets = [url, baseUrl, anonKey, serviceKey, publishableKey, secretKey].filter(Boolean);

function redact(text) {
  let out = String(text);
  for (const secret of secrets) out = out.split(secret).join('[REDACTED]');
  return out;
}

const packageInstalled = existsSync(new URL('./node_modules/@supabase/supabase-js/package.json', import.meta.url));

if (!packageInstalled) {
  console.log('@supabase/supabase-js not found — installing...');
  execSync('npm install @supabase/supabase-js', { stdio: 'inherit' });
  // Node's ESM resolver caches package lookups per-process, so a freshly
  // installed package isn't reliably importable until the next process.
  console.log('Re-running with the newly installed package...');
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const { createClient } = await import('@supabase/supabase-js');

const supabase = createClient(baseUrl, secretForClient);

try {
  const { error } = await supabase.storage.listBuckets();
  if (error) throw error;
  console.log('✅ Connected to Supabase successfully');
} catch (err) {
  console.error('❌ Connection failed:', redact(err.message || err));
  process.exit(1);
}
