import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(backendDir, '.env');
const envExamplePath = path.join(backendDir, '.env.example');

function appendLine(filePath, line) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const needsNewline = existing.length > 0 && !existing.endsWith('\n');
  if (existsSync(filePath)) {
    appendFileSync(filePath, (needsNewline ? '\n' : '') + line);
  } else {
    writeFileSync(filePath, line);
  }
}

if (!process.env.JWT_SECRET) {
  const secret = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = secret;
  appendLine(envPath, `JWT_SECRET=${secret}\n`);
  console.log('Generated a new JWT_SECRET and saved it to .env');
}

if (existsSync(envExamplePath) && !/^JWT_SECRET=/m.test(readFileSync(envExamplePath, 'utf8'))) {
  appendLine(envExamplePath, 'JWT_SECRET=your-secret-here\n');
}
