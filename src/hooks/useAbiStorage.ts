import { useState, useCallback, useSyncExternalStore } from 'react';
import {
  getAbis,
  saveAbi,
  deleteAbi,
  parseAbiJson,
  type StoredAbi,
} from '../lib/abi-storage';

// Simple event emitter for storage changes
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return JSON.stringify(getAbis());
}

/**
 * Hook to manage user-provided ABIs in localStorage
 * Uses useSyncExternalStore for reactive updates
 */
export function useAbiStorage() {
  const abisJson = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const abis: StoredAbi[] = JSON.parse(abisJson);

  const [error, setError] = useState<string | null>(null);

  const addAbi = useCallback((name: string, jsonString: string): boolean => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return false;
    }

    const abi = parseAbiJson(jsonString);

    if (!abi) {
      setError('Invalid ABI JSON. Make sure it contains at least one function.');
      return false;
    }

    try {
      saveAbi(name.trim(), abi);
      emitChange();
      return true;
    } catch (e) {
      setError('Failed to save ABI');
      return false;
    }
  }, []);

  const removeAbi = useCallback((id: string) => {
    deleteAbi(id);
    emitChange();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    abis,
    addAbi,
    removeAbi,
    error,
    clearError,
  };
}
