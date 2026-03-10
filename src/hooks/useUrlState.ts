import { useCallback, useEffect, useRef, useState } from 'react';
import { chains } from '../config/wagmi';

export interface Operation {
  target: string;
  value: string;
  data: string;
}

// Simple hash function for checksum (djb2)
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to hex and take first 6 chars for compact checksum
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

// Generate checksum for URL params (excluding the checksum itself)
function generateChecksum(params: URLSearchParams): string {
  const copy = new URLSearchParams(params);
  copy.delete('c'); // Remove existing checksum
  // Sort params for consistent hashing
  const sorted = Array.from(copy.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const str = sorted.map(([k, v]) => `${k}=${v}`).join('&');
  return hashString(str);
}

// Verify checksum matches
export function verifyChecksum(search: string): { valid: boolean; hasChecksum: boolean } {
  const params = new URLSearchParams(search);
  const checksum = params.get('c');
  if (!checksum) {
    return { valid: true, hasChecksum: false };
  }
  const expected = generateChecksum(params);
  return { valid: checksum === expected, hasChecksum: true };
}

export interface UrlState {
  tab: string;
  chainId: string;
  timelock: string;
  safe: string;
  ops: Operation[];
  delay: string;
  opId: string;
  calldata: string;
  decode: boolean;
  target: string;
  value: string;
  data: string;
}

const DEFAULT_STATE: UrlState = {
  tab: 'schedule',
  chainId: '',
  timelock: '',
  safe: '',
  ops: [{ target: '', value: '0', data: '0x' }],
  delay: '86400',
  opId: '',
  calldata: '',
  decode: false,
  target: '',
  value: '0',
  data: '0x',
};

const APP_STATE_KEY = 'safe-timelock-app-state';

// Detect if running in an iframe (Safe App mode)
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // If we can't access window.top due to cross-origin, we're in an iframe
    return true;
  }
}

function encodeOps(ops: Operation[]): string {
  try {
    return btoa(JSON.stringify(ops));
  } catch {
    return '';
  }
}

function decodeOps(encoded: string): Operation[] | null {
  try {
    const json = atob(encoded);
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every(op =>
      typeof op === 'object' &&
      'target' in op &&
      'value' in op &&
      'data' in op
    )) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function getSupportedChainId(chainId: string | number | undefined | null): number | undefined {
  if (chainId === undefined || chainId === null || chainId === '') return undefined;

  const parsed =
    typeof chainId === 'number' ? chainId : Number.parseInt(chainId, 10);

  if (!Number.isInteger(parsed)) return undefined;

  return chains.some((chain) => chain.id === parsed) ? parsed : undefined;
}

export function parseUrlState(): Partial<UrlState> {
  const params = new URLSearchParams(window.location.search);
  const state: Partial<UrlState> = {};

  const tab = params.get('tab');
  if (tab && ['schedule', 'execute', 'decode', 'hash', 'cancel'].includes(tab)) {
    state.tab = tab;
  }

  const chainId = params.get('chainId');
  if (chainId) state.chainId = chainId;

  const timelock = params.get('timelock');
  if (timelock) state.timelock = timelock;

  const safe = params.get('safe');
  if (safe) state.safe = safe;

  const opsEncoded = params.get('ops');
  if (opsEncoded) {
    const ops = decodeOps(opsEncoded);
    if (ops) state.ops = ops;
  }

  const delay = params.get('delay');
  if (delay) state.delay = delay;

  const opId = params.get('opId');
  if (opId) state.opId = opId;

  const calldata = params.get('calldata');
  if (calldata) state.calldata = calldata;

  const decode = params.get('decode');
  if (decode === '1' || decode === 'true') state.decode = true;

  const target = params.get('target');
  if (target) state.target = target;

  const value = params.get('value');
  if (value) state.value = value;

  const data = params.get('data');
  if (data) state.data = data;

  return state;
}

function buildUrl(state: Partial<UrlState>): string {
  const params = new URLSearchParams();

  if (state.tab && state.tab !== DEFAULT_STATE.tab) {
    params.set('tab', state.tab);
  }

  if (state.chainId) {
    params.set('chainId', state.chainId);
  }

  if (state.timelock) {
    params.set('timelock', state.timelock);
  }

  if (state.safe) {
    params.set('safe', state.safe);
  }

  if (state.ops && state.ops.length > 0) {
    const hasContent = state.ops.some(op => op.target || op.data !== '0x');
    if (hasContent) {
      params.set('ops', encodeOps(state.ops));
    }
  }

  if (state.delay && state.delay !== DEFAULT_STATE.delay) {
    params.set('delay', state.delay);
  }

  if (state.opId) {
    params.set('opId', state.opId);
  }

  if (state.calldata && state.calldata !== '0x') {
    params.set('calldata', state.calldata);
  }

  if (state.decode) {
    params.set('decode', '1');
  }

  if (state.target) {
    params.set('target', state.target);
  }

  if (state.value && state.value !== '0') {
    params.set('value', state.value);
  }

  if (state.data && state.data !== '0x') {
    params.set('data', state.data);
  }

  // Add checksum if there are params
  if (params.toString()) {
    params.set('c', generateChecksum(params));
  }

  const search = params.toString();
  return search ? `?${search}` : window.location.pathname;
}

// Generate a full shareable URL with checksum
export function getShareableUrl(state: Partial<UrlState>): string {
  const path = buildUrl(state);
  return `${window.location.origin}${window.location.pathname}${path.startsWith('?') ? path : ''}`;
}

export function useUrlState(localStorageTimelock: string, localStorageSafe: string): {
  initialState: UrlState;
  updateUrl: (state: Partial<UrlState>) => void;
  clearTabState: () => void;
  getCurrentShareableUrl: (overrides?: Partial<UrlState>) => string;
} {
  // Detect iframe mode once on mount
  const isIframeMode = useRef(isInIframe());

  const [initialState] = useState<UrlState>(() => {
    const urlState = parseUrlState();

    // If in iframe mode and URL has minimal params, try localStorage fallback
    if (isIframeMode.current && Object.keys(urlState).length <= 1) {
      const stored = localStorage.getItem(APP_STATE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            ...DEFAULT_STATE,
            timelock: urlState.timelock || parsed.timelock || localStorageTimelock || '',
            safe: urlState.safe || parsed.safe || localStorageSafe || '',
            ...parsed,
            ...urlState, // URL params still take priority
          };
        } catch {
          // Invalid JSON, ignore
        }
      }
    }

    return {
      ...DEFAULT_STATE,
      timelock: urlState.timelock || localStorageTimelock || '',
      safe: urlState.safe || localStorageSafe || '',
      ...urlState,
    };
  });

  const currentStateRef = useRef<Partial<UrlState>>(initialState);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const updateUrl = useCallback((state: Partial<UrlState>) => {
    currentStateRef.current = { ...currentStateRef.current, ...state };

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const url = buildUrl(currentStateRef.current);
      window.history.replaceState(null, '', url);

      // In iframe mode, also persist to localStorage as fallback
      if (isIframeMode.current) {
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(currentStateRef.current));
      }
    }, 100);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const clearTabState = useCallback(() => {
    // Clear any pending debounced updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Keep only tab, timelock, and safe in URL
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const chainId = params.get('chainId');
    const timelock = params.get('timelock');
    const safe = params.get('safe');

    const newParams = new URLSearchParams();
    if (tab) newParams.set('tab', tab);
    if (chainId) newParams.set('chainId', chainId);
    if (timelock) newParams.set('timelock', timelock);
    if (safe) newParams.set('safe', safe);

    const search = newParams.toString();
    const url = search ? `?${search}` : window.location.pathname;
    window.history.replaceState(null, '', url);

    // Reset current state ref to only keep tab, timelock, and safe
    currentStateRef.current = {
      tab: tab || undefined,
      chainId: chainId || undefined,
      timelock: timelock || undefined,
      safe: safe || undefined,
    };

    // Update iframe localStorage fallback, preserving timelock and safe
    if (isIframeMode.current) {
      let preservedTimelock = timelock;
      let preservedSafe = safe;
      if (!preservedTimelock || !preservedSafe) {
        try {
          const stored = localStorage.getItem(APP_STATE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (!preservedTimelock) preservedTimelock = parsed.timelock;
            if (!preservedSafe) preservedSafe = parsed.safe;
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (preservedTimelock || preservedSafe || tab) {
        localStorage.setItem(APP_STATE_KEY, JSON.stringify({
          tab: tab || undefined,
          chainId: chainId || undefined,
          timelock: preservedTimelock || undefined,
          safe: preservedSafe || undefined,
        }));
      } else {
        localStorage.removeItem(APP_STATE_KEY);
      }
    }
  }, []);

  const getCurrentShareableUrl = useCallback((overrides?: Partial<UrlState>) => {
    return getShareableUrl({ ...currentStateRef.current, ...overrides });
  }, []);

  return { initialState, updateUrl, clearTabState, getCurrentShareableUrl };
}
