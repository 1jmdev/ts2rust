// Codegen Module - Main entry point for Rust code generation
//
// Usage:
//   import { generate } from './codegen/index.ts';
//   const rustCode = generate(program);

import type { IRProgram, IRDeclaration } from '../ir/index.ts';
import { generateDeclaration } from './declarations.ts';

// Re-export utilities
export { toSnakeCase, toPascalCase, irTypeToRust, escapeString, indent } from './types.ts';
export { generateExpression, generateExpressionWithType } from './expressions.ts';
export { generateStatement } from './statements.ts';
export {
  generateFunction,
  generateStruct,
  generateEnum,
  generateTypeAlias,
  generateImpl,
  generateDeclaration,
} from './declarations.ts';

// Re-export builtins
export * from './builtins/index.ts';

// ============================================================================
// Main Generate Function
// ============================================================================

/**
 * Generate Rust source code from an IR program
 *
 * @param program - The IR program to generate code for
 * @returns The generated Rust source code
 */
export function generate(program: IRProgram): string {
  const sections: string[] = [];

  // Generate structs first (type definitions)
  for (const decl of program.declarations) {
    if (decl.kind === 'struct') {
      sections.push(generateDeclaration(decl));
    }
  }

  // Generate enums
  for (const decl of program.declarations) {
    if (decl.kind === 'enum') {
      sections.push(generateDeclaration(decl));
    }
  }

  // Generate type aliases
  for (const decl of program.declarations) {
    if (decl.kind === 'type_alias') {
      sections.push(generateDeclaration(decl));
    }
  }

  // Generate impl blocks
  for (const decl of program.declarations) {
    if (decl.kind === 'impl') {
      sections.push(generateDeclaration(decl));
    }
  }

  // Generate functions last
  for (const decl of program.declarations) {
    if (decl.kind === 'function') {
      sections.push(generateDeclaration(decl));
    }
  }

  return sections.join('\n\n') + '\n';
}

/**
 * Generate code for a single declaration
 */
export function generateSingle(decl: IRDeclaration): string {
  return generateDeclaration(decl);
}

/**
 * Generate a complete Rust file with optional standard imports
 */
export function generateFile(program: IRProgram, options: GenerateOptions = {}): string {
  const sections: string[] = [];

  // Add standard imports if requested
  if (options.includeStdImports) {
    sections.push('use std::collections::HashMap;');
    sections.push('');
  }

  // Add custom imports
  if (options.imports && options.imports.length > 0) {
    for (const imp of options.imports) {
      sections.push(`use ${imp};`);
    }
    sections.push('');
  }

  // Generate the main code
  sections.push(generate(program));

  return sections.join('\n');
}

export interface GenerateOptions {
  /** Include common std imports */
  includeStdImports?: boolean;
  /** Custom imports to add */
  imports?: string[];
}
