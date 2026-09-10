/**
 * Expo config plugin: allow cleartext (HTTP) traffic in release builds.
 *
 * Android blocks plain HTTP in release builds by default. Since the API runs on
 * a bare IP without TLS, we inject a network_security_config.xml that permits
 * cleartext traffic globally via base-config.
 *
 * A <domain> tag cannot hold a raw IP address — Android rejects such a config at
 * runtime and falls back to blocking all cleartext, which kills API traffic on
 * launch. So the permission has to be granted through base-config instead.
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Step 1: Write the network_security_config.xml file into the Android res/xml directory
function withNetworkSecurityConfig(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const xmlDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');

      fs.mkdirSync(xmlDir, { recursive: true });

      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Allow cleartext HTTP traffic to backend IP and all endpoints -->
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

      fs.writeFileSync(xmlPath, xmlContent, 'utf8');
      return modConfig;
    },
  ]);
}

// Step 2: Point AndroidManifest.xml at the security config file
function withManifestNetworkSecurityConfig(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const application = manifest.manifest.application?.[0];

    if (application) {
      application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      // Also explicitly allow cleartext at the application level as a fallback
      application.$['android:usesCleartextTraffic'] = 'true';
    }

    return modConfig;
  });
}

// Compose both modifications
module.exports = function withCleartextTraffic(config) {
  config = withNetworkSecurityConfig(config);
  config = withManifestNetworkSecurityConfig(config);
  return config;
};
