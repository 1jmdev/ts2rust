// Builtin Method Handler Types
// Shared types for all builtin method handlers

import type { IRExpression } from '../../ir/index.ts';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Handler for a builtin method that generates Rust code
 */
export interface BuiltinMethodHandler {
  /** Generate Rust code for this method call */
  generateRust(object: string | null, args: string[], rawArgs: IRExpression[]): string;
  /** Whether this method mutates the object */
  mutates: boolean;
  /** Whether this is a statement (no return value to use) */
  isStatement: boolean;
  /** Rust return type (if expression, for type inference) */
  returnType?: string;
}

/**
 * A namespace of builtin methods (e.g., console.*, Array.*, etc.)
 */
export interface BuiltinNamespace {
  methods: Record<string, BuiltinMethodHandler>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to build println!/eprintln! with embedded string literals
 * String literals are embedded directly into the format string for cleaner output
 * Uses {:?} debug format only for enums/structs, {} for primitives
 */
export function buildPrintln(
  macro: 'println' | 'eprintln',
  prefix: string,
  args: string[],
  rawArgs: IRExpression[]
): string {
  if (args.length === 0) {
    return prefix ? `${macro}!("${prefix}")` : `${macro}!()`;
  }

  const formatParts: string[] = [];
  const formatArgs: string[] = [];

  if (prefix) {
    formatParts.push(prefix);
  }

  for (let i = 0; i < args.length; i++) {
    const rawArg = rawArgs[i];
    const arg = args[i]!;

    // Check if this is a string literal - embed it directly
    if (rawArg && rawArg.kind === 'literal' && typeof rawArg.value === 'string') {
      // Embed the string directly into the format string
      formatParts.push(rawArg.value);
    } else if (rawArg && rawArg.kind === 'literal') {
      // Number/boolean literals use {} (Display trait)
      formatParts.push('{}');
      formatArgs.push(arg);
    } else if (rawArg && needsDebugFormat(rawArg)) {
      // Enums and structs need {:?} debug format
      formatParts.push('{:?}');
      formatArgs.push(arg);
    } else {
      // Primitives, strings, and property access on primitives use {}
      formatParts.push('{}');
      formatArgs.push(arg);
    }
  }

  const formatStr = formatParts.join(' ');

  if (formatArgs.length === 0) {
    return `${macro}!("${formatStr}")`;
  }

  return `${macro}!("${formatStr}", ${formatArgs.join(', ')})`;
}

/**
 * Check if an expression needs {:?} debug format (enums, structs)
 */
function needsDebugFormat(expr: IRExpression): boolean {
  // Check resolved type if available
  if ('resolvedType' in expr && expr.resolvedType) {
    const t = expr.resolvedType as { kind: string };
    return t.kind === 'enum' || t.kind === 'struct';
  }
  
  // Enum variants always need debug format
  if (expr.kind === 'enum_variant') {
    return true;
  }
  
  // Identifiers without resolved type - be conservative, use {}
  // (Most identifiers are primitives in simple programs)
  return false;
}
