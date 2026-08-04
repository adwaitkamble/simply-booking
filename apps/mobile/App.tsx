import React, { useState, useEffect } from 'react';
import { StyleSheet, StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { Navigator } from './src/navigation/Navigator';
import { SplashScreen } from './src/components/SplashScreen';

// Suppress dev-time network logger noise on physical devices
LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'Possible Unhandled Promise Rejection',
]);

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [splashError, setSplashError] = useState<string | null>(null);

  const initializeApp = async () => {
    try {
      setSplashError(null);
      // Ensure splash is visible for at least 1.5s for a smooth branded experience
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsAppReady(true);
    } catch (err: any) {
      console.warn('App Init Error:', err);
      setIsAppReady(true);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  if (!isAppReady) {
    return (
      <SafeAreaProvider>
        <SplashScreen
          error={splashError}
          onRetry={initializeApp}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <Navigator />
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
