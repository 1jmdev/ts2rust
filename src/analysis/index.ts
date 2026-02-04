// Analysis Module - Type resolution and ownership analysis
//
// Usage:
//   import { resolveTypes, analyzeOwnership } from './analysis/index.ts';

export {
  analyzeOwnership,
  analyzeFunction,
  suggestOptimizations,
  type VariableUsage,
  type FunctionAnalysis,
  type OptimizationSuggestion,
} from './ownership.ts';

export {
  TypeEnvironment,
  resolveTypes,
  inferType,
} from './type-resolver.ts';
