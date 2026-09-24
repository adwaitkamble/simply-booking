const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    
    if (androidManifest && androidManifest.application && androidManifest.application.length > 0) {
      const app = androidManifest.application[0];
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    
    return config;
  });
};
