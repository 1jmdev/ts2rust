// Type Resolver - Resolve and infer types throughout the IR
//
// This module populates type information on expressions and validates
// type consistency throughout the program.

import type {
  IRProgram,
  IRFunction,
  IRStatement,
  IRExpression,
  IRType,
  IRStruct,
  IREnum,
} from '../ir/index.ts';
import {
  primitiveType,
  arrayType,
  isArrayType,
} from '../ir/index.ts';
import { getBuiltinMethod, getArrayMethod, getStringMethod, processConstants } from '../codegen/builtins/index.ts';

// ============================================================================
// Type Environment
// ============================================================================

export class TypeEnvironment {
  private variables: Map<string, IRType> = new Map();
  private structs: Map<string, IRStruct> = new Map();
  private enums: Map<string, IREnum> = new Map();
  private parent?: TypeEnvironment;

  constructor(parent?: TypeEnvironment) {
    this.parent = parent;
  }

  /** Create a child scope */
  child(): TypeEnvironment {
    return new TypeEnvironment(this);
  }

  /** Define a variable type */
  define(name: string, type: IRType): void {
    this.variables.set(name, type);
  }

  /** Look up a variable type */
  lookup(name: string): IRType | undefined {
    const local = this.variables.get(name);
    if (local) return local;
    return this.parent?.lookup(name);
  }

  /** Register a struct definition */
  registerStruct(struct: IRStruct): void {
    this.structs.set(struct.name, struct);
  }

  /** Look up a struct definition */
  lookupStruct(name: string): IRStruct | undefined {
    const local = this.structs.get(name);
    if (local) return local;
    return this.parent?.lookupStruct(name);
  }

  /** Register an enum definition */
  registerEnum(enumDef: IREnum): void {
    this.enums.set(enumDef.name, enumDef);
  }

  /** Look up an enum definition */
  lookupEnum(name: string): IREnum | undefined {
    const local = this.enums.get(name);
    if (local) return local;
    return this.parent?.lookupEnum(name);
  }

  /** Get field type from a struct */
  getStructFieldType(structName: string, fieldName: string): IRType | undefined {
    const struct = this.lookupStruct(structName);
    if (!struct) return undefined;
    const field = struct.fields.find((f) => f.name === fieldName);
    return field?.type;
  }
}

// ============================================================================
// Type Resolution
// ============================================================================

/**
 * Resolve types throughout a program
 */
export function resolveTypes(program: IRProgram): TypeEnvironment {
  const env = new TypeEnvironment();

  // Register all structs and enums first
  for (const struct of program.structs) {
    env.registerStruct(struct);
  }
  for (const enumDef of program.enums) {
    env.registerEnum(enumDef);
  }

  // Resolve types in functions
  for (const func of program.functions) {
    resolveFunction(func, env);
  }

  return env;
}

/**
 * Resolve types in a function
 */
function resolveFunction(func: IRFunction, parentEnv: TypeEnvironment): void {
  const env = parentEnv.child();

  // Add parameters to environment
  for (const param of func.params) {
    env.define(param.name, param.type);
  }

  // Resolve statements, passing return type for struct literal resolution
  for (const stmt of func.body) {
    resolveStatement(stmt, env, func.returnType);
  }
}

/**
 * Resolve types in a statement
 */
function resolveStatement(stmt: IRStatement, env: TypeEnvironment, returnType?: IRType): void {
  switch (stmt.kind) {
    case 'variable':
      // Fix anonymous struct literals based on declared type
      if (stmt.init.kind === 'struct_literal' && stmt.init.structName === '__anonymous__') {
        if (stmt.type.kind === 'struct') {
          stmt.init.structName = stmt.type.name;
        }
      }
      env.define(stmt.name, stmt.type);
      resolveExpression(stmt.init, env);
      break;

    case 'assignment':
      resolveExpression(stmt.target, env);
      resolveExpression(stmt.value, env);
      break;

    case 'return':
      if (stmt.value) {
        // Fix anonymous struct literals based on function return type
        if (stmt.value.kind === 'struct_literal' && stmt.value.structName === '__anonymous__') {
          if (returnType && returnType.kind === 'struct') {
            stmt.value.structName = returnType.name;
          }
        }
        resolveExpression(stmt.value, env);
      }
      break;

    case 'if':
      resolveExpression(stmt.condition, env);
      for (const s of stmt.thenBranch) {
        resolveStatement(s, env, returnType);
      }
      if (stmt.elseBranch) {
        for (const s of stmt.elseBranch) {
          resolveStatement(s, env, returnType);
        }
      }
      break;

    case 'while':
      resolveExpression(stmt.condition, env);
      for (const s of stmt.body) {
        resolveStatement(s, env, returnType);
      }
      break;

    case 'for_in':
      resolveExpression(stmt.iterable, env);
      // Infer loop variable type from iterable
      const iterType = inferType(stmt.iterable, env);
      if (isArrayType(iterType)) {
        env.define(stmt.variable, iterType.elementType);
      }
      for (const s of stmt.body) {
        resolveStatement(s, env, returnType);
      }
      break;

    case 'switch':
      resolveExpression(stmt.discriminant, env);
      for (const c of stmt.cases) {
        if (c.value) {
          resolveExpression(c.value, env);
        }
        for (const s of c.body) {
          resolveStatement(s, env, returnType);
        }
      }
      break;

    case 'expression':
      resolveExpression(stmt.expression, env);
      break;

    case 'block':
      const blockEnv = env.child();
      for (const s of stmt.statements) {
        resolveStatement(s, blockEnv, returnType);
      }
      break;
  }
}

/**
 * Resolve and annotate types on an expression
 */
function resolveExpression(expr: IRExpression, env: TypeEnvironment): void {
  switch (expr.kind) {
    case 'identifier':
      expr.resolvedType = env.lookup(expr.name);
      break;

    case 'binary':
      resolveExpression(expr.left, env);
      resolveExpression(expr.right, env);
      break;

    case 'unary':
      resolveExpression(expr.operand, env);
      break;

    case 'call':
      for (const arg of expr.args) {
        resolveExpression(arg, env);
      }
      break;

    case 'method_call':
      resolveExpression(expr.object, env);
      expr.objectType = inferType(expr.object, env);
      for (const arg of expr.args) {
        resolveExpression(arg, env);
      }
      break;

    case 'index':
      resolveExpression(expr.object, env);
      resolveExpression(expr.index, env);
      break;

    case 'property':
      resolveExpression(expr.object, env);
      // Check if this is an enum variant access (e.g., Direction.North)
      if (expr.object.kind === 'identifier') {
        const enumDef = env.lookupEnum(expr.object.name);
        if (enumDef) {
          // Transform this property access into an enum_variant expression
          // by modifying the expression in place
          (expr as any).kind = 'enum_variant';
          (expr as any).enumName = expr.object.name;
          (expr as any).variant = expr.property;
          (expr as any).data = [];
          delete (expr as any).object;
          delete (expr as any).property;
          return;
        }
      }
      expr.objectType = inferType(expr.object, env);
      expr.resolvedType = inferType(expr, env);
      break;

    case 'array_literal':
      for (const elem of expr.elements) {
        resolveExpression(elem, env);
      }
      break;

    case 'struct_literal':
      for (const field of expr.fields) {
        resolveExpression(field.value, env);
      }
      break;

    case 'ternary':
      resolveExpression(expr.condition, env);
      resolveExpression(expr.thenExpr, env);
      resolveExpression(expr.elseExpr, env);
      break;
  }
}

// ============================================================================
// Type Inference
// ============================================================================

/**
 * Infer the type of an expression
 */
export function inferType(expr: IRExpression, env: TypeEnvironment): IRType {
  switch (expr.kind) {
    case 'literal':
      return expr.type;

    case 'identifier':
      return env.lookup(expr.name) || primitiveType('void');

    case 'binary':
      // Comparison operators return bool
      if (['<', '>', '<=', '>=', '==', '!=', '&&', '||'].includes(expr.operator)) {
        return primitiveType('bool');
      }
      // Arithmetic operators return the type of operands
      return inferType(expr.left, env);

    case 'unary':
      if (expr.operator === '!') {
        return primitiveType('bool');
      }
      return inferType(expr.operand, env);

    case 'index':
      const objType = inferType(expr.object, env);
      if (isArrayType(objType)) {
        return objType.elementType;
      }
      return primitiveType('void');

    case 'property':
      const propObjType = inferType(expr.object, env);
      if (propObjType.kind === 'struct') {
        return env.getStructFieldType(propObjType.name, expr.property) || primitiveType('void');
      }
      // length property on arrays/strings
      if (expr.property === 'length') {
        return primitiveType('usize');
      }
      // Handle process constants
      if (expr.object.kind === 'identifier' && expr.object.name === 'process') {
        const constant = processConstants[expr.property];
        if (constant?.returnType) {
          const typeName = constant.returnType.replace('&', '');
          // Check if this is an array/vector type
          if (typeName.includes('Vec<') || typeName.includes('[')) {
            return arrayType(primitiveType('String'));
          }
          return primitiveType(typeName as any);
        }
      }
      return primitiveType('void');

    case 'method_call':
      // Try to infer return type from builtin methods
      if (expr.namespace) {
        const handler = getBuiltinMethod(expr.namespace, expr.method);
        if (handler?.returnType) {
          return primitiveType(handler.returnType as any);
        }
      } else {
        const arrayHandler = getArrayMethod(expr.method);
        if (arrayHandler?.returnType) {
          return primitiveType(arrayHandler.returnType as any);
        }
        const stringHandler = getStringMethod(expr.method);
        if (stringHandler?.returnType) {
          return primitiveType(stringHandler.returnType as any);
        }
      }
      // Default: assume void for unknown methods
      return primitiveType('void');

    case 'array_literal':
      return arrayType(expr.elementType);

    case 'struct_literal':
      return { kind: 'struct', name: expr.structName };

    case 'tuple_literal':
      return { kind: 'tuple', elements: expr.elements.map((e) => inferType(e, env)) };

    case 'enum_variant':
      return { kind: 'enum', name: expr.enumName };

    case 'ternary':
      return inferType(expr.thenExpr, env);

    case 'cast':
      return expr.targetType;

    default:
      return primitiveType('void');
  }
}
