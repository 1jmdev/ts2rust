// Array Builtins - Vec<T> methods

import type { BuiltinNamespace } from './types.ts';

export const arrayBuiltins: BuiltinNamespace = {
  methods: {
    // ========================================================================
    // Mutating methods
    // ========================================================================
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
          return `${obj}.sort_by(|a, b| a.partial_cmp(b).unwrap())`;
        }
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

    // ========================================================================
    // Non-mutating methods that return new arrays
    // ========================================================================
    slice: {
      generateRust: (obj, args, rawArgs) => {
        if (args.length === 0) return `${obj}.clone()`;
        const arg0IsLiteral = rawArgs[0]?.kind === 'literal' &&
          typeof rawArgs[0].value === 'number' &&
          Number.isInteger(rawArgs[0].value);
        const arg1IsLiteral = rawArgs[1]?.kind === 'literal' &&
          typeof rawArgs[1].value === 'number' &&
          Number.isInteger(rawArgs[1].value);

        if (args.length === 1) {
          return arg0IsLiteral
            ? `${obj}[${args[0]}..].to_vec()`
            : `${obj}[${args[0]} as usize..].to_vec()`;
        }
        const start = arg0IsLiteral ? args[0] : `${args[0]} as usize`;
        const end = arg1IsLiteral ? args[1] : `${args[1]} as usize`;
        return `${obj}[${start}..${end}].to_vec()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Vec',
    },
    concat: {
      generateRust: (obj, args) => {
        if (args.length === 0) return `${obj}.clone()`;
        return `[${obj}.as_slice(), ${args.map((a) => `${a}.as_slice()`).join(', ')}].concat()`;
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

    // ========================================================================
    // Search methods
    // ========================================================================
    indexOf: {
      generateRust: (obj, args) => {
        return `${obj}.iter().position(|x| *x == ${args[0]}).map(|i| i as i32).unwrap_or(-1)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'i32',
    },
    lastIndexOf: {
      generateRust: (obj, args) => {
        return `${obj}.iter().rposition(|x| *x == ${args[0]}).map(|i| i as i32).unwrap_or(-1)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'i32',
    },
    includes: {
      generateRust: (obj, args) => `${obj}.contains(&${args[0]})`,
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    find: {
      generateRust: (obj) => {
        return `${obj}.iter().find(|&x| /* predicate */).cloned()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Option',
    },
    findIndex: {
      generateRust: (obj) => {
        return `${obj}.iter().position(|x| /* predicate */).map(|i| i as i32).unwrap_or(-1)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'i32',
    },

    // ========================================================================
    // Iteration methods (need closure conversion)
    // ========================================================================
    forEach: {
      generateRust: (obj) => {
        return `${obj}.iter().for_each(|x| { /* callback */ })`;
      },
      mutates: false,
      isStatement: true,
    },
    map: {
      generateRust: (obj) => {
        return `${obj}.iter().map(|x| /* callback */).collect::<Vec<_>>()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Vec',
    },
    filter: {
      generateRust: (obj) => {
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
      generateRust: (obj) => {
        return `${obj}.iter().all(|x| /* predicate */)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    some: {
      generateRust: (obj) => {
        return `${obj}.iter().any(|x| /* predicate */)`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },

    // ========================================================================
    // Property-like methods
    // ========================================================================
    at: {
      generateRust: (obj, args) => {
        const idx = args[0];
        return `if ${idx} >= 0.0 { ${obj}.get(${idx} as usize).cloned() } else { ${obj}.get((${obj}.len() as f64 + ${idx}) as usize).cloned() }.unwrap()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'element',
    },

    // ========================================================================
    // Conversion
    // ========================================================================
    toString: {
      generateRust: (obj: string | null) => `format!("{:?}", ${obj})`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
  },
};
