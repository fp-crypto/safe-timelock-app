const STORAGE_KEY = 'api-keys';

export type ApiKeyId = 'safe' | 'etherscan';

export interface ApiKeyConfig {
  id: ApiKeyId;
  name: string;
  description: string;
  portalUrl: string;
}

export const API_KEY_CONFIGS: ApiKeyConfig[] = [
  {
    id: 'safe',
    name: 'Safe',
    description: 'For Safe Transaction Service API (higher rate limits)',
    portalUrl: 'https://developer.safe.global/',
  },
  {
    id: 'etherscan',
    name: 'Etherscan',
    description: 'For contract ABI lookups and verification',
    portalUrl: 'https://etherscan.io/myapikey',
  },
];

export function getApiKey(id: ApiKeyId): string | null {
  try {
    const keys = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return keys[id] || null;
  } catch {
    return null;
  }
}

export function setApiKey(id: ApiKeyId, key: string): void {
  const keys = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  keys[id] = key.trim();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function clearApiKey(id: ApiKeyId): void {
  const keys = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  delete keys[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function getAllApiKeys(): Partial<Record<ApiKeyId, string>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
