/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'Simply booking',
  slug: 'simply-booking',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',

  // New Architecture and edge-to-edge are deliberately kept off until the app
  // is verified stable on a production device. Both can be enabled later once
  // the base build is confirmed working.
  // newArchEnabled: true,  // re-enable after confirming stability

  splash: {
    image: './assets/splash.png',
    resizeMode: 'cover',
    backgroundColor: '#FAF7F3',
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#FAF7F3',
    },
    package: 'com.adwaitkamble007.simplybooking',
    // edgeToEdgeEnabled forces RN 0.86 edge-to-edge layout on Android —
    // disabled until SafeAreaView insets are verified working correctly.
    // edgeToEdgeEnabled: true,
  },

  platforms: ['ios', 'android', 'web'],

  extra: {
    eas: {
      projectId: '58cd8984-2f37-4252-a3c8-23bd99bbe4ad',
    },
  },

  // Allow HTTP traffic to the API server IP (Android blocks cleartext by default).
  plugins: [
    './plugins/withCleartextTraffic',
  ],
};
