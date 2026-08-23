// Uploads redacted session artifacts to Cloudflare R2 via the `rclone` CLI,
// using the already-configured `r2:` remote (see `rclone config show r2`).
// We deliberately never read R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY here —
// rclone already has them, so the daemon process never needs to hold raw keys.

const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function readEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Only the non-secret fields we actually need — bucket name + public base URL. */
function loadR2PublicConfig() {
  const envPath = path.join(os.homedir(), '.config', 'r2-upload', 'env');
  const env = readEnvFile(envPath);
  return {
    bucket: env.R2_BUCKET || 'agent-sessions',
    publicBase: env.R2_PUBLIC_BASE || null,
  };
}

function rcloneCopyTo(localPath, remoteKey, bucket) {
  return new Promise((resolve, reject) => {
    const dest = `r2:${bucket}/${remoteKey}`;
    execFile('rclone', ['copyto', localPath, dest, '--quiet'], { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`rclone copyto ${remoteKey} failed: ${stderr || err.message}`));
        return;
      }
      resolve();
    });
  });
}

function rcloneDelete(remoteKey, bucket) {
  return new Promise((resolve, reject) => {
    execFile('rclone', ['deletefile', `r2:${bucket}/${remoteKey}`, '--quiet'], { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`rclone deletefile ${remoteKey} failed: ${stderr || err.message}`));
        return;
      }
      resolve();
    });
  });
}

module.exports = { loadR2PublicConfig, rcloneCopyTo, rcloneDelete };
