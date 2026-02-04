// Rust Code Generator: Convert IR to Rust source code

import {
  type IRProgram,
  type IRFunction,
  type IRStatement,
  type IRExpression,
  type IRType,
} from './ir.ts';

import { irTypeToRust, isVoidType } from './types.ts';
import { getBuiltinMethod, getArrayMethod, getStringMethod } from './builtins.ts';

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

  // Function signature
  const params = func.params.map((p) => `${p.name}: ${irTypeToRust(p.type)}`).join(', ');

  const returnType = isVoidType(func.returnType) ? '' : ` -> ${irTypeToRust(func.returnType)}`;

  lines.push(`fn ${func.name}(${params})${returnType} {`);

  // Function body
  for (let i = 0; i < func.body.length; i++) {
    const stmt = func.body[i]!;
    const isLast = i === func.body.length - 1;
    const stmtLines = generateStatement(stmt, 1, isLast && !isVoidType(func.returnType));
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
  isLastInNonVoidFn: boolean = false
): string[] {
  const ind = indent(indentLevel);
  const lines: string[] = [];

  switch (stmt.kind) {
    case 'variable': {
      const mutKeyword = stmt.mutable ? 'mut ' : '';
      const typeStr = irTypeToRust(stmt.type);
      const initStr = generateExpression(stmt.init);
      lines.push(`${ind}let ${mutKeyword}${stmt.name}: ${typeStr} = ${initStr};`);
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
        lines.push(`${ind}return ${generateExpression(stmt.value)};`);
      } else {
        lines.push(`${ind}return;`);
      }
      break;
    }

    case 'if': {
      const condStr = generateExpression(stmt.condition);
      lines.push(`${ind}if ${condStr} {`);

      for (let i = 0; i < stmt.thenBranch.length; i++) {
        const s = stmt.thenBranch[i]!;
        const isLast = i === stmt.thenBranch.length - 1;
        lines.push(...generateStatement(s, indentLevel + 1, isLast && isLastInNonVoidFn && !stmt.elseBranch));
      }

      if (stmt.elseBranch) {
        lines.push(`${ind}} else {`);
        for (let i = 0; i < stmt.elseBranch.length; i++) {
          const s = stmt.elseBranch[i]!;
          const isLast = i === stmt.elseBranch.length - 1;
          lines.push(...generateStatement(s, indentLevel + 1, isLast && isLastInNonVoidFn));
        }
      }

      lines.push(`${ind}}`);
      break;
    }

    case 'while': {
      const condStr = generateExpression(stmt.condition);
      lines.push(`${ind}while ${condStr} {`);

      for (const s of stmt.body) {
        lines.push(...generateStatement(s, indentLevel + 1));
      }

      lines.push(`${ind}}`);
      break;
    }

    case 'switch': {
      // Generate Rust match expression
      const discStr = generateExpression(stmt.discriminant);
      
      // For f64, we need to use a different approach since f64 doesn't implement Eq
      // We'll convert to a series of if-else statements for numeric discriminants
      // Or use match with integer conversion
      
      lines.push(`${ind}match ${discStr} as i64 {`);

      for (const caseItem of stmt.cases) {
        if (caseItem.value === undefined) {
          // Default case
          lines.push(`${ind}    _ => {`);
        } else {
          const valueStr = generateExpression(caseItem.value);
          // Convert the value to i64 for matching
          lines.push(`${ind}    x if x == ${valueStr} as i64 => {`);
        }

        for (const s of caseItem.body) {
          lines.push(...generateStatement(s, indentLevel + 2));
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
        lines.push(...generateStatement(s, indentLevel, isLast && isLastInNonVoidFn));
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
        // Ensure float format for f64
        const str = expr.value.toString();
        return str.includes('.') ? str : `${str}.0`;
      }
      if (typeof expr.value === 'string') {
        // Rust string literal
        return `String::from("${escapeString(expr.value)}")`;
      }
      if (typeof expr.value === 'boolean') {
        return expr.value ? 'true' : 'false';
      }
      throw new Error(`Unknown literal type`);
    }

    case 'identifier': {
      return expr.name;
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
      // Regular function call
      const args = expr.args.map(generateExpression).join(', ');
      return `${expr.callee}(${args})`;
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

      // Check if this is an array method
      const objStr = generateExpression(expr.object);
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
      // Cast index to usize for Rust
      return `${obj}[${idx} as usize]`;
    }

    case 'property': {
      const obj = generateExpression(expr.object);

      // Special property mappings
      if (expr.property === 'length') {
        return `${obj}.len() as f64`;
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
