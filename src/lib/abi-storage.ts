import { type Abi, type Hex, toFunctionSelector } from 'viem';

const STORAGE_KEY = 'safe-timelock-user-abis';

export interface StoredAbi {
  id: string;
  name: string;
  abi: Abi;
  selectors: Hex[];
  createdAt: number;
}

/**
 * Generate a simple UUID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract function selectors from an ABI
 */
export function extractSelectors(abi: Abi): Hex[] {
  const selectors: Hex[] = [];

  for (const item of abi) {
    if (item.type === 'function') {
      try {
        const selector = toFunctionSelector(item);
        selectors.push(selector.toLowerCase() as Hex);
      } catch {
        // Skip items that can't be converted
      }
    }
  }

  return selectors;
}

/**
 * Parse and validate ABI JSON
 */
export function parseAbiJson(jsonString: string): Abi | null {
  try {
    const parsed = JSON.parse(jsonString);

    // Handle both array format and object with abi property
    const abi = Array.isArray(parsed) ? parsed : parsed.abi;

    if (!Array.isArray(abi)) {
      return null;
    }

    // Basic validation: check it has at least one function
    const hasFunctions = abi.some(
      (item) => item.type === 'function' || item.type === 'event'
    );

    if (!hasFunctions) {
      return null;
    }

    return abi as Abi;
  } catch {
    return null;
  }
}

/**
 * Get all stored ABIs from localStorage
 */
export function getAbis(): StoredAbi[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as StoredAbi[];
  } catch {
    return [];
  }
}

/**
 * Save a new ABI to localStorage
 */
export function saveAbi(name: string, abi: Abi): StoredAbi {
  const selectors = extractSelectors(abi);

  const newAbi: StoredAbi = {
    id: generateId(),
    name,
    abi,
    selectors,
    createdAt: Date.now(),
  };

  const existing = getAbis();
  existing.push(newAbi);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  return newAbi;
}

/**
 * Delete an ABI from localStorage
 */
export function deleteAbi(id: string): void {
  const existing = getAbis();
  const filtered = existing.filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Find a stored ABI that contains a specific selector
 */
export function findAbiBySelector(selector: Hex): StoredAbi | null {
  const normalized = selector.toLowerCase() as Hex;
  const abis = getAbis();

  for (const storedAbi of abis) {
    if (storedAbi.selectors.includes(normalized)) {
      return storedAbi;
    }
  }

  return null;
}

/**
 * Get function info from a stored ABI by selector
 */
export function getFunctionFromAbi(
  abi: Abi,
  selector: Hex
): { name: string; inputs: { name: string; type: string }[] } | null {
  const normalized = selector.toLowerCase();

  for (const item of abi) {
    if (item.type === 'function') {
      try {
        const itemSelector = toFunctionSelector(item).toLowerCase();
        if (itemSelector === normalized) {
          return {
            name: item.name,
            inputs: item.inputs.map((input) => ({
              name: input.name || '',
              type: input.type,
            })),
          };
        }
      } catch {
        // Skip
      }
    }
  }

  return null;
}
