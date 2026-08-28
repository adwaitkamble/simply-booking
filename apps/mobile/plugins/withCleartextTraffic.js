/**
 * Expo config plugin: allow cleartext (HTTP) traffic to the API server IP.
 *
 * Android blocks plain HTTP in release builds by default. Since the API
 * runs on a bare IP without TLS, we inject a network_security_config.xml
 * that explicitly permits cleartext traffic to that host only.
 *
 * This is scoped to the single server IP — all other traffic still requires HTTPS.
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const API_HOST = '15.252.181.3';

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
  <!-- Allow cleartext HTTP to the PMS API server only -->
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">${API_HOST}</domain>
  </domain-config>
  <!-- All other traffic must use HTTPS -->
  <base-config cleartextTrafficPermitted="false">
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
