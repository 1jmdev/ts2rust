// Codegen Declarations - Generate Rust code for structs, enums, functions

import type {
  IRFunction,
  IRStruct,
  IREnum,
  IRTypeAlias,
  IRImpl,
  IRDeclaration,
} from '../ir/index.ts';
import { isVoidType } from '../ir/index.ts';
import { toSnakeCase, irTypeToRust, indent } from './types.ts';
import { generateStatement } from './statements.ts';

// ============================================================================
// Function Generation
// ============================================================================

export function generateFunction(func: IRFunction): string {
  const lines: string[] = [];

  // Function signature
  const funcName = toSnakeCase(func.name);
  const params = func.params
    .map((p) => `${toSnakeCase(p.name)}: ${irTypeToRust(p.type)}`)
    .join(', ');
  const returnType = isVoidType(func.returnType) ? '' : ` -> ${irTypeToRust(func.returnType)}`;
  const pubKeyword = func.public ? 'pub ' : '';

  lines.push(`${pubKeyword}fn ${funcName}(${params})${returnType} {`);

  // Function body
  for (let i = 0; i < func.body.length; i++) {
    const stmt = func.body[i]!;
    const isLast = i === func.body.length - 1;
    lines.push(
      ...generateStatement(stmt, 1, isLast && !isVoidType(func.returnType), func.returnType)
    );
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// Struct Generation
// ============================================================================

export function generateStruct(struct: IRStruct): string {
  const lines: string[] = [];

  // Derive macros
  if (struct.derives.length > 0) {
    lines.push(`#[derive(${struct.derives.join(', ')})]`);
  }

  lines.push(`pub struct ${struct.name} {`);

  for (const field of struct.fields) {
    const visibility = field.public ? 'pub ' : '';
    const fieldName = toSnakeCase(field.name);
    const fieldType = irTypeToRust(field.type);
    lines.push(`    ${visibility}${fieldName}: ${fieldType},`);
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// Enum Generation
// ============================================================================

export function generateEnum(enumDecl: IREnum): string {
  const lines: string[] = [];

  // Derive macros
  if (enumDecl.derives.length > 0) {
    lines.push(`#[derive(${enumDecl.derives.join(', ')})]`);
  }

  // Check if we need repr for explicit discriminants
  const hasExplicitValues = enumDecl.variants.some(
    (v) => v.kind === 'unit' && v.value !== undefined
  );
  if (hasExplicitValues) {
    lines.push('#[repr(i32)]');
  }

  lines.push(`pub enum ${enumDecl.name} {`);

  for (const variant of enumDecl.variants) {
    switch (variant.kind) {
      case 'unit':
        if (variant.value !== undefined) {
          lines.push(`    ${variant.name} = ${variant.value},`);
        } else {
          lines.push(`    ${variant.name},`);
        }
        break;

      case 'tuple':
        const tupleTypes = variant.fields.map(irTypeToRust).join(', ');
        lines.push(`    ${variant.name}(${tupleTypes}),`);
        break;

      case 'struct':
        lines.push(`    ${variant.name} {`);
        for (const field of variant.fields) {
          const fieldName = toSnakeCase(field.name);
          const fieldType = irTypeToRust(field.type);
          lines.push(`        ${fieldName}: ${fieldType},`);
        }
        lines.push(`    },`);
        break;
    }
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// Type Alias Generation
// ============================================================================

export function generateTypeAlias(typeAlias: IRTypeAlias): string {
  return `pub type ${typeAlias.name} = ${irTypeToRust(typeAlias.type)};`;
}

// ============================================================================
// Impl Block Generation
// ============================================================================

export function generateImpl(impl: IRImpl): string {
  const lines: string[] = [];

  lines.push(`impl ${impl.typeName} {`);

  for (const method of impl.methods) {
    const pubKeyword = method.public ? 'pub ' : '';
    const methodName = toSnakeCase(method.name);
    const receiver = method.receiver;

    // Build parameter list
    const params = method.params
      .map((p) => `${toSnakeCase(p.name)}: ${irTypeToRust(p.type)}`)
      .join(', ');
    const allParams = params ? `${receiver}, ${params}` : receiver;

    const returnType = isVoidType(method.returnType) ? '' : ` -> ${irTypeToRust(method.returnType)}`;

    lines.push(`    ${pubKeyword}fn ${methodName}(${allParams})${returnType} {`);

    for (let i = 0; i < method.body.length; i++) {
      const stmt = method.body[i]!;
      const isLast = i === method.body.length - 1;
      lines.push(
        ...generateStatement(stmt, 2, isLast && !isVoidType(method.returnType), method.returnType)
      );
    }

    lines.push('    }');
    lines.push('');
  }

  // Remove trailing empty line
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// Declaration Generation
// ============================================================================

export function generateDeclaration(decl: IRDeclaration): string {
  switch (decl.kind) {
    case 'function':
      return generateFunction(decl);
    case 'struct':
      return generateStruct(decl);
    case 'enum':
      return generateEnum(decl);
    case 'type_alias':
      return generateTypeAlias(decl);
    case 'impl':
      return generateImpl(decl);
  }
}
