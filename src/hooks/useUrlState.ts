import { useCallback, useEffect, useRef, useState } from 'react';

export interface Operation {
  target: string;
  value: string;
  data: string;
}

export interface UrlState {
  tab: string;
  timelock: string;
  ops: Operation[];
  delay: string;
  opId: string;
  calldata: string;
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
  target: '',
  value: '0',
  data: '0x',
};

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

function parseUrlState(): Partial<UrlState> {
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

  if (state.target) {
    params.set('target', state.target);
  }

  if (state.value && state.value !== '0') {
    params.set('value', state.value);
  }

  if (state.data && state.data !== '0x') {
    params.set('data', state.data);
  }

  const search = params.toString();
  return search ? `?${search}` : window.location.pathname;
}

export function useUrlState(localStorageTimelock: string): {
  initialState: UrlState;
  updateUrl: (state: Partial<UrlState>) => void;
} {
  const [initialState] = useState<UrlState>(() => {
    const urlState = parseUrlState();
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
    }, 100);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { initialState, updateUrl };
}
