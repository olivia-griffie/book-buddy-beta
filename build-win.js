const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function parseVersion(v) {
  const match = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function nextVersion(current) {
  const parsed = parseVersion(current);
  const floor = [1, 3, 0];
  if (
    !parsed ||
    parsed[0] < floor[0] ||
    (parsed[0] === floor[0] && parsed[1] < floor[1]) ||
    (parsed[0] === floor[0] && parsed[1] === floor[1] && parsed[2] < floor[2])
  ) return '1.3.0';
  return `${parsed[0]}.${parsed[1]}.${parsed[2] + 1}`;
}

const prev = pkg.version;
const next = nextVersion(prev);

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`\nInkbug Beta — Windows build`);
console.log(`Version: ${prev} → ${next}\n`);

const releasesDir = path.join(__dirname, 'releases');
const tmpOut = path.join(releasesDir, `tmp-${next}`);

// Build into a fresh temp directory — no old files to conflict with
const { build } = require('electron-builder');

build({
  targets: require('electron-builder').Platform.WINDOWS.createTarget(),
  config: {
    directories: {
      output: tmpOut,
      buildResources: 'public',
    },
  },
}).then(() => {
  // Move installer and updater metadata assets to releases/. Electron auto-update
  // needs latest.yml and blockmaps alongside the installer in the GitHub release.
  const releaseAssets = fs.readdirSync(tmpOut).filter((file) => {
    const fullPath = path.join(tmpOut, file);
    return fs.statSync(fullPath).isFile() && /\.(exe|yml|yaml|blockmap)$/i.test(file);
  });
  const installers = releaseAssets.filter((f) => f.endsWith('.exe'));
  for (const file of releaseAssets) {
    const dest = path.join(releasesDir, file);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(path.join(tmpOut, file), dest);
  }

  console.log(`\nBuild complete: v${next}`);
  console.log(`Updater assets: ${releaseAssets.map((file) => `releases/${file}`).join(', ')}`);
  console.log(`Installer → releases/${installers[0] || '(see releases/)'}`);
}).catch((err) => {
  console.error(`\nBuild failed: ${err.message}`);
  process.exit(1);
}).finally(() => {
  // Best-effort cleanup of the temp dir
  spawnSync('cmd', ['/c', `rd /s /q "${tmpOut}"`], { stdio: 'ignore' });
});
