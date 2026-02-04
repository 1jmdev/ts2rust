// Validator: Check that TypeScript source conforms to our supported subset

import {
  SourceFile,
  Node,
  SyntaxKind,
  FunctionDeclaration,
  VariableDeclaration,
  TypeNode,
  InterfaceDeclaration,
  EnumDeclaration,
} from 'ts-morph';

import { processConstants } from './codegen/builtins/process.ts';

export interface ValidationError {
  message: string;
  line: number;
  column: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

  export interface ValidatorOptions {
    /** Allow interface declarations (becomes Rust structs) */
    allowInterfaces?: boolean;
    /** Allow type alias declarations */
    allowTypeAliases?: boolean;
    /** Allow enum declarations */
    allowEnums?: boolean;
    /** Require explicit type annotations on variables */
    requireVariableTypes?: boolean;
    /** List of builtin methods that don't need type annotations */
    knownReturnTypes?: Record<string, string>;
  }

const defaultOptions: ValidatorOptions = {
  allowInterfaces: true,
  allowTypeAliases: true,
  allowEnums: true,
  requireVariableTypes: true,
  knownReturnTypes: {
    cwd: 'String',
    uptime: 'f64',
    memoryUsage: 'f64',
    hrtime: 'f64',
    title: 'String',
    release: 'String',
    versions: 'String',
  },
};

/**
 * Validate that a source file conforms to the supported TypeScript subset
 */
export function validate(
  sourceFile: SourceFile,
  options: ValidatorOptions = {}
): ValidationResult {
  const opts = { ...defaultOptions, ...options };
  const errors: ValidationError[] = [];

  function addError(node: Node, message: string): void {
    const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
    errors.push({ message, line, column });
  }

  function checkTypeNode(typeNode: TypeNode | undefined, context: string): void {
    if (!typeNode) {
      return;
    }

    const typeText = typeNode.getText();

    // Ban 'any'
    if (typeNode.getKind() === SyntaxKind.AnyKeyword || typeText === 'any') {
      addError(typeNode, `Type 'any' is not allowed in ${context}`);
    }

    // Ban 'unknown'
    if (typeNode.getKind() === SyntaxKind.UnknownKeyword || typeText === 'unknown') {
      addError(typeNode, `Type 'unknown' is not allowed in ${context}`);
    }

    // Ban 'null' as standalone type
    if (typeNode.getKind() === SyntaxKind.NullKeyword || typeText === 'null') {
      addError(typeNode, `Type 'null' is not allowed in ${context}`);
    }

    // Ban 'undefined' as standalone type
    if (typeNode.getKind() === SyntaxKind.UndefinedKeyword || typeText === 'undefined') {
      addError(typeNode, `Type 'undefined' is not allowed in ${context}`);
    }

    // Check union types
    if (typeNode.getKind() === SyntaxKind.UnionType) {
      const unionTypes = typeNode.asKind(SyntaxKind.UnionType)?.getTypeNodes() || [];
      for (const ut of unionTypes) {
        checkTypeNode(ut, context);
      }
    }
  }

  function validateInterface(iface: InterfaceDeclaration): void {
    // Check all properties have types
    for (const prop of iface.getProperties()) {
      const propType = prop.getTypeNode();
      if (!propType) {
        addError(prop, `Property '${prop.getName()}' must have an explicit type annotation`);
      } else {
        checkTypeNode(propType, `interface property '${prop.getName()}'`);
      }
    }
  }

  function validateEnum(enumDecl: EnumDeclaration): void {
    // Check for string enums with complex initializers (not fully supported)
    for (const member of enumDecl.getMembers()) {
      const init = member.getInitializer();
      if (init) {
        const kind = init.getKind();
        // Allow numeric and string literals
        if (
          kind !== SyntaxKind.NumericLiteral &&
          kind !== SyntaxKind.StringLiteral &&
          kind !== SyntaxKind.PrefixUnaryExpression // -1, etc.
        ) {
          addError(
            init,
            `Enum member '${member.getName()}' has a complex initializer that may not be fully supported`
          );
        }
      }
    }
  }

  function walkNode(node: Node): void {
    const kind = node.getKind();

    // Ban class declarations
    if (kind === SyntaxKind.ClassDeclaration) {
      addError(node, 'Class declarations are not supported');
    }

    // Check function declarations
    if (kind === SyntaxKind.FunctionDeclaration) {
      const func = node as FunctionDeclaration;

      if (func.isAsync()) {
        addError(node, 'Async functions are not supported');
      }

      // Check return type is specified
      const returnType = func.getReturnTypeNode();
      if (!returnType) {
        addError(
          node,
          `Function '${func.getName() || 'anonymous'}' must have an explicit return type`
        );
      } else {
        checkTypeNode(returnType, `function '${func.getName() || 'anonymous'}' return type`);
      }

      // Check all parameters have types
      for (const param of func.getParameters()) {
        const paramType = param.getTypeNode();
        if (!paramType) {
          addError(param, `Parameter '${param.getName()}' must have an explicit type annotation`);
        } else {
          checkTypeNode(paramType, `parameter '${param.getName()}'`);
        }
      }
    }

    // Ban arrow functions that are async
    if (kind === SyntaxKind.ArrowFunction) {
      const arrow = node.asKind(SyntaxKind.ArrowFunction);
      if (arrow?.isAsync()) {
        addError(node, 'Async arrow functions are not supported');
      }
    }

    // Ban await expressions
    if (kind === SyntaxKind.AwaitExpression) {
      addError(node, 'Await expressions are not supported');
    }

    // Ban try/catch/finally
    if (kind === SyntaxKind.TryStatement) {
      addError(node, 'Try/catch statements are not supported');
    }

    // Ban throw statements
    if (kind === SyntaxKind.ThrowStatement) {
      addError(node, 'Throw statements are not supported');
    }

    // Handle interface declarations
    if (kind === SyntaxKind.InterfaceDeclaration) {
      if (!opts.allowInterfaces) {
        addError(node, 'Interface declarations are not enabled');
      } else {
        validateInterface(node as InterfaceDeclaration);
      }
    }

    // Handle type alias declarations
    if (kind === SyntaxKind.TypeAliasDeclaration) {
      if (!opts.allowTypeAliases) {
        addError(node, 'Type alias declarations are not enabled');
      }
    }

    // Handle enum declarations
    if (kind === SyntaxKind.EnumDeclaration) {
      if (!opts.allowEnums) {
        addError(node, 'Enum declarations are not enabled');
      } else {
        validateEnum(node as EnumDeclaration);
      }
    }

    // Check variable declarations have explicit types
    if (kind === SyntaxKind.VariableDeclaration) {
      const varDecl = node as VariableDeclaration;
      const typeNode = varDecl.getTypeNode();
      const init = varDecl.getInitializer();
      
      // Check if this is a known builtin method call that has a return type
      let hasKnownType = false;
      if (opts.knownReturnTypes && init) {
        const initKind = init.getKind();
        
        // Handle method calls like process.cwd()
        if (initKind === SyntaxKind.CallExpression) {
          const call = init.asKind(SyntaxKind.CallExpression);
          if (call) {
            const expr = call.getExpression();
            if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
              const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
              if (propAccess) {
                const obj = propAccess.getExpression();
                const method = propAccess.getName();
                if (obj.getKind() === SyntaxKind.Identifier && obj.getText() === 'process') {
                  const returnType = opts.knownReturnTypes[method];
                  if (returnType) {
                    hasKnownType = true;
                  }
                }
              }
            }
          }
        }
        
        // Handle property access like process.pid
        if (initKind === SyntaxKind.PropertyAccessExpression) {
          const propAccess = init.asKind(SyntaxKind.PropertyAccessExpression);
          if (propAccess) {
            const obj = propAccess.getExpression();
            const prop = propAccess.getName();
            if (obj.getKind() === SyntaxKind.Identifier && obj.getText() === 'process') {
              const constant = processConstants[prop];
              if (constant) {
                hasKnownType = true;
              }
            }
          }
        }
      }
      
      if (opts.requireVariableTypes && !typeNode && !hasKnownType) {
        addError(node, `Variable '${varDecl.getName()}' must have an explicit type annotation`);
      } else if (typeNode) {
        checkTypeNode(typeNode, `variable '${varDecl.getName()}'`);
      }
    }

    // Recursively check children
    node.forEachChild(walkNode);
  }

  // Walk all statements in the source file
  for (const statement of sourceFile.getStatements()) {
    walkNode(statement);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format validation errors for display
 */
export function formatErrors(errors: ValidationError[], filename: string): string {
  return errors.map((e) => `${filename}:${e.line}:${e.column}: error: ${e.message}`).join('\n');
}
