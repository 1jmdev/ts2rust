// Parser Module - Main entry point for parsing TypeScript to IR
//
// Usage:
//   import { parse } from './parser/index.ts';
//   const program = parse(sourceFile);

import { SourceFile } from 'ts-morph';

import {
  type IRProgram,
  type IRFunction,
  type IRStruct,
  type IREnum,
} from '../ir/index.ts';

import { TypeRegistry, globalTypeRegistry } from './types.ts';
import { parseDeclarations } from './declarations.ts';

// Re-export utilities
export { TypeRegistry, globalTypeRegistry, mapTsTypeToIR, irTypeToRust } from './types.ts';
export { parseExpression } from './expressions.ts';
export { parseStatement, parseBlock } from './statements.ts';
export { parseFunction, parseInterface, parseEnum, parseTypeAlias } from './declarations.ts';

// ============================================================================
// Main Parse Function
// ============================================================================

/**
 * Parse a TypeScript source file into our IR
 * 
 * @param sourceFile - The ts-morph SourceFile to parse
 * @param registry - Optional type registry (uses global if not provided)
 * @returns The parsed IR program
 */
export function parse(
  sourceFile: SourceFile,
  registry: TypeRegistry = globalTypeRegistry
): IRProgram {
  const declarations = parseDeclarations(sourceFile, registry);

  // Extract convenience arrays
  const functions = declarations.filter((d): d is IRFunction => d.kind === 'function');
  const structs = declarations.filter((d): d is IRStruct => d.kind === 'struct');
  const enums = declarations.filter((d): d is IREnum => d.kind === 'enum');

  return {
    declarations,
    functions,
    structs,
    enums,
  };
}

/**
 * Create a fresh type registry for parsing
 * Use this when you want isolated parsing without affecting global state
 */
export function createTypeRegistry(): TypeRegistry {
  return new TypeRegistry();
}

/**
 * Reset the global type registry
 * Call this between parsing different files if using the global registry
 */
export function resetGlobalRegistry(): void {
  // Create a new registry and copy it to global
  const fresh = new TypeRegistry();
  Object.assign(globalTypeRegistry, fresh);
}
