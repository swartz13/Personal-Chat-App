const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');

/**
 * Signs the release build with our own signing key.
 *
 * Expo's default template signs the release build with a debug key too;
 * the debug key is the same on every machine and an app installed with it cannot be
 * updated later with the real key. This plugin uses the key in the
 * credentials/keystore.json file. If the file doesn't exist, it does nothing.
 *
 * Because the settings are written inside the android/ folder and that folder is
 * regenerated on every prebuild, this task was defined as a plugin.
 */

function readKeyInfo(projectRoot) {
  const keyFile = path.join(projectRoot, 'credentials', 'keystore.json');
  if (!fs.existsSync(keyFile)) return null;
  return JSON.parse(fs.readFileSync(keyFile, 'utf8'));
}

const withReleaseSigning = (config) => {
  // 1) Copy the key file into android/app (gradle reads from there).
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const keyInfo = readKeyInfo(cfg.modRequest.projectRoot);
      if (!keyInfo) return cfg;

      const source = path.join(cfg.modRequest.projectRoot, 'credentials', keyInfo.storeFile);
      const destination = path.join(cfg.modRequest.platformProjectRoot, 'app', keyInfo.storeFile);
      fs.copyFileSync(source, destination);
      return cfg;
    },
  ]);

  // 2) Add the release signing setting into build.gradle.
  config = withAppBuildGradle(config, (cfg) => {
    const keyInfo = readKeyInfo(cfg.modRequest.projectRoot);
    if (!keyInfo) return cfg;

    let content = cfg.modResults.contents;
    if (content.includes('// family-chat-release-sign')) return cfg;

    const signingBlock = `signingConfigs {
        release {
            // family-chat-release-sign
            storeFile file('\${keyInfo.storeFile}')
            storePassword '\${keyInfo.storePassword}'
            keyAlias '\${keyInfo.keyAlias}'
            keyPassword '\${keyInfo.keyPassword}'
        }`;

    const prevContent = content;
    content = content.replace(/signingConfigs \{/, signingBlock);
    if (content === prevContent) {
      throw new Error('[withReleaseSigning] signingConfigs block not found.');
    }

    // Replace the debug signature inside buildTypes > release with release.
    const targetLine =
      /(\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\s*\n\s*)signingConfig signingConfigs\.debug/;
    if (!targetLine.test(content)) {
      throw new Error(
        '[withReleaseSigning] signature line inside release buildType not found. ' +
          'Expo template might have changed; plugins/withReleaseSigning.js should be updated.'
      );
    }
    content = content.replace(targetLine, '$1signingConfig signingConfigs.release');

    cfg.modResults.contents = content;
    return cfg;
  });

  return config;
};

module.exports = withReleaseSigning;
