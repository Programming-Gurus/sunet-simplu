// electron-builder afterAllArtifactBuild hook: if APP_BUILDS_DIR is set, copy the installers of
// this build to its subfolder "Sunet Simplu", so another computer installs the app without a
// rebuild. Without APP_BUILDS_DIR the hook does nothing. If the folder is missing, the build
// still passes, and a line says the installers stay in dist.
const fs = require('node:fs');
const path = require('node:path');

const APP_FOLDER = 'Sunet Simplu';
// The dmg and the nsis exe. The blockmap files are for updates, not for a person.
const INSTALLER = /\.(dmg|exe)$/i;

exports.default = async function afterAllArtifactBuild({ artifactPaths }) {
  const root = process.env.APP_BUILDS_DIR;
  if (!root) return [];
  const installers = artifactPaths.filter((file) => INSTALLER.test(file));
  if (!fs.existsSync(root)) {
    console.log(`  • publish: ${root} not found; ${installers.length} installer(s) stay in dist`);
    return [];
  }
  const dest = path.join(root, APP_FOLDER);
  fs.mkdirSync(dest, { recursive: true });
  for (const file of installers) {
    fs.copyFileSync(file, path.join(dest, path.basename(file)));
    console.log(`  • publish: ${path.basename(file)} copied to ${dest}`);
  }
  return [];
};
