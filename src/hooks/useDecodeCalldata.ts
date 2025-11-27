import { useMemo } from 'react';
import type { Hex } from 'viem';
import { decodeFunctionData, decodeAbiParameters, parseAbiParameters } from 'viem';
import {
  getSelector,
  decodeWithKnownSelectors,
  formatParamValue,
  type DecodedInnerCalldata,
  type DecodedParam,
} from '../lib/selectors';
import { findAbiBySelector, getFunctionFromAbi } from '../lib/abi-storage';
import { use4ByteDirectory } from './use4ByteDirectory';

export type { DecodedInnerCalldata, DecodedParam };

/**
 * Parse a function signature into name and param types
 * e.g., "transfer(address,uint256)" -> { name: "transfer", params: ["address", "uint256"] }
 */
function parseSignature(signature: string): {
  name: string;
  params: string[];
} | null {
  const match = signature.match(/^(\w+)\((.*)\)$/);
  if (!match) return null;

  const [, name, paramsStr] = match;
  // Handle nested tuples and arrays properly
  const params = paramsStr ? parseParamTypes(paramsStr) : [];

  return { name, params };
}

/**
 * Parse parameter types, handling nested parentheses for tuples
 */
function parseParamTypes(paramsStr: string): string[] {
  if (!paramsStr.trim()) return [];

  const params: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of paramsStr) {
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      params.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    params.push(current.trim());
  }

  return params;
}

/**
 * Try to decode parameters from calldata using a signature from 4byte
 */
function decodeWith4ByteSignature(
  calldata: Hex,
  signature: string
): DecodedParam[] | null {
  const parsed = parseSignature(signature);
  if (!parsed || parsed.params.length === 0) return null;

  try {
    // Build the ABI parameter string for viem
    const abiParamStr = parsed.params.join(', ');
    const abiParams = parseAbiParameters(abiParamStr);

    // Remove the 4-byte selector to get just the encoded params
    const paramsData = `0x${calldata.slice(10)}` as Hex;

    // Decode the parameters
    const decoded = decodeAbiParameters(abiParams, paramsData);

    // Build params array
    return parsed.params.map((type, i) => ({
      name: `arg${i}`,
      type,
      value: decoded[i],
      display: formatParamValue(type, decoded[i]),
    }));
  } catch {
    return null;
  }
}

/**
 * Hook to decode inner calldata using multiple sources:
 * 1. Local known selectors (instant)
 * 2. User-stored ABIs (instant)
 * 3. 4byte.directory API (async, signature only)
 */
export function useDecodeCalldata(
  calldata: Hex | undefined | null
): DecodedInnerCalldata & { isLoading: boolean } {
  const selector = useMemo(
    () => (calldata ? getSelector(calldata) : null),
    [calldata]
  );

  // Try local known selectors first
  const localResult = useMemo(() => {
    if (!calldata || !selector) return null;
    const result = decodeWithKnownSelectors(calldata);
    return result.status !== 'unknown' ? result : null;
  }, [calldata, selector]);

  // Try user-stored ABIs
  const userAbiResult = useMemo(() => {
    if (localResult || !calldata || !selector) return null;

    const storedAbi = findAbiBySelector(selector);
    if (!storedAbi) return null;

    const funcInfo = getFunctionFromAbi(storedAbi.abi, selector);
    if (!funcInfo) return null;

    // Try to decode parameters
    try {
      const decoded = decodeFunctionData({
        abi: storedAbi.abi,
        data: calldata,
      });

      const args = decoded.args ?? [];
      const params: DecodedParam[] = funcInfo.inputs.map((input, i) => ({
        name: input.name || `arg${i}`,
        type: input.type,
        value: args[i],
        display: formatParamValue(input.type, args[i]),
      }));

      // Build signature string
      const signature = `${funcInfo.name}(${funcInfo.inputs.map((i) => i.type).join(',')})`;

      return {
        status: 'decoded' as const,
        source: 'user-abi' as const,
        selector,
        functionName: funcInfo.name,
        signature,
        description: `Custom ABI: ${storedAbi.name}`,
        params,
        summary: `Call ${funcInfo.name}() via custom ABI`,
      };
    } catch {
      // Couldn't decode params, return signature only
      const signature = `${funcInfo.name}(${funcInfo.inputs.map((i) => i.type).join(',')})`;
      return {
        status: 'signature-only' as const,
        source: 'user-abi' as const,
        selector,
        functionName: funcInfo.name,
        signature,
        description: `Custom ABI: ${storedAbi.name}`,
      };
    }
  }, [localResult, calldata, selector]);

  // Only query 4byte if local and user ABI didn't match
  const shouldQuery4Byte = !localResult && !userAbiResult && !!selector;
  const {
    data: fourByteSignature,
    isLoading: fourByteLoading,
  } = use4ByteDirectory(shouldQuery4Byte ? selector : null);

  // Build final result
  const result = useMemo((): DecodedInnerCalldata => {
    // Return local result if found
    if (localResult) {
      return localResult;
    }

    // Return user ABI result if found
    if (userAbiResult) {
      return userAbiResult;
    }

    // If no selector (empty/invalid calldata)
    if (!selector) {
      return {
        status: 'unknown',
        source: null,
        selector: '0x' as Hex,
      };
    }

    // 4byte result - try to decode params from signature
    if (fourByteSignature && calldata) {
      const parsed = parseSignature(fourByteSignature);
      const params = decodeWith4ByteSignature(calldata, fourByteSignature);

      if (params && params.length > 0) {
        return {
          status: 'decoded',
          source: '4byte',
          selector,
          functionName: parsed?.name || fourByteSignature,
          signature: fourByteSignature,
          description: 'Signature from 4byte.directory',
          params,
        };
      }

      // Fallback to signature-only if param decoding failed
      return {
        status: 'signature-only',
        source: '4byte',
        selector,
        functionName: parsed?.name || fourByteSignature,
        signature: fourByteSignature,
        description: 'Signature from 4byte.directory',
      };
    }

    // Unknown
    return {
      status: 'unknown',
      source: null,
      selector,
    };
  }, [localResult, userAbiResult, selector, fourByteSignature]);

  return {
    ...result,
    isLoading: shouldQuery4Byte && fourByteLoading,
  };
}
