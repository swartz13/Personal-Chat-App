const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Builds the APK only for 64-bit ARM processors.
 *
 * The default setting packages four separate processor architectures at once, and with the WebRTC
 * library, the file size was increasing to 130 MB; in this state, it exceeds WhatsApp's
 * 100 MB file limit. All Android phones post-2015 are
 * arm64-v8a; if an old device comes up, 'armeabi-v7a' can be added to the list below.
 */
const ARCHITECTURES = 'arm64-v8a';

module.exports = function withArm64Only(config) {
  return withGradleProperties(config, (cfg) => {
    const properties = cfg.modResults;
    const key = 'reactNativeArchitectures';

    const existing = properties.find((item) => item.type === 'property' && item.key === key);
    if (existing) {
      existing.value = ARCHITECTURES;
    } else {
      properties.push({ type: 'property', key: key, value: ARCHITECTURES });
    }
    return cfg;
  });
};
