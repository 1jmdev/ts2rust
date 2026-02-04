// Rust Code Generator: Convert IR to Rust source code

import {
  type IRProgram,
  type IRFunction,
  type IRStatement,
  type IRExpression,
  type IRType,
} from './ir.ts';

import { irTypeToRust, isVoidType, isOwnedStringType, isStrRefType } from './types.ts';
import { getBuiltinMethod, getArrayMethod, getStringMethod } from './builtins.ts';

/**
 * Convert camelCase to snake_case
 */
function toSnakeCase(name: string): string {
  // Handle already snake_case names
  if (name.includes('_') && !name.match(/[A-Z]/)) {
    return name;
  }
  
  // Convert camelCase/PascalCase to snake_case
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, ''); // Remove leading underscore if present
}

/**
 * Check if an expression is a string literal (&str)
 */
function isStrLiteral(expr: IRExpression): boolean {
  return expr.kind === 'literal' && typeof expr.value === 'string';
}

/**
 * Check if expression needs string conversion (for &str -> String)
 * This is needed for identifiers that hold &str but need to be returned as String
 */
function mightNeedStringConversion(expr: IRExpression): boolean {
  return expr.kind === 'literal' && typeof expr.value === 'string' ||
         expr.kind === 'identifier';  // Variables might hold &str
}

/**
 * Generate expression with potential type coercion
 * If targetType is String and expr is &str literal or identifier, add .to_string()
 */
function generateExpressionWithType(expr: IRExpression, targetType?: IRType): string {
  const baseExpr = generateExpression(expr);
  
  // If target is owned String and we might have &str, add .to_string()
  if (targetType && isOwnedStringType(targetType) && mightNeedStringConversion(expr)) {
    return `${baseExpr}.to_string()`;
  }
  
  return baseExpr;
}

/**
 * Generate Rust source code from IR
 */
export function generate(program: IRProgram): string {
  const lines: string[] = [];

  for (const func of program.functions) {
    lines.push(generateFunction(func));
    lines.push('');
  }

  return lines.join('\n');
}

function generateFunction(func: IRFunction): string {
  const lines: string[] = [];

  // Function signature - convert name to snake_case
  const funcName = toSnakeCase(func.name);
  const params = func.params.map((p) => `${toSnakeCase(p.name)}: ${irTypeToRust(p.type)}`).join(', ');

  const returnType = isVoidType(func.returnType) ? '' : ` -> ${irTypeToRust(func.returnType)}`;

  lines.push(`fn ${funcName}(${params})${returnType} {`);

  // Function body - pass return type for proper coercion
  for (let i = 0; i < func.body.length; i++) {
    const stmt = func.body[i]!;
    const isLast = i === func.body.length - 1;
    const stmtLines = generateStatement(stmt, 1, isLast && !isVoidType(func.returnType), func.returnType);
    lines.push(...stmtLines);
  }

  lines.push('}');

  return lines.join('\n');
}

function indent(level: number): string {
  return '    '.repeat(level);
}

function generateStatement(
  stmt: IRStatement,
  indentLevel: number,
  isLastInNonVoidFn: boolean = false,
  returnType?: IRType
): string[] {
  const ind = indent(indentLevel);
  const lines: string[] = [];

  switch (stmt.kind) {
    case 'variable': {
      const mutKeyword = stmt.mutable ? 'mut ' : '';
      const varName = toSnakeCase(stmt.name);
      const initStr = generateExpression(stmt.init);
      // Let Rust infer types when possible for cleaner code
      // Only specify type for arrays (Vec<T>) where inference might fail
      if (stmt.type.kind === 'array') {
        const typeStr = irTypeToRust(stmt.type);
        lines.push(`${ind}let ${mutKeyword}${varName}: ${typeStr} = ${initStr};`);
      } else {
        // For primitives, let Rust infer - cleaner code
        lines.push(`${ind}let ${mutKeyword}${varName} = ${initStr};`);
      }
      break;
    }

    case 'assignment': {
      const targetStr = generateExpression(stmt.target);
      const valueStr = generateExpression(stmt.value);
      lines.push(`${ind}${targetStr} = ${valueStr};`);
      break;
    }

    case 'return': {
      if (stmt.value) {
        // Use type-aware expression for proper coercion (e.g., &str to String)
        const valueStr = generateExpressionWithType(stmt.value, returnType);
        if (isLastInNonVoidFn) {
          // Last return in non-void function - use implicit return (no return keyword, no semicolon)
          lines.push(`${ind}${valueStr}`);
        } else {
          lines.push(`${ind}return ${valueStr};`);
        }
      } else {
        if (!isLastInNonVoidFn) {
          lines.push(`${ind}return;`);
        }
        // If it's the last statement and void, we can omit the return entirely
      }
      break;
    }

    case 'if': {
      const condStr = generateExpression(stmt.condition);
      lines.push(`${ind}if ${condStr} {`);

      for (let i = 0; i < stmt.thenBranch.length; i++) {
        const s = stmt.thenBranch[i]!;
        const isLast = i === stmt.thenBranch.length - 1;
        lines.push(...generateStatement(s, indentLevel + 1, isLast && isLastInNonVoidFn && !stmt.elseBranch, returnType));
      }

      if (stmt.elseBranch) {
        lines.push(`${ind}} else {`);
        for (let i = 0; i < stmt.elseBranch.length; i++) {
          const s = stmt.elseBranch[i]!;
          const isLast = i === stmt.elseBranch.length - 1;
          lines.push(...generateStatement(s, indentLevel + 1, isLast && isLastInNonVoidFn, returnType));
        }
      }

      lines.push(`${ind}}`);
      break;
    }

    case 'while': {
      const condStr = generateExpression(stmt.condition);
      lines.push(`${ind}while ${condStr} {`);

      for (const s of stmt.body) {
        lines.push(...generateStatement(s, indentLevel + 1, false, returnType));
      }

      lines.push(`${ind}}`);
      break;
    }

    case 'switch': {
      // Generate Rust match expression
      const discStr = generateExpression(stmt.discriminant);
      
      lines.push(`${ind}match ${discStr} {`);

      for (const caseItem of stmt.cases) {
        if (caseItem.value === undefined) {
          // Default case
          lines.push(`${ind}    _ => {`);
        } else {
          const valueStr = generateExpression(caseItem.value);
          // Direct pattern matching - clean and idiomatic
          lines.push(`${ind}    ${valueStr} => {`);
        }

        for (const s of caseItem.body) {
          lines.push(...generateStatement(s, indentLevel + 2, false, returnType));
        }

        lines.push(`${ind}    }`);
      }

      // Add a catch-all if no default case
      const hasDefault = stmt.cases.some(c => c.value === undefined);
      if (!hasDefault) {
        lines.push(`${ind}    _ => {}`);
      }

      lines.push(`${ind}}`);
      break;
    }

    case 'break': {
      lines.push(`${ind}break;`);
      break;
    }

    case 'expression': {
      const exprStr = generateExpression(stmt.expression);
      
      // Check if this is a method call that is a statement (like console.log, push, etc.)
      if (stmt.expression.kind === 'method_call') {
        const methodCall = stmt.expression;
        if (methodCall.namespace) {
          // Builtin namespace call (console.log, etc.)
          const handler = getBuiltinMethod(methodCall.namespace, methodCall.method);
          if (handler?.isStatement) {
            lines.push(`${ind}${exprStr};`);
            break;
          }
        } else {
          // Check if it's an array method that's a statement
          const arrayHandler = getArrayMethod(methodCall.method);
          if (arrayHandler?.isStatement) {
            lines.push(`${ind}${exprStr};`);
            break;
          }
        }
      }

      if (isLastInNonVoidFn) {
        // Last expression in non-void function - omit semicolon for implicit return
        lines.push(`${ind}${exprStr}`);
      } else {
        lines.push(`${ind}${exprStr};`);
      }
      break;
    }

    case 'block': {
      for (let i = 0; i < stmt.statements.length; i++) {
        const s = stmt.statements[i]!;
        const isLast = i === stmt.statements.length - 1;
        lines.push(...generateStatement(s, indentLevel, isLast && isLastInNonVoidFn, returnType));
      }
      break;
    }
  }

  return lines;
}

function generateExpression(expr: IRExpression): string {
  switch (expr.kind) {
    case 'literal': {
      if (typeof expr.value === 'number') {
        // Check if this is an integer or float
        if (expr.isInteger || Number.isInteger(expr.value)) {
          // Integer - no decimal point needed
          return expr.value.toString();
        } else {
          // Float - ensure decimal point
          const str = expr.value.toString();
          return str.includes('.') ? str : `${str}.0`;
        }
      }
      if (typeof expr.value === 'string') {
        // Use simple string literal - Rust will infer &str
        return `"${escapeString(expr.value)}"`;
      }
      if (typeof expr.value === 'boolean') {
        return expr.value ? 'true' : 'false';
      }
      throw new Error(`Unknown literal type`);
    }

    case 'identifier': {
      return toSnakeCase(expr.name);
    }

    case 'binary': {
      const left = generateExpression(expr.left);
      const right = generateExpression(expr.right);
      return `${left} ${expr.operator} ${right}`;
    }

    case 'unary': {
      const operand = generateExpression(expr.operand);
      return `${expr.operator}${operand}`;
    }

    case 'call': {
      // Regular function call - convert function name to snake_case
      const args = expr.args.map(generateExpression).join(', ');
      return `${toSnakeCase(expr.callee)}(${args})`;
    }

    case 'method_call': {
      const args = expr.args.map(generateExpression);
      
      // Check if this is a builtin namespace call (console.log, Math.abs, etc.)
      if (expr.namespace) {
        const handler = getBuiltinMethod(expr.namespace, expr.method);
        if (handler) {
          return handler.generateRust(null, args, expr.args);
        }
        // Fallback for unknown builtin methods
        return `/* ${expr.namespace}.${expr.method} not supported */`;
      }

      // Check if this is an array method or string method based on context
      const objStr = generateExpression(expr.object);
      
      // Try to determine if this is a string or array operation
      // Check the object - if it's an identifier that looks like a string literal, use string method
      // If the method name is common to both, we need context
      const isLikelyString = expr.object.kind === 'literal' && typeof expr.object.value === 'string' ||
                             (expr.object.kind === 'identifier' && 
                              ['str', 'string', 'text', 'name', 'upper', 'lower', 'trimmed', 'replaced'].some(s => 
                                expr.object.kind === 'identifier' && expr.object.name.toLowerCase().includes(s)));
      
      // String-specific methods that don't exist on arrays
      const stringOnlyMethods = ['toUpperCase', 'toLowerCase', 'trim', 'trimStart', 'trimEnd', 
                                  'charAt', 'charCodeAt', 'substring', 'replace', 'replaceAll',
                                  'split', 'repeat', 'startsWith', 'endsWith', 'padStart', 'padEnd'];
      
      // Array-specific methods that don't exist on strings
      const arrayOnlyMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'reverse', 'sort',
                                'fill', 'copyWithin', 'slice', 'concat', 'flat', 'map', 'filter',
                                'reduce', 'reduceRight', 'forEach', 'every', 'some', 'find', 'findIndex', 'at'];
      
      // Check string-specific methods first
      if (stringOnlyMethods.includes(expr.method)) {
        const stringHandler = getStringMethod(expr.method);
        if (stringHandler) {
          return stringHandler.generateRust(objStr, args, expr.args);
        }
      }
      
      // Check array-specific methods
      if (arrayOnlyMethods.includes(expr.method)) {
        const arrayHandler = getArrayMethod(expr.method);
        if (arrayHandler) {
          return arrayHandler.generateRust(objStr, args, expr.args);
        }
      }
      
      // For ambiguous methods like 'includes' and 'indexOf', use context
      if (isLikelyString) {
        const stringHandler = getStringMethod(expr.method);
        if (stringHandler) {
          return stringHandler.generateRust(objStr, args, expr.args);
        }
      }
      
      // Default: try array method first (more common for collections)
      const arrayHandler = getArrayMethod(expr.method);
      if (arrayHandler) {
        return arrayHandler.generateRust(objStr, args, expr.args);
      }

      // Check if this is a string method
      const stringHandler = getStringMethod(expr.method);
      if (stringHandler) {
        return stringHandler.generateRust(objStr, args, expr.args);
      }

      // Generic method call
      return `${objStr}.${expr.method}(${args.join(', ')})`;
    }

    case 'index': {
      const obj = generateExpression(expr.object);
      const idx = generateExpression(expr.index);
      // For integer literals, no cast needed - just use directly
      // For other expressions, we need to cast to usize
      if (expr.index.kind === 'literal' && typeof expr.index.value === 'number' && Number.isInteger(expr.index.value)) {
        return `${obj}[${idx}]`;
      }
      return `${obj}[${idx} as usize]`;
    }

    case 'property': {
      const obj = generateExpression(expr.object);

      // Special property mappings
      if (expr.property === 'length') {
        // Return .len() directly - clean and idiomatic
        return `${obj}.len()`;
      }

      return `${obj}.${expr.property}`;
    }

    case 'array_literal': {
      const elements = expr.elements.map(generateExpression).join(', ');
      return `vec![${elements}]`;
    }
  }
}

function escapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
