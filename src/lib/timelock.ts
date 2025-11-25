import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodeFunctionData,
  decodeFunctionData,
  type Hex,
  type Address,
  zeroHash,
} from 'viem';

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
