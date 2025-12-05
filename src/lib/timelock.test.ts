import { describe, it, expect } from 'vitest';
import { keccak256, encodeAbiParameters, parseAbiParameters, type Hex, type Address } from 'viem';
import {
  hashOperation,
  hashOperationBatch,
  encodeSchedule,
  encodeScheduleBatch,
  encodeExecute,
  encodeExecuteBatch,
  encodeCancel,
  decodeTimelockCalldata,
  decodeMultiSend,
  isMultiSendAddress,
  extractTimelockCalldata,
  formatDelay,
  generateRandomSalt,
  zeroHash,
  TIMELOCK_ABI,
} from './timelock';

// Test fixtures
const TEST_TARGET: Address = '0x1234567890123456789012345678901234567890';
const TEST_TARGET_2: Address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const TEST_VALUE = 1000000000000000000n; // 1 ETH
const TEST_DATA: Hex = '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890000000000000000000000000000000000000000000000000000000000000000a';
const TEST_PREDECESSOR: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';
const TEST_SALT: Hex = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const TEST_DELAY = 86400n; // 1 day

// MultiSend addresses (canonical Safe deployments)
const MULTISEND_1_3_0 = '0x40a2accbd92bca938b02010e17a5b8929b49130d';
const MULTISEND_CALL_ONLY_1_3_0 = '0xa238cbeb142c10ef7ad8442c6d1f9e89e07e7761';
const MULTISEND_1_4_1 = '0x38869bf66a61cf6bdb996a6ae40d5853fd43b526';

describe('hashOperation', () => {
  it('should produce deterministic hash for same inputs', () => {
    const hash1 = hashOperation(TEST_TARGET, TEST_VALUE, TEST_DATA, TEST_PREDECESSOR, TEST_SALT);
    const hash2 = hashOperation(TEST_TARGET, TEST_VALUE, TEST_DATA, TEST_PREDECESSOR, TEST_SALT);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different inputs', () => {
    const hash1 = hashOperation(TEST_TARGET, TEST_VALUE, TEST_DATA, TEST_PREDECESSOR, TEST_SALT);
    const hash2 = hashOperation(TEST_TARGET, TEST_VALUE + 1n, TEST_DATA, TEST_PREDECESSOR, TEST_SALT);
    expect(hash1).not.toBe(hash2);
  });

  it('should match OZ TimelockController hash algorithm', () => {
    // OZ hashOperation: keccak256(abi.encode(target, value, data, predecessor, salt))
    const expected = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address, uint256, bytes, bytes32, bytes32'),
        [TEST_TARGET, TEST_VALUE, TEST_DATA, TEST_PREDECESSOR, TEST_SALT]
      )
    );
    const actual = hashOperation(TEST_TARGET, TEST_VALUE, TEST_DATA, TEST_PREDECESSOR, TEST_SALT);
    expect(actual).toBe(expected);
  });

  it('should handle empty data', () => {
    const hash = hashOperation(TEST_TARGET, 0n, '0x', TEST_PREDECESSOR, TEST_SALT);
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should handle zero value', () => {
    const hash = hashOperation(TEST_TARGET, 0n, TEST_DATA, TEST_PREDECESSOR, TEST_SALT);
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});

describe('hashOperationBatch', () => {
  it('should produce deterministic hash for same inputs', () => {
    const targets = [TEST_TARGET, TEST_TARGET_2];
    const values = [TEST_VALUE, 0n];
    const payloads: Hex[] = [TEST_DATA, '0x'];

    const hash1 = hashOperationBatch(targets, values, payloads, TEST_PREDECESSOR, TEST_SALT);
    const hash2 = hashOperationBatch(targets, values, payloads, TEST_PREDECESSOR, TEST_SALT);
    expect(hash1).toBe(hash2);
  });

  it('should match OZ TimelockController batch hash algorithm', () => {
    const targets = [TEST_TARGET, TEST_TARGET_2];
    const values = [TEST_VALUE, 0n];
    const payloads: Hex[] = [TEST_DATA, '0x'];

    const expected = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address[], uint256[], bytes[], bytes32, bytes32'),
        [targets, values, payloads, TEST_PREDECESSOR, TEST_SALT]
      )
    );
    const actual = hashOperationBatch(targets, values, payloads, TEST_PREDECESSOR, TEST_SALT);
    expect(actual).toBe(expected);
  });

  it('should handle single operation batch', () => {
    const hash = hashOperationBatch([TEST_TARGET], [TEST_VALUE], [TEST_DATA], TEST_PREDECESSOR, TEST_SALT);
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should handle empty arrays', () => {
    const hash = hashOperationBatch([], [], [], TEST_PREDECESSOR, TEST_SALT);
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});

describe('encodeSchedule / decodeTimelockCalldata round-trip', () => {
  it('should encode and decode schedule correctly', () => {
    const { calldata, operationId } = encodeSchedule(
      TEST_TARGET,
      TEST_VALUE,
      TEST_DATA,
      TEST_PREDECESSOR,
      TEST_SALT,
      TEST_DELAY
    );

    const decoded = decodeTimelockCalldata(calldata);

    expect(decoded).not.toBeNull();
    expect(decoded?.functionName).toBe('schedule');
    expect(decoded?.target).toBe(TEST_TARGET);
    expect(decoded?.value).toBe(TEST_VALUE.toString());
    expect(decoded?.data).toBe(TEST_DATA);
    expect(decoded?.predecessor).toBe(TEST_PREDECESSOR);
    expect(decoded?.salt).toBe(TEST_SALT);
    expect(decoded?.delay).toBe(TEST_DELAY.toString());
    expect(decoded?.operationId).toBe(operationId);
  });

  it('should encode and decode scheduleBatch correctly', () => {
    const targets = [TEST_TARGET, TEST_TARGET_2];
    const values = [TEST_VALUE, 0n];
    const payloads: Hex[] = [TEST_DATA, '0x'];

    const { calldata, operationId } = encodeScheduleBatch(
      targets,
      values,
      payloads,
      TEST_PREDECESSOR,
      TEST_SALT,
      TEST_DELAY
    );

    const decoded = decodeTimelockCalldata(calldata);

    expect(decoded).not.toBeNull();
    expect(decoded?.functionName).toBe('scheduleBatch');
    expect(decoded?.operations).toHaveLength(2);
    expect(decoded?.operations?.[0].target.toLowerCase()).toBe(TEST_TARGET.toLowerCase());
    expect(decoded?.operations?.[0].value).toBe(TEST_VALUE.toString());
    expect(decoded?.operations?.[0].data.toLowerCase()).toBe(TEST_DATA.toLowerCase());
    expect(decoded?.operations?.[1].target.toLowerCase()).toBe(TEST_TARGET_2.toLowerCase());
    expect(decoded?.operations?.[1].value).toBe('0');
    expect(decoded?.operations?.[1].data).toBe('0x');
    expect(decoded?.operationId).toBe(operationId);
  });

  it('should encode and decode execute correctly', () => {
    const { calldata, operationId } = encodeExecute(
      TEST_TARGET,
      TEST_VALUE,
      TEST_DATA,
      TEST_PREDECESSOR,
      TEST_SALT
    );

    const decoded = decodeTimelockCalldata(calldata);

    expect(decoded).not.toBeNull();
    expect(decoded?.functionName).toBe('execute');
    expect(decoded?.target).toBe(TEST_TARGET);
    expect(decoded?.value).toBe(TEST_VALUE.toString());
    expect(decoded?.data).toBe(TEST_DATA);
    expect(decoded?.predecessor).toBe(TEST_PREDECESSOR);
    expect(decoded?.salt).toBe(TEST_SALT);
    expect(decoded?.operationId).toBe(operationId);
  });

  it('should encode and decode executeBatch correctly', () => {
    const targets = [TEST_TARGET, TEST_TARGET_2];
    const values = [TEST_VALUE, 0n];
    const payloads: Hex[] = [TEST_DATA, '0x'];

    const { calldata, operationId } = encodeExecuteBatch(
      targets,
      values,
      payloads,
      TEST_PREDECESSOR,
      TEST_SALT
    );

    const decoded = decodeTimelockCalldata(calldata);

    expect(decoded).not.toBeNull();
    expect(decoded?.functionName).toBe('executeBatch');
    expect(decoded?.operations).toHaveLength(2);
    expect(decoded?.operationId).toBe(operationId);
  });

  it('should encode and decode cancel correctly', () => {
    const testOperationId: Hex = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const calldata = encodeCancel(testOperationId);

    const decoded = decodeTimelockCalldata(calldata);

    expect(decoded).not.toBeNull();
    expect(decoded?.functionName).toBe('cancel');
    expect(decoded?.operationId).toBe(testOperationId);
  });
});

describe('decodeTimelockCalldata edge cases', () => {
  it('should return null for invalid calldata', () => {
    expect(decodeTimelockCalldata('0x1234')).toBeNull();
    expect(decodeTimelockCalldata('0x')).toBeNull();
  });

  it('should return null for unknown function selector', () => {
    // Random selector that doesn't match any timelock function
    expect(decodeTimelockCalldata('0xdeadbeef00000000000000000000000000000000000000000000000000000000')).toBeNull();
  });

  it('should handle zeroHash as predecessor', () => {
    const { calldata } = encodeSchedule(TEST_TARGET, TEST_VALUE, TEST_DATA, zeroHash, TEST_SALT, TEST_DELAY);
    const decoded = decodeTimelockCalldata(calldata);
    expect(decoded?.predecessor).toBe(zeroHash);
  });
});

describe('decodeMultiSend', () => {
  // Helper to create packed MultiSend data
  function packMultiSendTx(txs: Array<{ operation: number; to: Address; value: bigint; data: Hex }>): Hex {
    let packed = '';
    for (const tx of txs) {
      // operation (1 byte)
      packed += tx.operation.toString(16).padStart(2, '0');
      // to (20 bytes, remove 0x prefix)
      packed += tx.to.slice(2).toLowerCase();
      // value (32 bytes, big endian)
      packed += tx.value.toString(16).padStart(64, '0');
      // data length (32 bytes, big endian)
      const dataBytes = tx.data.slice(2);
      const dataLen = dataBytes.length / 2;
      packed += dataLen.toString(16).padStart(64, '0');
      // data
      packed += dataBytes;
    }
    return `0x${packed}` as Hex;
  }

  function encodeMultiSendCalldata(packedTxs: Hex): Hex {
    const selector = '0x8d80ff0a';
    // ABI encode the bytes parameter
    const encoded = encodeAbiParameters(
      [{ name: 'transactions', type: 'bytes' }],
      [packedTxs]
    );
    return `${selector}${encoded.slice(2)}` as Hex;
  }

  it('should decode single transaction', () => {
    const txs = [{ operation: 0, to: TEST_TARGET, value: TEST_VALUE, data: TEST_DATA }];
    const packed = packMultiSendTx(txs);
    const calldata = encodeMultiSendCalldata(packed);

    const decoded = decodeMultiSend(calldata);

    expect(decoded).toHaveLength(1);
    expect(decoded[0].operation).toBe(0);
    expect(decoded[0].to.toLowerCase()).toBe(TEST_TARGET.toLowerCase());
    expect(decoded[0].value).toBe(TEST_VALUE);
    expect(decoded[0].data.toLowerCase()).toBe(TEST_DATA.toLowerCase());
  });

  it('should decode multiple transactions', () => {
    const txs = [
      { operation: 0, to: TEST_TARGET, value: TEST_VALUE, data: TEST_DATA },
      { operation: 1, to: TEST_TARGET_2, value: 0n, data: '0x' as Hex },
    ];
    const packed = packMultiSendTx(txs);
    const calldata = encodeMultiSendCalldata(packed);

    const decoded = decodeMultiSend(calldata);

    expect(decoded).toHaveLength(2);
    expect(decoded[0].to.toLowerCase()).toBe(TEST_TARGET.toLowerCase());
    expect(decoded[1].to.toLowerCase()).toBe(TEST_TARGET_2.toLowerCase());
    expect(decoded[1].operation).toBe(1); // DELEGATECALL
  });

  it('should return empty array for non-MultiSend calldata', () => {
    expect(decodeMultiSend('0x1234')).toEqual([]);
    expect(decodeMultiSend('0xdeadbeef0000')).toEqual([]);
  });

  it('should return empty array for malformed MultiSend data', () => {
    // Valid selector but invalid/truncated data
    const malformed = '0x8d80ff0a0000000000000000000000000000000000000000000000000000000000000020' as Hex;
    expect(decodeMultiSend(malformed)).toEqual([]);
  });

  it('should handle transaction with empty data', () => {
    const txs = [{ operation: 0, to: TEST_TARGET, value: 0n, data: '0x' as Hex }];
    const packed = packMultiSendTx(txs);
    const calldata = encodeMultiSendCalldata(packed);

    const decoded = decodeMultiSend(calldata);

    expect(decoded).toHaveLength(1);
    expect(decoded[0].data).toBe('0x');
  });
});

describe('isMultiSendAddress', () => {
  it('should recognize MultiSend 1.3.0', () => {
    expect(isMultiSendAddress(MULTISEND_1_3_0)).toBe(true);
  });

  it('should recognize MultiSend Call Only 1.3.0', () => {
    expect(isMultiSendAddress(MULTISEND_CALL_ONLY_1_3_0)).toBe(true);
  });

  it('should recognize MultiSend 1.4.1', () => {
    expect(isMultiSendAddress(MULTISEND_1_4_1)).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isMultiSendAddress(MULTISEND_1_3_0.toUpperCase())).toBe(true);
    expect(isMultiSendAddress('0x40A2aCCBd92BCA938b02010E17A5b8929b49130D')).toBe(true);
  });

  it('should return false for unknown addresses', () => {
    expect(isMultiSendAddress(TEST_TARGET)).toBe(false);
    expect(isMultiSendAddress('0x0000000000000000000000000000000000000000')).toBe(false);
  });
});

describe('extractTimelockCalldata', () => {
  const TIMELOCK_ADDRESS = '0x1111111111111111111111111111111111111111';
  const SCHEDULE_CALLDATA = encodeSchedule(TEST_TARGET, TEST_VALUE, TEST_DATA, TEST_PREDECESSOR, TEST_SALT, TEST_DELAY).calldata;

  it('should extract direct timelock call', () => {
    const result = extractTimelockCalldata(TIMELOCK_ADDRESS, SCHEDULE_CALLDATA, TIMELOCK_ADDRESS);
    expect(result).toBe(SCHEDULE_CALLDATA);
  });

  it('should be case-insensitive for timelock address', () => {
    const result = extractTimelockCalldata(
      TIMELOCK_ADDRESS.toUpperCase(),
      SCHEDULE_CALLDATA,
      TIMELOCK_ADDRESS.toLowerCase()
    );
    expect(result).toBe(SCHEDULE_CALLDATA);
  });

  it('should return null for non-timelock direct call', () => {
    const result = extractTimelockCalldata(TEST_TARGET, TEST_DATA, TIMELOCK_ADDRESS);
    expect(result).toBeNull();
  });

  it('should extract timelock call from MultiSend', () => {
    // Create a MultiSend that contains a timelock call
    function packMultiSendTx(txs: Array<{ operation: number; to: Address; value: bigint; data: Hex }>): Hex {
      let packed = '';
      for (const tx of txs) {
        packed += tx.operation.toString(16).padStart(2, '0');
        packed += tx.to.slice(2).toLowerCase();
        packed += tx.value.toString(16).padStart(64, '0');
        const dataBytes = tx.data.slice(2);
        const dataLen = dataBytes.length / 2;
        packed += dataLen.toString(16).padStart(64, '0');
        packed += dataBytes;
      }
      return `0x${packed}` as Hex;
    }

    const txs = [
      { operation: 0, to: TIMELOCK_ADDRESS as Address, value: 0n, data: SCHEDULE_CALLDATA },
    ];
    const packed = packMultiSendTx(txs);
    const multiSendCalldata = `0x8d80ff0a${encodeAbiParameters([{ name: 'transactions', type: 'bytes' }], [packed]).slice(2)}` as Hex;

    const result = extractTimelockCalldata(MULTISEND_1_3_0, multiSendCalldata, TIMELOCK_ADDRESS);
    expect(result?.toLowerCase()).toBe(SCHEDULE_CALLDATA.toLowerCase());
  });

  it('should return null if MultiSend doesnt contain timelock call', () => {
    function packMultiSendTx(txs: Array<{ operation: number; to: Address; value: bigint; data: Hex }>): Hex {
      let packed = '';
      for (const tx of txs) {
        packed += tx.operation.toString(16).padStart(2, '0');
        packed += tx.to.slice(2).toLowerCase();
        packed += tx.value.toString(16).padStart(64, '0');
        const dataBytes = tx.data.slice(2);
        const dataLen = dataBytes.length / 2;
        packed += dataLen.toString(16).padStart(64, '0');
        packed += dataBytes;
      }
      return `0x${packed}` as Hex;
    }

    const txs = [
      { operation: 0, to: TEST_TARGET, value: 0n, data: TEST_DATA },
    ];
    const packed = packMultiSendTx(txs);
    const multiSendCalldata = `0x8d80ff0a${encodeAbiParameters([{ name: 'transactions', type: 'bytes' }], [packed]).slice(2)}` as Hex;

    const result = extractTimelockCalldata(MULTISEND_1_3_0, multiSendCalldata, TIMELOCK_ADDRESS);
    expect(result).toBeNull();
  });
});

describe('formatDelay', () => {
  it('should format days', () => {
    expect(formatDelay(86400n)).toBe('1d');
    expect(formatDelay(172800n)).toBe('2d');
  });

  it('should format hours', () => {
    expect(formatDelay(3600n)).toBe('1h');
    expect(formatDelay(7200n)).toBe('2h');
  });

  it('should format minutes', () => {
    expect(formatDelay(60n)).toBe('1m');
    expect(formatDelay(120n)).toBe('2m');
  });

  it('should format seconds for small values', () => {
    expect(formatDelay(30n)).toBe('30s');
    expect(formatDelay(0n)).toBe('0s');
  });

  it('should format combined units', () => {
    expect(formatDelay(90000n)).toBe('1d 1h'); // 1 day + 1 hour
    expect(formatDelay(90060n)).toBe('1d 1h 1m'); // 1 day + 1 hour + 1 min
  });

  it('should accept string input', () => {
    expect(formatDelay('86400')).toBe('1d');
    expect(formatDelay('3600')).toBe('1h');
  });
});

describe('generateRandomSalt', () => {
  it('should generate valid 32-byte hex string', () => {
    const salt = generateRandomSalt();
    expect(salt).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should generate different values each time', () => {
    const salt1 = generateRandomSalt();
    const salt2 = generateRandomSalt();
    expect(salt1).not.toBe(salt2);
  });
});

describe('TIMELOCK_ABI', () => {
  it('should have all required functions', () => {
    const functionNames = TIMELOCK_ABI.map(item => item.name);
    expect(functionNames).toContain('schedule');
    expect(functionNames).toContain('scheduleBatch');
    expect(functionNames).toContain('execute');
    expect(functionNames).toContain('executeBatch');
    expect(functionNames).toContain('cancel');
    expect(functionNames).toContain('getMinDelay');
    expect(functionNames).toContain('isOperation');
    expect(functionNames).toContain('isOperationPending');
    expect(functionNames).toContain('isOperationReady');
    expect(functionNames).toContain('isOperationDone');
    expect(functionNames).toContain('getTimestamp');
  });
});
