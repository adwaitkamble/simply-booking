import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  StatusBar,
  LogBox,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { Navigator } from './src/navigation/Navigator';
import { SplashScreen } from './src/components/SplashScreen';

LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'Possible Unhandled Promise Rejection',
]);

// ─── Global unhandled-promise crash catcher ───────────────────────────────────
// React Native's ErrorBoundary only catches *synchronous* render errors.
// Unhandled promise rejections (e.g. a bad require() inside a useEffect) are
// swallowed silently or crash the app without a visible message.
// This listener surfaces them so we can see them on-screen via the boundary.
let _globalErrorHandler: ((msg: string) => void) | null = null;

if (typeof global !== 'undefined') {
  const originalHandler = (global as any).ErrorUtils?.getGlobalHandler?.();

  (global as any).ErrorUtils?.setGlobalHandler?.((error: any, isFatal: boolean) => {
    const msg = error?.message || String(error);
    console.error('💥 Global JS Error:', msg, error?.stack);
    if (_globalErrorHandler) {
      _globalErrorHandler(`[${isFatal ? 'FATAL' : 'ERROR'}] ${msg}\n\n${error?.stack || ''}`);
    }
    if (originalHandler) originalHandler(error, isFatal);
  });
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface EBState {
  hasError: boolean;
  error: Error | null;
  globalMsg: string | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, globalMsg: null };
    // Wire up the global handler so unhandled rejections also show here
    _globalErrorHandler = (msg: string) => {
      this.setState({ hasError: true, globalMsg: msg });
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('💥 ErrorBoundary caught:', error.message, info.componentStack);
  }

  componentWillUnmount() {
    _globalErrorHandler = null;
  }

  render() {
    const { hasError, error, globalMsg } = this.state;
    if (!hasError) return this.props.children;

    const title = error?.message || globalMsg?.split('\n')[0] || 'Unknown crash';
    const stack = error?.stack || globalMsg || '';

    return (
      <View style={fb.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1e1e2e" />
        <Text style={fb.emoji}>💥</Text>
        <Text style={fb.title}>App Crashed</Text>
        <Text style={fb.subtitle}>{title}</Text>

        <ScrollView style={fb.scroll} contentContainerStyle={{ paddingBottom: 12 }}>
          <Text style={fb.stack}>{stack}</Text>
        </ScrollView>

        <TouchableOpacity
          style={fb.btn}
          onPress={() => this.setState({ hasError: false, error: null, globalMsg: null })}
        >
          <Text style={fb.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const fb = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f87171',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  stack: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    lineHeight: 15,
  },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [splashError, setSplashError] = useState<string | null>(null);

  const initializeApp = async () => {
    try {
      setSplashError(null);
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
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
        <SplashScreen error={splashError} onRetry={initializeApp} />
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <Navigator />
          </SafeAreaView>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
});
