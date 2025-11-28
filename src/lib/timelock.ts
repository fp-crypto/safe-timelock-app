import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodeFunctionData,
  decodeFunctionData,
  decodeAbiParameters,
  type Hex,
  type Address,
  zeroHash,
} from 'viem';

// Known Safe MultiSend contract addresses (same across networks)
const MULTISEND_ADDRESSES = new Set([
  '0x40a2accbd92bca938b02010e17a5b8929b49130d', // MultiSend 1.3.0
  '0xa238cbeb142c10ef7ad8442c6d1f9e89e07e7761', // MultiSend Call Only 1.3.0
  '0x38869bf66a61cf6bdb996a6ae40d5853fd43b526', // MultiSend 1.4.1
  '0x9641d764fc13c8b624c04430c7356c1c7c8102e2', // MultiSend Call Only 1.4.1
].map(a => a.toLowerCase()));

// MultiSend function selector: multiSend(bytes)
const MULTISEND_SELECTOR = '0x8d80ff0a';

export interface MultiSendTransaction {
  operation: number;
  to: Address;
  value: bigint;
  data: Hex;
}

// Decode MultiSend transactions from packed bytes
export function decodeMultiSend(data: Hex): MultiSendTransaction[] {
  // Check for multiSend selector
  if (!data.toLowerCase().startsWith(MULTISEND_SELECTOR)) {
    return [];
  }

  try {
    // Decode the bytes parameter
    const [packedTxs] = decodeAbiParameters(
      [{ name: 'transactions', type: 'bytes' }],
      `0x${data.slice(10)}` as Hex
    );

    const transactions: MultiSendTransaction[] = [];
    let offset = 0;
    const bytes = packedTxs as Hex;
    const bytesArray = hexToBytes(bytes);

    while (offset < bytesArray.length) {
      // 1 byte operation
      const operation = bytesArray[offset];
      offset += 1;

      // 20 bytes address
      const to = bytesToHex(bytesArray.slice(offset, offset + 20)) as Address;
      offset += 20;

      // 32 bytes value (big endian)
      const valueBytes = bytesArray.slice(offset, offset + 32);
      const value = bytesToBigInt(valueBytes);
      offset += 32;

      // 32 bytes data length (big endian)
      const dataLenBytes = bytesArray.slice(offset, offset + 32);
      const dataLen = Number(bytesToBigInt(dataLenBytes));
      offset += 32;

      // data
      const txData = bytesToHex(bytesArray.slice(offset, offset + dataLen)) as Hex;
      offset += dataLen;

      transactions.push({ operation, to, value, data: txData });
    }

    return transactions;
  } catch {
    return [];
  }
}

// Check if address is a known MultiSend contract
export function isMultiSendAddress(address: string): boolean {
  return MULTISEND_ADDRESSES.has(address.toLowerCase());
}

// Extract timelock calldata from a Safe transaction (handles MultiSend)
export function extractTimelockCalldata(
  to: string,
  data: Hex,
  timelockAddress: string
): Hex | null {
  const normalizedTimelock = timelockAddress.toLowerCase();

  // Direct call to timelock
  if (to.toLowerCase() === normalizedTimelock) {
    return data;
  }

  // Check if it's a MultiSend call
  if (isMultiSendAddress(to)) {
    const txs = decodeMultiSend(data);
    // Find the transaction targeting the timelock
    const timelockTx = txs.find(tx => tx.to.toLowerCase() === normalizedTimelock);
    if (timelockTx) {
      return timelockTx.data;
    }
  }

  return null;
}

// Helper functions for byte manipulation
function hexToBytes(hex: Hex): Uint8Array {
  const str = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(str.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(str.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

// OpenZeppelin TimelockController ABI
export const TIMELOCK_ABI = [
  {
    name: 'schedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'predecessor', type: 'bytes32' },
      { name: 'salt', type: 'bytes32' },
      { name: 'delay', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'scheduleBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'payloads', type: 'bytes[]' },
      { name: 'predecessor', type: 'bytes32' },
      { name: 'salt', type: 'bytes32' },
      { name: 'delay', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'payload', type: 'bytes' },
      { name: 'predecessor', type: 'bytes32' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'executeBatch',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'payloads', type: 'bytes[]' },
      { name: 'predecessor', type: 'bytes32' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'cancel',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getMinDelay',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isOperation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isOperationPending',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isOperationReady',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isOperationDone',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getTimestamp',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Types
export interface Operation {
  target: Address;
  value: bigint;
  data: Hex;
}

export interface TimelockParams {
  predecessor: Hex;
  salt: Hex;
  delay: bigint;
}

export interface DecodedTimelock {
  functionName: string;
  operationId?: Hex;
  target?: Address;
  value?: string;
  data?: Hex;
  operations?: { target: Address; value: string; data: Hex }[];
  predecessor?: Hex;
  salt?: Hex;
  delay?: string;
}

// Hash a single operation (replicates OZ's hashOperation)
export function hashOperation(
  target: Address,
  value: bigint,
  data: Hex,
  predecessor: Hex,
  salt: Hex
): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, uint256, bytes, bytes32, bytes32'),
      [target, value, data, predecessor, salt]
    )
  );
}

// Hash a batch operation
export function hashOperationBatch(
  targets: Address[],
  values: bigint[],
  payloads: Hex[],
  predecessor: Hex,
  salt: Hex
): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address[], uint256[], bytes[], bytes32, bytes32'),
      [targets, values, payloads, predecessor, salt]
    )
  );
}

// Encode schedule() calldata
export function encodeSchedule(
  target: Address,
  value: bigint,
  data: Hex,
  predecessor: Hex,
  salt: Hex,
  delay: bigint
): { calldata: Hex; operationId: Hex } {
  const calldata = encodeFunctionData({
    abi: TIMELOCK_ABI,
    functionName: 'schedule',
    args: [target, value, data, predecessor, salt, delay],
  });

  const operationId = hashOperation(target, value, data, predecessor, salt);

  return { calldata, operationId };
}

// Encode scheduleBatch() calldata
export function encodeScheduleBatch(
  targets: Address[],
  values: bigint[],
  payloads: Hex[],
  predecessor: Hex,
  salt: Hex,
  delay: bigint
): { calldata: Hex; operationId: Hex } {
  const calldata = encodeFunctionData({
    abi: TIMELOCK_ABI,
    functionName: 'scheduleBatch',
    args: [targets, values, payloads, predecessor, salt, delay],
  });

  const operationId = hashOperationBatch(targets, values, payloads, predecessor, salt);

  return { calldata, operationId };
}

// Encode execute() calldata
export function encodeExecute(
  target: Address,
  value: bigint,
  data: Hex,
  predecessor: Hex,
  salt: Hex
): { calldata: Hex; operationId: Hex } {
  const calldata = encodeFunctionData({
    abi: TIMELOCK_ABI,
    functionName: 'execute',
    args: [target, value, data, predecessor, salt],
  });

  const operationId = hashOperation(target, value, data, predecessor, salt);

  return { calldata, operationId };
}

// Encode executeBatch() calldata
export function encodeExecuteBatch(
  targets: Address[],
  values: bigint[],
  payloads: Hex[],
  predecessor: Hex,
  salt: Hex
): { calldata: Hex; operationId: Hex } {
  const calldata = encodeFunctionData({
    abi: TIMELOCK_ABI,
    functionName: 'executeBatch',
    args: [targets, values, payloads, predecessor, salt],
  });

  const operationId = hashOperationBatch(targets, values, payloads, predecessor, salt);

  return { calldata, operationId };
}

// Encode cancel() calldata
export function encodeCancel(operationId: Hex): Hex {
  return encodeFunctionData({
    abi: TIMELOCK_ABI,
    functionName: 'cancel',
    args: [operationId],
  });
}

// Decode timelock calldata
export function decodeTimelockCalldata(calldata: Hex): DecodedTimelock | null {
  try {
    const { functionName, args } = decodeFunctionData({
      abi: TIMELOCK_ABI,
      data: calldata,
    });

    switch (functionName) {
      case 'schedule': {
        const [target, value, data, predecessor, salt, delay] = args as [
          Address,
          bigint,
          Hex,
          Hex,
          Hex,
          bigint
        ];
        return {
          functionName,
          target,
          value: value.toString(),
          data,
          predecessor,
          salt,
          delay: delay.toString(),
          operationId: hashOperation(target, value, data, predecessor, salt),
        };
      }

      case 'scheduleBatch': {
        const [targets, values, payloads, predecessor, salt, delay] = args as [
          Address[],
          bigint[],
          Hex[],
          Hex,
          Hex,
          bigint
        ];
        return {
          functionName,
          operations: targets.map((t, i) => ({
            target: t,
            value: values[i].toString(),
            data: payloads[i],
          })),
          predecessor,
          salt,
          delay: delay.toString(),
          operationId: hashOperationBatch(targets, values, payloads, predecessor, salt),
        };
      }

      case 'execute': {
        const [target, value, data, predecessor, salt] = args as [
          Address,
          bigint,
          Hex,
          Hex,
          Hex
        ];
        return {
          functionName,
          target,
          value: value.toString(),
          data,
          predecessor,
          salt,
          operationId: hashOperation(target, value, data, predecessor, salt),
        };
      }

      case 'executeBatch': {
        const [targets, values, payloads, predecessor, salt] = args as [
          Address[],
          bigint[],
          Hex[],
          Hex,
          Hex
        ];
        return {
          functionName,
          operations: targets.map((t, i) => ({
            target: t,
            value: values[i].toString(),
            data: payloads[i],
          })),
          predecessor,
          salt,
          operationId: hashOperationBatch(targets, values, payloads, predecessor, salt),
        };
      }

      case 'cancel': {
        const [id] = args as [Hex];
        return {
          functionName,
          operationId: id,
        };
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Generate random salt
export function generateRandomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as Hex;
}

// Format delay as human readable
export function formatDelay(seconds: bigint | string): string {
  const secs = typeof seconds === 'string' ? BigInt(seconds) : seconds;
  const days = secs / 86400n;
  const hours = (secs % 86400n) / 3600n;
  const mins = (secs % 3600n) / 60n;

  const parts: string[] = [];
  if (days > 0n) parts.push(`${days}d`);
  if (hours > 0n) parts.push(`${hours}h`);
  if (mins > 0n) parts.push(`${mins}m`);
  if (parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

export { zeroHash };
