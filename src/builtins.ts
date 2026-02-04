// Builtins System - Extensible handlers for console.*, Array methods, etc.

import type { IRExpression, IRType } from './ir.ts';

// ============================================================================
// Builtin Method Registry
// ============================================================================

export interface BuiltinMethodHandler {
  /** Generate Rust code for this method call */
  generateRust(object: string | null, args: string[], rawArgs: IRExpression[]): string;
  /** Whether this method mutates the object */
  mutates: boolean;
  /** Whether this is a statement (no return value) */
  isStatement: boolean;
  /** Rust return type (if expression) */
  returnType?: string;
}

export interface BuiltinNamespace {
  methods: Record<string, BuiltinMethodHandler>;
}

// ============================================================================
// Console Builtins
// ============================================================================

export const consoleBuiltins: BuiltinNamespace = {
  methods: {
    log: {
      generateRust: (_obj, args) => {
        if (args.length === 0) return 'println!()';
        const formatStr = args.map(() => '{}').join(' ');
        return `println!("${formatStr}", ${args.join(', ')})`;
      },
      mutates: false,
      isStatement: true,
    },
    error: {
      generateRust: (_obj, args) => {
        if (args.length === 0) return 'eprintln!()';
        const formatStr = args.map(() => '{}').join(' ');
        return `eprintln!("${formatStr}", ${args.join(', ')})`;
      },
      mutates: false,
      isStatement: true,
    },
    warn: {
      generateRust: (_obj, args) => {
        if (args.length === 0) return 'eprintln!("[WARN]")';
        const formatStr = args.map(() => '{}').join(' ');
        return `eprintln!("[WARN] ${formatStr}", ${args.join(', ')})`;
      },
      mutates: false,
      isStatement: true,
    },
    info: {
      generateRust: (_obj, args) => {
        if (args.length === 0) return 'println!("[INFO]")';
        const formatStr = args.map(() => '{}').join(' ');
        return `println!("[INFO] ${formatStr}", ${args.join(', ')})`;
      },
      mutates: false,
      isStatement: true,
    },
    debug: {
      generateRust: (_obj, args) => {
        if (args.length === 0) return 'println!("[DEBUG]")';
        const formatStr = args.map(() => '{}').join(' ');
        return `println!("[DEBUG] ${formatStr}", ${args.join(', ')})`;
      },
      mutates: false,
      isStatement: true,
    },
    assert: {
      generateRust: (_obj, args) => {
        if (args.length === 0) return 'assert!(false)';
        if (args.length === 1) return `assert!(${args[0]})`;
        return `assert!(${args[0]}, ${args.slice(1).join(', ')})`;
      },
      mutates: false,
      isStatement: true,
    },
    time: {
      generateRust: (_obj, args) => {
        // Rust doesn't have built-in console.time, we'll use a comment placeholder
        const label = args[0] || '"default"';
        return `// console.time(${label}) - timing not implemented`;
      },
      mutates: false,
      isStatement: true,
    },
    timeEnd: {
      generateRust: (_obj, args) => {
        const label = args[0] || '"default"';
        return `// console.timeEnd(${label}) - timing not implemented`;
      },
      mutates: false,
      isStatement: true,
    },
  },
};

// ============================================================================
// Array Method Builtins
// ============================================================================

export const arrayBuiltins: BuiltinNamespace = {
  methods: {
    // Mutating methods
    push: {
      generateRust: (obj, args) => `${obj}.push(${args[0]})`,
      mutates: true,
      isStatement: true,
    },
    pop: {
      generateRust: (obj) => `${obj}.pop().unwrap()`,
      mutates: true,
      isStatement: false,
      returnType: 'element',
    },
    shift: {
      generateRust: (obj) => `${obj}.remove(0)`,
      mutates: true,
      isStatement: false,
      returnType: 'element',
    },
    unshift: {
      generateRust: (obj, args) => `${obj}.insert(0, ${args[0]})`,
      mutates: true,
      isStatement: true,
    },
    splice: {
      generateRust: (obj, args) => {
        const start = args[0] || '0';
        const deleteCount = args[1];
        if (deleteCount && args.length === 2) {
          return `${obj}.drain(${start} as usize..(${start} as usize + ${deleteCount} as usize)).collect::<Vec<_>>()`;
        }
        if (args.length > 2) {
          // splice with insertion - complex, simplified version
          return `{ let _start = ${start} as usize; ${obj}.drain(_start.._start + ${deleteCount || '0'} as usize); /* insert items */ }`;
        }
        return `${obj}.drain(${start} as usize..).collect::<Vec<_>>()`;
      },
      mutates: true,
      isStatement: false,
      returnType: 'Vec',
    },
    reverse: {
      generateRust: (obj) => `${obj}.reverse()`,
      mutates: true,
      isStatement: true,
    },
    sort: {
      generateRust: (obj, args) => {
        if (args.length === 0) {
          // Default sort - works for types that implement Ord
          return `${obj}.sort_by(|a, b| a.partial_cmp(b).unwrap())`;
        }
        // With comparator - would need closure conversion
        return `${obj}.sort_by(|a, b| a.partial_cmp(b).unwrap()) /* custom comparator not fully supported */`;
      },
      mutates: true,
      isStatement: true,
    },
    fill: {
      generateRust: (obj, args) => {
        const value = args[0];
        if (args.length === 1) {
          return `${obj}.fill(${value})`;
        }
        // With start/end indices
        const start = args[1] || '0';
        const end = args[2] || `${obj}.len()`;
        return `${obj}[${start} as usize..${end} as usize].fill(${value})`;
      },
      mutates: true,
      isStatement: true,
    },
    copyWithin: {
      generateRust: (obj, args) => {
        return `${obj}.copy_within(${args[1] || '0'} as usize..${args[2] || `${obj}.len()`} as usize, ${args[0]} as usize)`;
      },
      mutates: true,
      isStatement: true,
    },

    // Non-mutating methods that return new arrays
    slice: {
      generateRust: (obj, args) => {
        if (args.length === 0) return `${obj}.clone()`;
        if (args.length === 1) return `${obj}[${args[0]} as usize..].to_vec()`;
        return `${obj}[${args[0]} as usize..${args[1]} as usize].to_vec()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Vec',
    },
    concat: {
      generateRust: (obj, args) => {
        if (args.length === 0) return `${obj}.clone()`;
        return `[${obj}.as_slice(), ${args.map(a => `${a}.as_slice()`).join(', ')}].concat()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Vec',
    },
    join: {
      generateRust: (obj, args) => {
        const sep = args[0] || '","';
        return `${obj}.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(${sep})`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    flat: {
      generateRust: (obj) => `${obj}.into_iter().flatten().collect::<Vec<_>>()`,
      mutates: false,
      isStatement: false,
      returnType: 'Vec',
    },

    // Search methods
    indexOf: {
      generateRust: (obj, args) => {
        return `${obj}.iter().position(|x| *x == ${args[0]}).map(|i| i as f64).unwrap_or(-1.0)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    lastIndexOf: {
      generateRust: (obj, args) => {
        return `${obj}.iter().rposition(|x| *x == ${args[0]}).map(|i| i as f64).unwrap_or(-1.0)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    includes: {
      generateRust: (obj, args) => `${obj}.contains(&${args[0]})`,
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    find: {
      generateRust: (obj, args) => {
        // args[0] should be a closure - simplified
        return `${obj}.iter().find(|&x| /* predicate */).cloned()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Option',
    },
    findIndex: {
      generateRust: (obj, args) => {
        return `${obj}.iter().position(|x| /* predicate */).map(|i| i as f64).unwrap_or(-1.0)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },

    // Iteration methods (these need special handling for closures)
    forEach: {
      generateRust: (obj, args) => {
        // Would need closure conversion
        return `${obj}.iter().for_each(|x| { /* callback */ })`;
      },
      mutates: false,
      isStatement: true,
    },
    map: {
      generateRust: (obj, args) => {
        return `${obj}.iter().map(|x| /* callback */).collect::<Vec<_>>()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Vec',
    },
    filter: {
      generateRust: (obj, args) => {
        return `${obj}.iter().filter(|x| /* predicate */).cloned().collect::<Vec<_>>()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Vec',
    },
    reduce: {
      generateRust: (obj, args) => {
        return `${obj}.iter().fold(${args[1] || '0.0'}, |acc, x| /* reducer */)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'element',
    },
    reduceRight: {
      generateRust: (obj, args) => {
        return `${obj}.iter().rev().fold(${args[1] || '0.0'}, |acc, x| /* reducer */)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'element',
    },
    every: {
      generateRust: (obj, args) => {
        return `${obj}.iter().all(|x| /* predicate */)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    some: {
      generateRust: (obj, args) => {
        return `${obj}.iter().any(|x| /* predicate */)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },

    // Property-like methods
    at: {
      generateRust: (obj: string | null, args: string[]) => {
        const idx = args[0];
        return `if ${idx} >= 0.0 { ${obj}.get(${idx} as usize).cloned() } else { ${obj}.get((${obj}.len() as f64 + ${idx}) as usize).cloned() }.unwrap()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'element',
    },
    
    // Conversion
    toString: {
      generateRust: (obj: string | null) => `format!("{:?}", ${obj})`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
  },
};

// ============================================================================
// String Method Builtins
// ============================================================================

export const stringBuiltins: BuiltinNamespace = {
  methods: {
    charAt: {
      generateRust: (obj, args) => `${obj}.chars().nth(${args[0]} as usize).map(|c| c.to_string()).unwrap_or_default()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    charCodeAt: {
      generateRust: (obj, args) => `${obj}.chars().nth(${args[0]} as usize).map(|c| c as u32 as f64).unwrap_or(f64::NAN)`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    concat: {
      generateRust: (obj, args) => `format!("{}{}", ${obj}, ${args.join(', ')})`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    includes: {
      generateRust: (obj, args) => `${obj}.contains(${args[0]}.as_str())`,
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    indexOf: {
      generateRust: (obj, args) => `${obj}.find(${args[0]}.as_str()).map(|i| i as f64).unwrap_or(-1.0)`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    lastIndexOf: {
      generateRust: (obj, args) => `${obj}.rfind(${args[0]}.as_str()).map(|i| i as f64).unwrap_or(-1.0)`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    slice: {
      generateRust: (obj, args) => {
        if (args.length === 1) return `${obj}[${args[0]} as usize..].to_string()`;
        return `${obj}[${args[0]} as usize..${args[1]} as usize].to_string()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    substring: {
      generateRust: (obj, args) => {
        if (args.length === 1) return `${obj}[${args[0]} as usize..].to_string()`;
        return `${obj}[${args[0]} as usize..${args[1]} as usize].to_string()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    toLowerCase: {
      generateRust: (obj) => `${obj}.to_lowercase()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    toUpperCase: {
      generateRust: (obj) => `${obj}.to_uppercase()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    trim: {
      generateRust: (obj) => `${obj}.trim().to_string()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    trimStart: {
      generateRust: (obj) => `${obj}.trim_start().to_string()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    trimEnd: {
      generateRust: (obj) => `${obj}.trim_end().to_string()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    split: {
      generateRust: (obj, args) => {
        const sep = args[0] || '""';
        return `${obj}.split(${sep}.as_str()).map(|s| s.to_string()).collect::<Vec<String>>()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Vec<String>',
    },
    replace: {
      generateRust: (obj, args) => `${obj}.replacen(${args[0]}.as_str(), ${args[1]}.as_str(), 1)`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    replaceAll: {
      generateRust: (obj, args) => `${obj}.replace(${args[0]}.as_str(), ${args[1]}.as_str())`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    repeat: {
      generateRust: (obj, args) => `${obj}.repeat(${args[0]} as usize)`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    startsWith: {
      generateRust: (obj, args) => `${obj}.starts_with(${args[0]}.as_str())`,
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    endsWith: {
      generateRust: (obj, args) => `${obj}.ends_with(${args[0]}.as_str())`,
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    padStart: {
      generateRust: (obj, args) => {
        const len = args[0];
        const fill = args[1] || '" "';
        return `format!("{:>width$}", ${obj}, width = ${len} as usize)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    padEnd: {
      generateRust: (obj, args) => {
        const len = args[0];
        return `format!("{:<width$}", ${obj}, width = ${len} as usize)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    toString: {
      generateRust: (obj: string | null) => `${obj}.clone()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
  },
};

// ============================================================================
// Number/Math Builtins
// ============================================================================

export const mathBuiltins: BuiltinNamespace = {
  methods: {
    abs: {
      generateRust: (_obj, args) => `(${args[0]}).abs()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    floor: {
      generateRust: (_obj, args) => `(${args[0]}).floor()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    ceil: {
      generateRust: (_obj, args) => `(${args[0]}).ceil()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    round: {
      generateRust: (_obj, args) => `(${args[0]}).round()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    trunc: {
      generateRust: (_obj, args) => `(${args[0]}).trunc()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    sqrt: {
      generateRust: (_obj, args) => `(${args[0]}).sqrt()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    pow: {
      generateRust: (_obj, args) => `(${args[0]}).powf(${args[1]})`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    min: {
      generateRust: (_obj, args) => {
        if (args.length === 2) return `(${args[0]}).min(${args[1]})`;
        return `[${args.join(', ')}].iter().cloned().fold(f64::INFINITY, f64::min)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    max: {
      generateRust: (_obj, args) => {
        if (args.length === 2) return `(${args[0]}).max(${args[1]})`;
        return `[${args.join(', ')}].iter().cloned().fold(f64::NEG_INFINITY, f64::max)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    sin: {
      generateRust: (_obj, args) => `(${args[0]}).sin()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    cos: {
      generateRust: (_obj, args) => `(${args[0]}).cos()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    tan: {
      generateRust: (_obj, args) => `(${args[0]}).tan()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    log: {
      generateRust: (_obj, args) => `(${args[0]}).ln()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    log10: {
      generateRust: (_obj, args) => `(${args[0]}).log10()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    exp: {
      generateRust: (_obj, args) => `(${args[0]}).exp()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    random: {
      generateRust: (_obj: string | null, _args: string[]) => `rand::random::<f64>()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
  },
};

// ============================================================================
// Builtin Registry - Central lookup
// ============================================================================

export const builtinRegistry: Record<string, BuiltinNamespace> = {
  console: consoleBuiltins,
  Array: arrayBuiltins,
  String: stringBuiltins,
  Math: mathBuiltins,
};

/**
 * Look up a method handler for a given namespace and method name
 */
export function getBuiltinMethod(
  namespace: string,
  method: string
): BuiltinMethodHandler | undefined {
  return builtinRegistry[namespace]?.methods[method];
}

/**
 * Check if a namespace exists in builtins
 */
export function isBuiltinNamespace(name: string): boolean {
  return name in builtinRegistry;
}

/**
 * Get array method handler
 */
export function getArrayMethod(method: string): BuiltinMethodHandler | undefined {
  return arrayBuiltins.methods[method];
}

/**
 * Get string method handler
 */
export function getStringMethod(method: string): BuiltinMethodHandler | undefined {
  return stringBuiltins.methods[method];
}
