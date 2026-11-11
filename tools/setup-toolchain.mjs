/**
 * Installs the project-local Android toolchain (nothing system-wide).
 *
 *   node tools/setup-toolchain.mjs
 *
 * Creates:
 *   tools/jdk-21.x/            Temurin JDK 21        (~195 MB)
 *   tools/android-sdk/         Android SDK           (~430 MB)
 *   tools/gradle-home/         Gradle + Maven cache  (created on first build)
 *
 * Delete tools/ to reclaim all of it.
 */
import { spawn } from 'node:child_process';
import { mkdir, rm, rename, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => resolve(root, ...s);

const JDK_URL = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse';
const CMDLINE_URL = 'https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip';
const SDK_PACKAGES = ['platform-tools', 'platforms/android-36', 'build-tools/36.0.0'];

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const useShell = process.platform === 'win32' && /\.(bat|cmd)$/i.test(cmd);
    const child = spawn(cmd, args, {
      cwd: opts.cwd || root,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: 'inherit',
      shell: useShell
    });
    child.on('error', rej);
    child.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} → ${code}`))));
  });
}

async function download(url, dest) {
  await mkdir(dirname(dest), { recursive: true });
  console.log('  ↓ ' + url.split('/').pop());
  await run('curl.exe', ['-L', '--fail', '--retry', '3', '-o', dest, url]);
}

// 1 ─ JDK -------------------------------------------------------------------
const existingJdk = (await readdir(p('tools'), { withFileTypes: true }).catch(() => []))
  .find((e) => e.isDirectory() && e.name.startsWith('jdk'));
if (existingJdk) {
  console.log('✔ JDK already present: tools/' + existingJdk.name);
} else {
  console.log('▸ JDK 21');
  const zip = p('tools', 'jdk.zip');
  await download(JDK_URL, zip);
  await run('tar', ['-xf', zip, '-C', p('tools')]);
  await rm(zip, { force: true });
}

const jdkEntry = (await readdir(p('tools'), { withFileTypes: true })).find((e) => e.isDirectory() && e.name.startsWith('jdk'));
const jdk = p('tools', jdkEntry.name);
const env = {
  JAVA_HOME: jdk,
  ANDROID_HOME: p('tools', 'android-sdk'),
  ANDROID_SDK_ROOT: p('tools', 'android-sdk'),
  PATH: `${jdk}\\bin;${process.env.PATH}`
};

// 2 ─ Android cmdline-tools -------------------------------------------------
const sdkmanager = p('tools', 'android-sdk', 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat');
if (!existsSync(sdkmanager)) {
  console.log('▸ Android command line tools');
  const zip = p('tools', 'cmdline.zip');
  await download(CMDLINE_URL, zip);
  const tmp = p('tools', 'cmdline-tmp');
  await mkdir(tmp, { recursive: true });
  await run('tar', ['-xf', zip, '-C', tmp]);
  await mkdir(p('tools', 'android-sdk', 'cmdline-tools'), { recursive: true });
  await rename(resolve(tmp, 'cmdline-tools'), p('tools', 'android-sdk', 'cmdline-tools', 'latest'));
  await rm(tmp, { recursive: true, force: true });
  await rm(zip, { force: true });
} else {
  console.log('✔ cmdline-tools already present');
}

// 3 ─ SDK packages ----------------------------------------------------------
console.log('▸ SDK packages: ' + SDK_PACKAGES.join(', '));
await run(sdkmanager, ['--sdk_root=' + p('tools', 'android-sdk'), ...SDK_PACKAGES], { env });

const sdkSize = (await stat(p('tools', 'android-sdk')).then(() => 0).catch(() => 0));
console.log('\n✔ Toolchain ready. Build the APK with:  npm run apk');
