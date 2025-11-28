import {
  decodeFunctionData,
  type Hex,
  type Abi,
  type AbiFunction,
} from 'viem';

export type SelectorCategory =
  | 'erc20'
  | 'erc721'
  | 'governance'
  | 'safe'
  | 'proxy'
  | 'access-control'
  | 'timelock'
  | 'other';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SelectorInfo {
  name: string;
  signature: string;
  description: string;
  category: SelectorCategory;
  riskLevel: RiskLevel;
  abi: AbiFunction;
}

export interface DecodedParam {
  name: string;
  type: string;
  value: unknown;
  display: string;
}

export interface DecodedInnerCalldata {
  status: 'decoded' | 'signature-only' | 'unknown';
  source: 'local' | 'user-abi' | 'sourcify' | 'sourcify-impl' | '4byte' | null;
  selector: Hex;
  functionName?: string;
  signature?: string;
  description?: string;
  category?: SelectorCategory;
  riskLevel?: RiskLevel;
  params?: DecodedParam[];
  summary?: string;
}

// Known role hashes for better display
const KNOWN_ROLES: Record<string, string> = {
  '0x0000000000000000000000000000000000000000000000000000000000000000': 'DEFAULT_ADMIN_ROLE',
  '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6': 'MINTER_ROLE',
  '0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848': 'BURNER_ROLE',
  '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a': 'PAUSER_ROLE',
  '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1': 'PROPOSER_ROLE',
  '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63': 'EXECUTOR_ROLE',
  '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5': 'TIMELOCK_ADMIN_ROLE',
  '0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783': 'CANCELLER_ROLE',
};

// ============================================================
// KNOWN SELECTORS DATABASE
// ============================================================

export const KNOWN_SELECTORS: Record<Hex, SelectorInfo> = {
  // ============ ERC20 ============
  '0xa9059cbb': {
    name: 'transfer',
    signature: 'transfer(address,uint256)',
    description: 'Transfer tokens to an address',
    category: 'erc20',
    riskLevel: 'low',
    abi: {
      name: 'transfer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
  },
  '0x23b872dd': {
    name: 'transferFrom',
    signature: 'transferFrom(address,address,uint256)',
    description: 'Transfer tokens from one address to another',
    category: 'erc20',
    riskLevel: 'low',
    abi: {
      name: 'transferFrom',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
  },
  '0x095ea7b3': {
    name: 'approve',
    signature: 'approve(address,uint256)',
    description: 'Approve an address to spend tokens',
    category: 'erc20',
    riskLevel: 'medium',
    abi: {
      name: 'approve',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
  },
  '0x40c10f19': {
    name: 'mint',
    signature: 'mint(address,uint256)',
    description: 'Mint new tokens to an address',
    category: 'erc20',
    riskLevel: 'high',
    abi: {
      name: 'mint',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [],
    },
  },
  '0x42966c68': {
    name: 'burn',
    signature: 'burn(uint256)',
    description: 'Burn tokens from caller',
    category: 'erc20',
    riskLevel: 'medium',
    abi: {
      name: 'burn',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'amount', type: 'uint256' }],
      outputs: [],
    },
  },
  '0x79cc6790': {
    name: 'burnFrom',
    signature: 'burnFrom(address,uint256)',
    description: 'Burn tokens from an address',
    category: 'erc20',
    riskLevel: 'medium',
    abi: {
      name: 'burnFrom',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'account', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [],
    },
  },
  '0x8456cb59': {
    name: 'pause',
    signature: 'pause()',
    description: 'Pause contract operations',
    category: 'erc20',
    riskLevel: 'high',
    abi: {
      name: 'pause',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [],
      outputs: [],
    },
  },
  '0x3f4ba83a': {
    name: 'unpause',
    signature: 'unpause()',
    description: 'Resume contract operations',
    category: 'erc20',
    riskLevel: 'high',
    abi: {
      name: 'unpause',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [],
      outputs: [],
    },
  },

  // ============ ERC721 ============
  '0x42842e0e': {
    name: 'safeTransferFrom',
    signature: 'safeTransferFrom(address,address,uint256)',
    description: 'Safely transfer an NFT',
    category: 'erc721',
    riskLevel: 'low',
    abi: {
      name: 'safeTransferFrom',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      outputs: [],
    },
  },
  '0xa22cb465': {
    name: 'setApprovalForAll',
    signature: 'setApprovalForAll(address,bool)',
    description: 'Approve or revoke operator for all NFTs',
    category: 'erc721',
    riskLevel: 'medium',
    abi: {
      name: 'setApprovalForAll',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'operator', type: 'address' },
        { name: 'approved', type: 'bool' },
      ],
      outputs: [],
    },
  },

  // ============ ACCESS CONTROL ============
  '0x2f2ff15d': {
    name: 'grantRole',
    signature: 'grantRole(bytes32,address)',
    description: 'Grant a role to an address',
    category: 'access-control',
    riskLevel: 'high',
    abi: {
      name: 'grantRole',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'role', type: 'bytes32' },
        { name: 'account', type: 'address' },
      ],
      outputs: [],
    },
  },
  '0xd547741f': {
    name: 'revokeRole',
    signature: 'revokeRole(bytes32,address)',
    description: 'Revoke a role from an address',
    category: 'access-control',
    riskLevel: 'high',
    abi: {
      name: 'revokeRole',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'role', type: 'bytes32' },
        { name: 'account', type: 'address' },
      ],
      outputs: [],
    },
  },
  '0x36568abe': {
    name: 'renounceRole',
    signature: 'renounceRole(bytes32,address)',
    description: 'Renounce a role (caller must be the account)',
    category: 'access-control',
    riskLevel: 'high',
    abi: {
      name: 'renounceRole',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'role', type: 'bytes32' },
        { name: 'account', type: 'address' },
      ],
      outputs: [],
    },
  },
  '0x13af4035': {
    name: 'setOwner',
    signature: 'setOwner(address)',
    description: 'Transfer ownership to a new address',
    category: 'access-control',
    riskLevel: 'critical',
    abi: {
      name: 'setOwner',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'newOwner', type: 'address' }],
      outputs: [],
    },
  },
  '0xf2fde38b': {
    name: 'transferOwnership',
    signature: 'transferOwnership(address)',
    description: 'Transfer ownership to a new address',
    category: 'access-control',
    riskLevel: 'critical',
    abi: {
      name: 'transferOwnership',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'newOwner', type: 'address' }],
      outputs: [],
    },
  },
  '0x715018a6': {
    name: 'renounceOwnership',
    signature: 'renounceOwnership()',
    description: 'Renounce ownership (no owner)',
    category: 'access-control',
    riskLevel: 'critical',
    abi: {
      name: 'renounceOwnership',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [],
      outputs: [],
    },
  },

  // ============ SAFE MULTISIG ============
  '0x0d582f13': {
    name: 'addOwnerWithThreshold',
    signature: 'addOwnerWithThreshold(address,uint256)',
    description: 'Add a new Safe owner and update threshold',
    category: 'safe',
    riskLevel: 'critical',
    abi: {
      name: 'addOwnerWithThreshold',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: '_threshold', type: 'uint256' },
      ],
      outputs: [],
    },
  },
  '0xf8dc5dd9': {
    name: 'removeOwner',
    signature: 'removeOwner(address,address,uint256)',
    description: 'Remove a Safe owner and update threshold',
    category: 'safe',
    riskLevel: 'critical',
    abi: {
      name: 'removeOwner',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'prevOwner', type: 'address' },
        { name: 'owner', type: 'address' },
        { name: '_threshold', type: 'uint256' },
      ],
      outputs: [],
    },
  },
  '0xe318b52b': {
    name: 'swapOwner',
    signature: 'swapOwner(address,address,address)',
    description: 'Replace a Safe owner with a new one',
    category: 'safe',
    riskLevel: 'critical',
    abi: {
      name: 'swapOwner',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'prevOwner', type: 'address' },
        { name: 'oldOwner', type: 'address' },
        { name: 'newOwner', type: 'address' },
      ],
      outputs: [],
    },
  },
  '0x694e80c3': {
    name: 'changeThreshold',
    signature: 'changeThreshold(uint256)',
    description: 'Change the required signature threshold',
    category: 'safe',
    riskLevel: 'critical',
    abi: {
      name: 'changeThreshold',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: '_threshold', type: 'uint256' }],
      outputs: [],
    },
  },
  '0x610b5925': {
    name: 'enableModule',
    signature: 'enableModule(address)',
    description: 'Enable a Safe module',
    category: 'safe',
    riskLevel: 'critical',
    abi: {
      name: 'enableModule',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'module', type: 'address' }],
      outputs: [],
    },
  },
  '0xe009cfde': {
    name: 'disableModule',
    signature: 'disableModule(address,address)',
    description: 'Disable a Safe module',
    category: 'safe',
    riskLevel: 'high',
    abi: {
      name: 'disableModule',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'prevModule', type: 'address' },
        { name: 'module', type: 'address' },
      ],
      outputs: [],
    },
  },
  '0xf08a0323': {
    name: 'setGuard',
    signature: 'setGuard(address)',
    description: 'Set a transaction guard',
    category: 'safe',
    riskLevel: 'critical',
    abi: {
      name: 'setGuard',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'guard', type: 'address' }],
      outputs: [],
    },
  },

  // ============ PROXY / UPGRADES ============
  '0x3659cfe6': {
    name: 'upgradeTo',
    signature: 'upgradeTo(address)',
    description: 'UPGRADE: Change contract implementation',
    category: 'proxy',
    riskLevel: 'critical',
    abi: {
      name: 'upgradeTo',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'newImplementation', type: 'address' }],
      outputs: [],
    },
  },
  '0x4f1ef286': {
    name: 'upgradeToAndCall',
    signature: 'upgradeToAndCall(address,bytes)',
    description: 'UPGRADE: Change implementation and call initializer',
    category: 'proxy',
    riskLevel: 'critical',
    abi: {
      name: 'upgradeToAndCall',
      type: 'function',
      stateMutability: 'payable',
      inputs: [
        { name: 'newImplementation', type: 'address' },
        { name: 'data', type: 'bytes' },
      ],
      outputs: [],
    },
  },
  '0x8f283970': {
    name: 'changeAdmin',
    signature: 'changeAdmin(address)',
    description: 'Change proxy admin address',
    category: 'proxy',
    riskLevel: 'critical',
    abi: {
      name: 'changeAdmin',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'newAdmin', type: 'address' }],
      outputs: [],
    },
  },

  // ============ TIMELOCK ============
  '0x64d62353': {
    name: 'updateDelay',
    signature: 'updateDelay(uint256)',
    description: 'Update the timelock delay period',
    category: 'timelock',
    riskLevel: 'high',
    abi: {
      name: 'updateDelay',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'newDelay', type: 'uint256' }],
      outputs: [],
    },
  },

  // ============ GOVERNANCE ============
  '0xda95691a': {
    name: 'propose',
    signature: 'propose(address[],uint256[],bytes[],string)',
    description: 'Create a new governance proposal',
    category: 'governance',
    riskLevel: 'medium',
    abi: {
      name: 'propose',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'targets', type: 'address[]' },
        { name: 'values', type: 'uint256[]' },
        { name: 'calldatas', type: 'bytes[]' },
        { name: 'description', type: 'string' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
  },
  '0xfe0d94c1': {
    name: 'execute',
    signature: 'execute(uint256)',
    description: 'Execute a passed proposal',
    category: 'governance',
    riskLevel: 'high',
    abi: {
      name: 'execute',
      type: 'function',
      stateMutability: 'payable',
      inputs: [{ name: 'proposalId', type: 'uint256' }],
      outputs: [],
    },
  },
  '0xddf0b009': {
    name: 'queue',
    signature: 'queue(address[],uint256[],bytes[],bytes32)',
    description: 'Queue a proposal for execution',
    category: 'governance',
    riskLevel: 'medium',
    abi: {
      name: 'queue',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'targets', type: 'address[]' },
        { name: 'values', type: 'uint256[]' },
        { name: 'calldatas', type: 'bytes[]' },
        { name: 'descriptionHash', type: 'bytes32' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
  },
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Extract the 4-byte selector from calldata
 */
export function getSelector(calldata: Hex): Hex | null {
  if (!calldata || calldata.length < 10) return null;
  return calldata.slice(0, 10).toLowerCase() as Hex;
}

/**
 * Truncate an address for display
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Truncate hex data for display
 */
export function truncateHex(hex: string, maxLength = 20): string {
  if (!hex || hex.length <= maxLength) return hex;
  return `${hex.slice(0, maxLength)}...`;
}

/**
 * Format a large number with commas
 */
export function formatNumber(value: bigint | string): string {
  const str = typeof value === 'bigint' ? value.toString() : value;
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a role hash to known name or truncated hex
 */
export function formatRole(roleHash: string): string {
  const normalized = roleHash.toLowerCase();
  return KNOWN_ROLES[normalized] || truncateHex(roleHash, 18);
}

/**
 * Format parameter value for display
 */
export function formatParamValue(type: string, value: unknown): string {
  if (value === null || value === undefined) return '—';

  if (type === 'address') {
    return truncateAddress(value as string);
  }

  if (type === 'uint256' || type === 'int256') {
    return formatNumber(value as bigint);
  }

  if (type === 'bytes32') {
    return formatRole(value as string);
  }

  if (type === 'bytes') {
    return truncateHex(value as string, 30);
  }

  if (type === 'bool') {
    return value ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }

  return String(value);
}

/**
 * Generate a plain English summary for a decoded function
 */
export function generateSummary(
  name: string,
  params: DecodedParam[]
): string {
  const templates: Record<string, (p: DecodedParam[]) => string> = {
    transfer: (p) =>
      `Transfer ${formatNumber(p[1]?.value as bigint)} tokens to ${truncateAddress(p[0]?.value as string)}`,
    transferFrom: (p) =>
      `Transfer ${formatNumber(p[2]?.value as bigint)} tokens from ${truncateAddress(p[0]?.value as string)} to ${truncateAddress(p[1]?.value as string)}`,
    approve: (p) =>
      `Approve ${truncateAddress(p[0]?.value as string)} to spend ${formatNumber(p[1]?.value as bigint)} tokens`,
    mint: (p) =>
      `Mint ${formatNumber(p[1]?.value as bigint)} tokens to ${truncateAddress(p[0]?.value as string)}`,
    burn: (p) => `Burn ${formatNumber(p[0]?.value as bigint)} tokens`,
    burnFrom: (p) =>
      `Burn ${formatNumber(p[1]?.value as bigint)} tokens from ${truncateAddress(p[0]?.value as string)}`,
    pause: () => `Pause contract operations`,
    unpause: () => `Resume contract operations`,
    grantRole: (p) =>
      `Grant ${formatRole(p[0]?.value as string)} to ${truncateAddress(p[1]?.value as string)}`,
    revokeRole: (p) =>
      `Revoke ${formatRole(p[0]?.value as string)} from ${truncateAddress(p[1]?.value as string)}`,
    renounceRole: (p) =>
      `Renounce ${formatRole(p[0]?.value as string)}`,
    transferOwnership: (p) =>
      `Transfer ownership to ${truncateAddress(p[0]?.value as string)}`,
    renounceOwnership: () => `Renounce ownership permanently`,
    addOwnerWithThreshold: (p) =>
      `Add ${truncateAddress(p[0]?.value as string)} as Safe owner, require ${p[1]?.value} signatures`,
    removeOwner: (p) =>
      `Remove ${truncateAddress(p[1]?.value as string)} from Safe owners, require ${p[2]?.value} signatures`,
    swapOwner: (p) =>
      `Replace Safe owner ${truncateAddress(p[1]?.value as string)} with ${truncateAddress(p[2]?.value as string)}`,
    changeThreshold: (p) =>
      `Change Safe threshold to ${p[0]?.value} required signatures`,
    enableModule: (p) =>
      `Enable Safe module at ${truncateAddress(p[0]?.value as string)}`,
    disableModule: (p) =>
      `Disable Safe module at ${truncateAddress(p[1]?.value as string)}`,
    setGuard: (p) =>
      `Set transaction guard to ${truncateAddress(p[0]?.value as string)}`,
    upgradeTo: (p) =>
      `UPGRADE contract to implementation at ${truncateAddress(p[0]?.value as string)}`,
    upgradeToAndCall: (p) =>
      `UPGRADE contract to ${truncateAddress(p[0]?.value as string)} and initialize`,
    changeAdmin: (p) =>
      `Change proxy admin to ${truncateAddress(p[0]?.value as string)}`,
    updateDelay: (p) =>
      `Update timelock delay to ${formatNumber(p[0]?.value as bigint)} seconds`,
  };

  const template = templates[name];
  if (template) {
    try {
      return template(params);
    } catch {
      // Fall through to default
    }
  }

  return `Call ${name}()`;
}

/**
 * Decode calldata using a provided ABI
 */
export function decodeWithAbi(
  calldata: Hex,
  abi: Abi
): { functionName: string; args: readonly unknown[] } | null {
  try {
    const result = decodeFunctionData({
      abi,
      data: calldata,
    });
    return {
      functionName: result.functionName,
      args: result.args ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Try to decode calldata using known selectors
 */
export function decodeWithKnownSelectors(calldata: Hex): DecodedInnerCalldata {
  const selector = getSelector(calldata);

  if (!selector) {
    return {
      status: 'unknown',
      source: null,
      selector: '0x' as Hex,
    };
  }

  const selectorInfo = KNOWN_SELECTORS[selector];

  if (!selectorInfo) {
    return {
      status: 'unknown',
      source: null,
      selector,
    };
  }

  // Try to decode parameters
  const decoded = decodeWithAbi(calldata, [selectorInfo.abi]);

  if (!decoded) {
    // Have signature but can't decode params
    return {
      status: 'signature-only',
      source: 'local',
      selector,
      functionName: selectorInfo.name,
      signature: selectorInfo.signature,
      description: selectorInfo.description,
      category: selectorInfo.category,
      riskLevel: selectorInfo.riskLevel,
    };
  }

  // Build params array
  const params: DecodedParam[] = selectorInfo.abi.inputs.map((input, i) => ({
    name: input.name || `arg${i}`,
    type: input.type,
    value: decoded.args[i],
    display: formatParamValue(input.type, decoded.args[i]),
  }));

  return {
    status: 'decoded',
    source: 'local',
    selector,
    functionName: selectorInfo.name,
    signature: selectorInfo.signature,
    description: selectorInfo.description,
    category: selectorInfo.category,
    riskLevel: selectorInfo.riskLevel,
    params,
    summary: generateSummary(selectorInfo.name, params),
  };
}
