import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory fallback for environments where native AsyncStorage module may be unlinked
const memoryStore = new Map<string, string>();

export const SafeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) {
      // Fallback silently to memoryStore
    }
    return memoryStore.get(key) ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryStore.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      // Memory store is already updated
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryStore.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      // Memory store is already cleared
    }
  },

  async clear(): Promise<void> {
    memoryStore.clear();
    try {
      await AsyncStorage.clear();
    } catch (e) {
      // Memory store cleared
    }
  },
};
