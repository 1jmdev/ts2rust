// Builtins Module - Registry and lookup for all builtin method handlers
//
// This module provides a central registry for all builtin methods (console, Array, String, Math)
// and type-aware method resolution based on the IR type of the object.

import type { BuiltinMethodHandler, BuiltinNamespace } from './types.ts';
import { consoleBuiltins } from './console.ts';
import { arrayBuiltins } from './array.ts';
import { stringBuiltins } from './string.ts';
import { mathBuiltins } from './math.ts';

// Re-export types
export type { BuiltinMethodHandler, BuiltinNamespace } from './types.ts';
export { buildPrintln } from './types.ts';
export { mathConstants } from './math.ts';

// ============================================================================
// Builtin Registry
// ============================================================================

/**
 * Central registry of all builtin namespaces
 */
export const builtinRegistry: Record<string, BuiltinNamespace> = {
  console: consoleBuiltins,
  Array: arrayBuiltins,
  String: stringBuiltins,
  Math: mathBuiltins,
};

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Check if a namespace exists in builtins (e.g., "console", "Math")
 */
export function isBuiltinNamespace(name: string): boolean {
  return name in builtinRegistry;
}

/**
 * Look up a method handler for a given namespace and method name
 */
export function getBuiltinMethod(
  namespace: string,
  method: string
): BuiltinMethodHandler | undefined {
  return builtinRegistry[namespace]?.methods[method];
}

/**
 * Get array method handler
 */
export function getArrayMethod(method: string): BuiltinMethodHandler | undefined {
  return arrayBuiltins.methods[method];
}

/**
 * Get string method handler
 */
export function getStringMethod(method: string): BuiltinMethodHandler | undefined {
  return stringBuiltins.methods[method];
}

/**
 * Get math method handler
 */
export function getMathMethod(method: string): BuiltinMethodHandler | undefined {
  return mathBuiltins.methods[method];
}

/**
 * Get console method handler
 */
export function getConsoleMethod(method: string): BuiltinMethodHandler | undefined {
  return consoleBuiltins.methods[method];
}

// ============================================================================
// Type-Aware Method Resolution
// ============================================================================

import type { IRType } from '../../ir/index.ts';
import { isArrayType, isStringType } from '../../ir/index.ts';

/**
 * Resolve a method handler based on the object's IR type
 * This is the preferred way to look up methods when you have type information
 */
export function resolveMethodByType(
  objectType: IRType | undefined,
  methodName: string
): BuiltinMethodHandler | undefined {
  if (!objectType) {
    // No type info - try heuristics based on method name
    return resolveMethodByName(methodName);
  }

  if (isArrayType(objectType)) {
    return getArrayMethod(methodName);
  }

  if (isStringType(objectType)) {
    return getStringMethod(methodName);
  }

  // For struct/enum types, no builtin methods
  return undefined;
}

/**
 * Resolve a method handler based on method name heuristics
 * Used when type information is not available
 */
export function resolveMethodByName(methodName: string): BuiltinMethodHandler | undefined {
  // String-specific methods that don't exist on arrays
  const stringOnlyMethods = [
    'toUpperCase', 'toLowerCase', 'trim', 'trimStart', 'trimEnd',
    'charAt', 'charCodeAt', 'substring', 'replace', 'replaceAll',
    'split', 'repeat', 'startsWith', 'endsWith', 'padStart', 'padEnd',
  ];

  // Array-specific methods that don't exist on strings
  const arrayOnlyMethods = [
    'push', 'pop', 'shift', 'unshift', 'splice', 'reverse', 'sort',
    'fill', 'copyWithin', 'flat', 'map', 'filter',
    'reduce', 'reduceRight', 'forEach', 'every', 'some', 'find', 'findIndex', 'at',
  ];

  if (stringOnlyMethods.includes(methodName)) {
    return getStringMethod(methodName);
  }

  if (arrayOnlyMethods.includes(methodName)) {
    return getArrayMethod(methodName);
  }

  // Ambiguous methods - try array first (more common)
  const arrayHandler = getArrayMethod(methodName);
  if (arrayHandler) return arrayHandler;

  return getStringMethod(methodName);
}

// ============================================================================
// Method Categories (for documentation/introspection)
// ============================================================================

export const arrayMutatingMethods = [
  'push', 'pop', 'shift', 'unshift', 'splice', 'reverse', 'sort', 'fill', 'copyWithin',
];

export const arrayNonMutatingMethods = [
  'slice', 'concat', 'join', 'flat', 'indexOf', 'lastIndexOf', 'includes',
  'find', 'findIndex', 'forEach', 'map', 'filter', 'reduce', 'reduceRight',
  'every', 'some', 'at', 'toString',
];

export const stringMethods = [
  'charAt', 'charCodeAt', 'concat', 'includes', 'indexOf', 'lastIndexOf',
  'slice', 'substring', 'toLowerCase', 'toUpperCase', 'trim', 'trimStart',
  'trimEnd', 'split', 'replace', 'replaceAll', 'repeat', 'startsWith',
  'endsWith', 'padStart', 'padEnd', 'toString', 'length',
];
