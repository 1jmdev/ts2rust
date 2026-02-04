// Codegen Module - Main entry point for Rust code generation
//
// Usage:
//   import { generate } from './codegen/index.ts';
//   const rustCode = generate(program);

import type { IRProgram, IRDeclaration, IRStruct, IREnum } from '../ir/index.ts';
import { generateDeclaration } from './declarations.ts';
import { generateConsoleHelpers } from './helpers/console.ts';

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
// Pre-processing: Compute optimal derives
// ============================================================================

/**
 * Analyze the program and update struct derives to include Copy where possible
 */
function optimizeDerives(program: IRProgram): void {
  // Collect all Copy enums (enums with only unit variants are Copy)
  const copyTypes = new Set<string>();
  for (const decl of program.declarations) {
    if (decl.kind === 'enum') {
      const enumDecl = decl as IREnum;
      // Unit-only enums with Copy derive are copyable
      if (enumDecl.derives.includes('Copy')) {
        copyTypes.add(enumDecl.name);
      }
    }
  }

  // Helper to check if a single type is Copy
  function isFieldTypeCopy(type: { kind: string; name?: string; elements?: any[] }): boolean {
    if (type.kind === 'primitive') {
      return type.name !== 'String';
    }
    if (type.kind === 'tuple') {
      return type.elements?.every(isFieldTypeCopy) ?? false;
    }
    if (type.kind === 'reference') {
      return true; // &T is Copy
    }
    if (type.kind === 'enum' || type.kind === 'struct') {
      return copyTypes.has(type.name!);
    }
    // Arrays are not Copy
    return false;
  }

  // Iteratively find structs that can derive Copy
  // (may need multiple passes if structs reference other structs)
  let changed = true;
  const maxIterations = 10;
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    for (const decl of program.declarations) {
      if (decl.kind === 'struct') {
        const struct = decl as IRStruct;
        if (copyTypes.has(struct.name)) continue;

        // Check if all fields are Copy types
        const allCopy = struct.fields.every(f => isFieldTypeCopy(f.type as any));

        if (allCopy) {
          copyTypes.add(struct.name);
          // Update the derives
          if (!struct.derives.includes('Copy')) {
            struct.derives.push('Copy');
          }
          changed = true;
        }
      }
    }
  }
}

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
  // Pre-process: optimize derives (add Copy where possible)
  optimizeDerives(program);

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

  // Add console helper functions
  sections.push(generateConsoleHelpers());

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
