// Parser Expressions - Parse TypeScript expressions to IR

import {
  Expression,
  SyntaxKind,
  NumericLiteral,
  StringLiteral,
  Identifier,
  BinaryExpression,
  PrefixUnaryExpression,
  CallExpression,
  ElementAccessExpression,
  PropertyAccessExpression,
  ArrayLiteralExpression,
  ObjectLiteralExpression,
  ConditionalExpression,
} from 'ts-morph';

import {
  type IRExpression,
  type IRType,
  primitiveType,
} from '../ir/index.ts';

import { isBuiltinNamespace } from '../codegen/builtins/index.ts';

// ============================================================================
// Expression Parsing
// ============================================================================

export function parseExpression(expr: Expression): IRExpression {
  const kind = expr.getKind();

  switch (kind) {
    case SyntaxKind.NumericLiteral: {
      const num = expr as NumericLiteral;
      const value = num.getLiteralValue();
      const isInteger = Number.isInteger(value);
      return {
        kind: 'literal',
        value: value,
        type: primitiveType(isInteger ? 'i32' : 'f64'),
        isInteger,
      };
    }

    case SyntaxKind.StringLiteral: {
      const str = expr as StringLiteral;
      return {
        kind: 'literal',
        value: str.getLiteralValue(),
        type: primitiveType('&str'),
      };
    }

    case SyntaxKind.TrueKeyword: {
      return {
        kind: 'literal',
        value: true,
        type: primitiveType('bool'),
      };
    }

    case SyntaxKind.FalseKeyword: {
      return {
        kind: 'literal',
        value: false,
        type: primitiveType('bool'),
      };
    }

    case SyntaxKind.Identifier: {
      const ident = expr as Identifier;
      return {
        kind: 'identifier',
        name: ident.getText(),
      };
    }

    case SyntaxKind.BinaryExpression: {
      const binExpr = expr as BinaryExpression;
      const operator = binExpr.getOperatorToken().getText();

      // Map TypeScript operators to Rust equivalents
      const opMap: Record<string, string> = {
        '===': '==',
        '!==': '!=',
        '&&': '&&',
        '||': '||',
      };

      return {
        kind: 'binary',
        operator: opMap[operator] || operator,
        left: parseExpression(binExpr.getLeft()),
        right: parseExpression(binExpr.getRight()),
      };
    }

    case SyntaxKind.PrefixUnaryExpression: {
      const prefixExpr = expr as PrefixUnaryExpression;
      const opToken = prefixExpr.getOperatorToken();
      let operator: string;

      switch (opToken) {
        case SyntaxKind.ExclamationToken:
          operator = '!';
          break;
        case SyntaxKind.MinusToken:
          operator = '-';
          break;
        case SyntaxKind.PlusToken:
          operator = '+';
          break;
        default:
          throw new Error(`Unsupported prefix operator: ${opToken}`);
      }

      return {
        kind: 'unary',
        operator,
        operand: parseExpression(prefixExpr.getOperand()),
      };
    }

    case SyntaxKind.CallExpression: {
      return parseCallExpression(expr as CallExpression);
    }

    case SyntaxKind.ElementAccessExpression: {
      const elemAccess = expr as ElementAccessExpression;
      return {
        kind: 'index',
        object: parseExpression(elemAccess.getExpression()),
        index: parseExpression(elemAccess.getArgumentExpression()!),
      };
    }

    case SyntaxKind.PropertyAccessExpression: {
      const propAccess = expr as PropertyAccessExpression;
      return {
        kind: 'property',
        object: parseExpression(propAccess.getExpression()),
        property: propAccess.getName(),
      };
    }

    case SyntaxKind.ArrayLiteralExpression: {
      return parseArrayLiteral(expr as ArrayLiteralExpression);
    }

    case SyntaxKind.ObjectLiteralExpression: {
      return parseObjectLiteral(expr as ObjectLiteralExpression);
    }

    case SyntaxKind.ConditionalExpression: {
      const condExpr = expr as ConditionalExpression;
      return {
        kind: 'ternary',
        condition: parseExpression(condExpr.getCondition()),
        thenExpr: parseExpression(condExpr.getWhenTrue()),
        elseExpr: parseExpression(condExpr.getWhenFalse()),
      };
    }

    case SyntaxKind.ParenthesizedExpression: {
      const parenExpr = expr.asKind(SyntaxKind.ParenthesizedExpression)!;
      return parseExpression(parenExpr.getExpression());
    }

    default:
      throw new Error(`Unsupported expression kind: ${expr.getKindName()}`);
  }
}

// ============================================================================
// Call Expression Parsing
// ============================================================================

function parseCallExpression(callExpr: CallExpression): IRExpression {
  const calleeExpr = callExpr.getExpression();
  const args = callExpr.getArguments().map((a) => parseExpression(a as Expression));

  // Check for property access (method call or namespace call)
  if (calleeExpr.getKind() === SyntaxKind.PropertyAccessExpression) {
    const propAccess = calleeExpr as PropertyAccessExpression;
    const objExpr = propAccess.getExpression();
    const method = propAccess.getName();
    const objText = objExpr.getText();

    // Check if this is a builtin namespace (console, Math, etc.)
    if (isBuiltinNamespace(objText)) {
      return {
        kind: 'method_call',
        object: { kind: 'identifier', name: objText },
        method,
        args,
        namespace: objText,
      };
    }

    // Regular method call on an object
    return {
      kind: 'method_call',
      object: parseExpression(objExpr),
      method,
      args,
    };
  }

  // Regular function call
  return {
    kind: 'call',
    callee: calleeExpr.getText(),
    args,
  };
}

// ============================================================================
// Array Literal Parsing
// ============================================================================

function parseArrayLiteral(arrayLit: ArrayLiteralExpression): IRExpression {
  const elements = arrayLit.getElements().map((e) => parseExpression(e as Expression));

  // Infer element type from first element, or default to f64
  let elementType: IRType = primitiveType('f64');
  if (elements.length > 0) {
    const firstElem = elements[0]!;
    if (firstElem.kind === 'literal') {
      elementType = firstElem.type;
    }
  }

  return {
    kind: 'array_literal',
    elements,
    elementType,
  };
}

// ============================================================================
// Object Literal Parsing (for struct instantiation)
// ============================================================================

function parseObjectLiteral(objLit: ObjectLiteralExpression): IRExpression {
  const properties = objLit.getProperties();
  const fields: Array<{ name: string; value: IRExpression }> = [];

  for (const prop of properties) {
    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
      const propAssign = prop.asKind(SyntaxKind.PropertyAssignment)!;
      const name = propAssign.getName();
      const init = propAssign.getInitializer();
      if (init) {
        fields.push({
          name,
          value: parseExpression(init as Expression),
        });
      }
    } else if (prop.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
      // { name } shorthand - name is both the property and variable name
      const shorthand = prop.asKind(SyntaxKind.ShorthandPropertyAssignment)!;
      const name = shorthand.getName();
      fields.push({
        name,
        value: { kind: 'identifier', name },
      });
    }
  }

  // We'll determine the struct name from context (type annotation)
  // For now, use a placeholder that will be resolved during type analysis
  return {
    kind: 'struct_literal',
    structName: '__anonymous__',
    fields,
  };
}
