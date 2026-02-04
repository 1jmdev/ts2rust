// Parser Declarations - Parse TypeScript declarations (structs/interfaces, enums, functions)

import {
  SourceFile,
  FunctionDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  EnumDeclaration,
  Block,
  SyntaxKind,
} from 'ts-morph';

import {
  type IRFunction,
  type IRStruct,
  type IRStructField,
  type IREnum,
  type IREnumVariantDef,
  type IRDeclaration,
  type IRParam,
  type IRStatement,
  primitiveType,
} from '../ir/index.ts';

import { mapTsTypeToIR, TypeRegistry, globalTypeRegistry } from './types.ts';
import { parseBlock } from './statements.ts';

// ============================================================================
// Function Parsing
// ============================================================================

export function parseFunction(
  func: FunctionDeclaration,
  registry: TypeRegistry = globalTypeRegistry
): IRFunction {
  const name = func.getName() || 'anonymous';

  // Parse parameters
  const params: IRParam[] = func.getParameters().map((param) => ({
    name: param.getName(),
    type: mapTsTypeToIR(param.getTypeNode()!.getText(), false, registry),
  }));

  // Parse return type
  const returnTypeNode = func.getReturnTypeNode();
  const returnType = returnTypeNode
    ? mapTsTypeToIR(returnTypeNode.getText(), true, registry)
    : primitiveType('void');

  // Parse body
  const body = func.getBody();
  const statements: IRStatement[] = body ? parseBlock(body as Block, registry) : [];

  return {
    kind: 'function',
    name,
    params,
    returnType,
    body: statements,
    public: true, // Default to public for top-level functions
  };
}

// ============================================================================
// Interface/Type Alias → Struct Parsing
// ============================================================================

export function parseInterface(
  iface: InterfaceDeclaration,
  registry: TypeRegistry = globalTypeRegistry
): IRStruct {
  const name = iface.getName();
  
  // Register the struct type before parsing fields (for self-referential types)
  registry.registerStruct(name);

  const fields: IRStructField[] = [];

  for (const prop of iface.getProperties()) {
    const propName = prop.getName();
    const typeNode = prop.getTypeNode();
    const propType = typeNode 
      ? mapTsTypeToIR(typeNode.getText(), false, registry)
      : primitiveType('f64');

    fields.push({
      name: propName,
      type: propType,
      public: true,
    });
  }

  return {
    kind: 'struct',
    name,
    fields,
    derives: ['Debug', 'Clone'],
  };
}

export function parseTypeAlias(
  typeAlias: TypeAliasDeclaration,
  registry: TypeRegistry = globalTypeRegistry
): IRDeclaration {
  const name = typeAlias.getName();
  const typeNode = typeAlias.getTypeNode();

  if (!typeNode) {
    throw new Error(`Type alias '${name}' must have a type`);
  }

  // Check if this is an object type (becomes a struct)
  if (typeNode.getKind() === SyntaxKind.TypeLiteral) {
    registry.registerStruct(name);
    
    const typeLiteral = typeNode.asKind(SyntaxKind.TypeLiteral)!;
    const fields: IRStructField[] = [];

    for (const member of typeLiteral.getMembers()) {
      if (member.getKind() === SyntaxKind.PropertySignature) {
        const propSig = member.asKind(SyntaxKind.PropertySignature)!;
        const propName = propSig.getName();
        const propTypeNode = propSig.getTypeNode();
        const propType = propTypeNode
          ? mapTsTypeToIR(propTypeNode.getText(), false, registry)
          : primitiveType('f64');

        fields.push({
          name: propName,
          type: propType,
          public: true,
        });
      }
    }

    return {
      kind: 'struct',
      name,
      fields,
      derives: ['Debug', 'Clone'],
    };
  }

  // Otherwise, it's a type alias
  const irType = mapTsTypeToIR(typeNode.getText(), false, registry);
  registry.registerTypeAlias(name, irType);

  return {
    kind: 'type_alias',
    name,
    type: irType,
  };
}

// ============================================================================
// Enum Parsing
// ============================================================================

export function parseEnum(
  enumDecl: EnumDeclaration,
  registry: TypeRegistry = globalTypeRegistry
): IREnum {
  const name = enumDecl.getName();
  
  // Register the enum type
  registry.registerEnum(name);

  const variants: IREnumVariantDef[] = [];
  let autoValue = 0;

  for (const member of enumDecl.getMembers()) {
    const memberName = member.getName();
    const initializer = member.getInitializer();

    if (initializer) {
      // Has explicit value
      if (initializer.getKind() === SyntaxKind.NumericLiteral) {
        const numLit = initializer.asKind(SyntaxKind.NumericLiteral)!;
        const value = numLit.getLiteralValue();
        variants.push({
          kind: 'unit',
          name: memberName,
          value: value,
        });
        autoValue = value + 1;
      } else if (initializer.getKind() === SyntaxKind.StringLiteral) {
        // String enum - treat as unit variant (Rust doesn't support string discriminants)
        variants.push({
          kind: 'unit',
          name: memberName,
        });
      } else {
        // Complex initializer - just use as unit
        variants.push({
          kind: 'unit',
          name: memberName,
        });
      }
    } else {
      // Auto-increment value
      variants.push({
        kind: 'unit',
        name: memberName,
        value: autoValue,
      });
      autoValue++;
    }
  }

  return {
    kind: 'enum',
    name,
    variants,
    derives: ['Debug', 'Clone', 'Copy', 'PartialEq', 'Eq'],
  };
}

// ============================================================================
// Top-Level Parsing
// ============================================================================

export function parseDeclarations(
  sourceFile: SourceFile,
  registry: TypeRegistry = globalTypeRegistry
): IRDeclaration[] {
  const declarations: IRDeclaration[] = [];

  for (const statement of sourceFile.getStatements()) {
    const kind = statement.getKind();

    switch (kind) {
      case SyntaxKind.InterfaceDeclaration:
        declarations.push(parseInterface(statement as InterfaceDeclaration, registry));
        break;

      case SyntaxKind.TypeAliasDeclaration:
        declarations.push(parseTypeAlias(statement as TypeAliasDeclaration, registry));
        break;

      case SyntaxKind.EnumDeclaration:
        declarations.push(parseEnum(statement as EnumDeclaration, registry));
        break;

      case SyntaxKind.FunctionDeclaration:
        declarations.push(parseFunction(statement as FunctionDeclaration, registry));
        break;
    }
  }

  return declarations;
}
