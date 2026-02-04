// Codegen Expressions - Generate Rust code for IR expressions

import type { IRExpression, IRType } from '../ir/index.ts';
import {
  toSnakeCase,
  irTypeToRust,
  escapeString,
  coerceToString,
} from './types.ts';
import {
  getBuiltinMethod,
  resolveMethodByName,
  mathConstants,
} from './builtins/index.ts';

// ============================================================================
// Expression Generation
// ============================================================================

/**
 * Generate Rust code for an expression
 */
export function generateExpression(expr: IRExpression): string {
  switch (expr.kind) {
    case 'literal':
      return generateLiteral(expr);

    case 'identifier':
      return toSnakeCase(expr.name);

    case 'binary':
      return `${generateExpression(expr.left)} ${expr.operator} ${generateExpression(expr.right)}`;

    case 'unary':
      return `${expr.operator}${generateExpression(expr.operand)}`;

    case 'call':
      return generateCall(expr);

    case 'method_call':
      return generateMethodCall(expr);

    case 'index':
      return generateIndex(expr);

    case 'property':
      return generatePropertyAccess(expr);

    case 'array_literal':
      return `vec![${expr.elements.map(generateExpression).join(', ')}]`;

    case 'struct_literal':
      return generateStructLiteral(expr);

    case 'tuple_literal':
      return `(${expr.elements.map(generateExpression).join(', ')})`;

    case 'enum_variant':
      return generateEnumVariant(expr);

    case 'ternary':
      return generateTernary(expr);

    case 'cast':
      return `(${generateExpression(expr.expression)} as ${irTypeToRust(expr.targetType)})`;

    case 'closure':
      return generateClosure(expr);

    default:
      throw new Error(`Unknown expression kind: ${(expr as IRExpression).kind}`);
  }
}

/**
 * Generate expression with type coercion (e.g., &str -> String)
 */
export function generateExpressionWithType(expr: IRExpression, targetType?: IRType): string {
  const exprStr = generateExpression(expr);
  return coerceToString(exprStr, expr, targetType);
}

// ============================================================================
// Literal Generation
// ============================================================================

function generateLiteral(expr: IRExpression & { kind: 'literal' }): string {
  if (typeof expr.value === 'number') {
    if (expr.isInteger || Number.isInteger(expr.value)) {
      return expr.value.toString();
    } else {
      const str = expr.value.toString();
      return str.includes('.') ? str : `${str}.0`;
    }
  }
  if (typeof expr.value === 'string') {
    return `"${escapeString(expr.value)}"`;
  }
  if (typeof expr.value === 'boolean') {
    return expr.value ? 'true' : 'false';
  }
  throw new Error('Unknown literal type');
}

// ============================================================================
// Call Generation
// ============================================================================

function generateCall(expr: IRExpression & { kind: 'call' }): string {
  const args = expr.args.map(generateExpression).join(', ');
  return `${toSnakeCase(expr.callee)}(${args})`;
}

function generateMethodCall(expr: IRExpression & { kind: 'method_call' }): string {
  const args = expr.args.map(generateExpression);

  // Builtin namespace call (console.log, Math.abs, etc.)
  if (expr.namespace) {
    const handler = getBuiltinMethod(expr.namespace, expr.method);
    if (handler) {
      return handler.generateRust(null, args, expr.args);
    }
    return `/* ${expr.namespace}.${expr.method} not supported */`;
  }

  const objStr = generateExpression(expr.object);

  // Use type info if available, otherwise use heuristics
  if (expr.objectType) {
    // Type-aware resolution would go here
    // For now, fall back to name-based resolution
  }

  // Try to resolve method by name
  const handler = resolveMethodByName(expr.method);
  if (handler) {
    return handler.generateRust(objStr, args, expr.args);
  }

  // Generic method call
  return `${objStr}.${toSnakeCase(expr.method)}(${args.join(', ')})`;
}

// ============================================================================
// Access Generation
// ============================================================================

function generateIndex(expr: IRExpression & { kind: 'index' }): string {
  const obj = generateExpression(expr.object);
  const idx = generateExpression(expr.index);

  // For integer literals, no cast needed
  if (
    expr.index.kind === 'literal' &&
    typeof expr.index.value === 'number' &&
    Number.isInteger(expr.index.value)
  ) {
    return `${obj}[${idx}]`;
  }
  return `${obj}[${idx} as usize]`;
}

function generatePropertyAccess(expr: IRExpression & { kind: 'property' }): string {
  const obj = generateExpression(expr.object);

  // Handle Math constants
  if (expr.object.kind === 'identifier' && expr.object.name === 'Math') {
    const constant = mathConstants[expr.property];
    if (constant) {
      return constant;
    }
  }

  // Special property mappings
  if (expr.property === 'length') {
    return `${obj}.len()`;
  }

  // Regular field access
  return `${obj}.${toSnakeCase(expr.property)}`;
}

// ============================================================================
// Composite Expression Generation
// ============================================================================

function generateStructLiteral(expr: IRExpression & { kind: 'struct_literal' }): string {
  const fields = expr.fields
    .map((f) => `${toSnakeCase(f.name)}: ${generateExpression(f.value)}`)
    .join(', ');
  return `${expr.structName} { ${fields} }`;
}

function generateEnumVariant(expr: IRExpression & { kind: 'enum_variant' }): string {
  if (!expr.data || expr.data.length === 0) {
    return `${expr.enumName}::${expr.variant}`;
  }
  const args = expr.data.map(generateExpression).join(', ');
  return `${expr.enumName}::${expr.variant}(${args})`;
}

function generateTernary(expr: IRExpression & { kind: 'ternary' }): string {
  const cond = generateExpression(expr.condition);
  const thenExpr = generateExpression(expr.thenExpr);
  const elseExpr = generateExpression(expr.elseExpr);
  return `if ${cond} { ${thenExpr} } else { ${elseExpr} }`;
}

function generateClosure(expr: IRExpression & { kind: 'closure' }): string {
  const params = expr.params
    .map((p) => {
      if (p.type) {
        return `${toSnakeCase(p.name)}: ${irTypeToRust(p.type)}`;
      }
      return toSnakeCase(p.name);
    })
    .join(', ');

  if ('kind' in expr.body && expr.body.kind === 'closure_body') {
    // Multi-statement closure body - would need statement generation
    return `|${params}| { /* closure body */ }`;
  }

  // Single expression body
  const body = generateExpression(expr.body as IRExpression);
  return `|${params}| ${body}`;
}
