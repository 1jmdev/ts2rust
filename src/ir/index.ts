// IR Module - Re-exports all IR types, expressions, statements, and declarations
//
// This is the main entry point for the IR module. Import from here:
//   import { IRType, IRExpression, IRStatement, IRFunction, ... } from './ir/index.ts';

// ============================================================================
// Types
// ============================================================================
export {
  // Type definitions
  type PrimitiveName,
  type IRType,
  type IRPrimitiveType,
  type IRArrayType,
  type IRStructType,
  type IREnumType,
  type IRTupleType,
  type IROptionalType,
  type IRReferenceType,
  type IRFunctionType,
  
  // Type constructors
  primitiveType,
  arrayType,
  structType,
  enumType,
  tupleType,
  optionalType,
  referenceType,
  functionType,
  
  // Type predicates
  isPrimitiveType,
  isArrayType,
  isStructType,
  isEnumType,
  isTupleType,
  isOptionalType,
  isReferenceType,
  isFunctionType,
  
  // Specific type checks
  isVoidType,
  isNumericType,
  isIntegerType,
  isFloatType,
  isStringType,
  isOwnedStringType,
  isStrRefType,
  isBoolType,
  
  // Type utilities
  isCopyType,
  needsClone,
  getInnerType,
  canStructDeriveCopy,
} from './types.ts';

// ============================================================================
// Expressions
// ============================================================================
export {
  // Expression types
  type IRExpression,
  type IRLiteral,
  type IRIdentifier,
  type IRBinaryOp,
  type IRUnaryOp,
  type IRCall,
  type IRMethodCall,
  type IRIndex,
  type IRPropertyAccess,
  type IRArrayLiteral,
  type IRStructLiteral,
  type IRTupleLiteral,
  type IREnumVariant,
  type IRClosure,
  type IRClosureBody,
  type IRTernary,
  type IRCast,
  
  // Expression constructors
  literal,
  identifier,
  binaryOp,
  unaryOp,
  call,
  methodCall,
  index,
  propertyAccess,
  arrayLiteral,
  structLiteral,
  tupleLiteral,
  enumVariant,
  ternary,
  cast,
} from './expressions.ts';

// ============================================================================
// Statements
// ============================================================================
export {
  // Statement types
  type IRStatement,
  type IRVariableDecl,
  type IRAssignment,
  type IRReturn,
  type IRBreak,
  type IRContinue,
  type IRIf,
  type IRWhile,
  type IRForIn,
  type IRSwitch,
  type IRSwitchCase,
  type IRMatch,
  type IRMatchArm,
  type IRPattern,
  type IRBlock,
  type IRExpressionStmt,
  
  // Statement constructors
  variableDecl,
  assignment,
  returnStmt,
  breakStmt,
  continueStmt,
  ifStmt,
  whileStmt,
  forInStmt,
  switchStmt,
  matchStmt,
  block,
  expressionStmt,
} from './statements.ts';

// ============================================================================
// Declarations
// ============================================================================
export {
  // Declaration types
  type IRDeclaration,
  type IRStruct,
  type IRStructField,
  type IREnum,
  type IREnumVariantDef,
  type IREnumVariantUnit,
  type IREnumVariantTuple,
  type IREnumVariantStruct,
  type IRTypeAlias,
  type IRFunction,
  type IRParam,
  type IRImpl,
  type IRMethod,
  type IRProgram,
  
  // Declaration constructors
  structDecl,
  structField,
  enumDecl,
  enumVariantUnit,
  enumVariantTuple,
  enumVariantStruct,
  typeAliasDecl,
  functionDecl,
  param,
  implBlock,
  method,
  program,
} from './declarations.ts';
