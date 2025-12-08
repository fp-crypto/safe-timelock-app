import { useCallback, useEffect, useRef, useState } from 'react';

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
  timelock: string;
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
  timelock: '',
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

export function parseUrlState(): Partial<UrlState> {
  const params = new URLSearchParams(window.location.search);
  const state: Partial<UrlState> = {};

  const tab = params.get('tab');
  if (tab && ['schedule', 'execute', 'decode', 'hash', 'cancel'].includes(tab)) {
    state.tab = tab;
  }

  const timelock = params.get('timelock');
  if (timelock) state.timelock = timelock;

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

  if (state.timelock) {
    params.set('timelock', state.timelock);
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

export function useUrlState(localStorageTimelock: string): {
  initialState: UrlState;
  updateUrl: (state: Partial<UrlState>) => void;
  clearTabState: () => void;
  getCurrentShareableUrl: () => string;
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
      ...urlState,
    };
  });

  const currentStateRef = useRef<Partial<UrlState>>({});
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

    // Keep only tab and timelock in URL
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const timelock = params.get('timelock');

    const newParams = new URLSearchParams();
    if (tab) newParams.set('tab', tab);
    if (timelock) newParams.set('timelock', timelock);

    const search = newParams.toString();
    const url = search ? `?${search}` : window.location.pathname;
    window.history.replaceState(null, '', url);

    // Reset current state ref to only keep tab and timelock
    currentStateRef.current = {
      tab: tab || undefined,
      timelock: timelock || undefined,
    };

    // Update iframe localStorage fallback, preserving timelock
    if (isIframeMode.current) {
      // Preserve timelock from existing storage if not in URL
      let preservedTimelock = timelock;
      if (!preservedTimelock) {
        try {
          const stored = localStorage.getItem(APP_STATE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            preservedTimelock = parsed.timelock;
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Store only tab and timelock, clearing all other fields
      if (preservedTimelock || tab) {
        localStorage.setItem(APP_STATE_KEY, JSON.stringify({
          tab: tab || undefined,
          timelock: preservedTimelock || undefined,
        }));
      } else {
        localStorage.removeItem(APP_STATE_KEY);
      }
    }
  }, []);

  const getCurrentShareableUrl = useCallback(() => {
    return getShareableUrl(currentStateRef.current);
  }, []);

  return { initialState, updateUrl, clearTabState, getCurrentShareableUrl };
}
