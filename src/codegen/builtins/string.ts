// String Builtins - String/&str methods

import type { BuiltinNamespace } from './types.ts';

export const stringBuiltins: BuiltinNamespace = {
  methods: {
    charAt: {
      generateRust: (obj, args) =>
        `${obj}.chars().nth(${args[0]} as usize).map(|c| c.to_string()).unwrap_or_default()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    charCodeAt: {
      generateRust: (obj, args) =>
        `${obj}.chars().nth(${args[0]} as usize).map(|c| c as u32 as f64).unwrap_or(f64::NAN)`,
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
      generateRust: (obj, args) => `${obj}.contains(${args[0]})`,
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    indexOf: {
      generateRust: (obj, args) =>
        `${obj}.find(${args[0]}).map(|i| i as i32).unwrap_or(-1)`,
      mutates: false,
      isStatement: false,
      returnType: 'i32',
    },
    lastIndexOf: {
      generateRust: (obj, args) =>
        `${obj}.rfind(${args[0]}).map(|i| i as i32).unwrap_or(-1)`,
      mutates: false,
      isStatement: false,
      returnType: 'i32',
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
        return `${obj}.split(${sep}).map(|s| s.to_string()).collect::<Vec<String>>()`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'Vec<String>',
    },
    replace: {
      generateRust: (obj, args) => `${obj}.replacen(${args[0]}, ${args[1]}, 1)`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    replaceAll: {
      generateRust: (obj, args) => `${obj}.replace(${args[0]}, ${args[1]})`,
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
      generateRust: (obj, args) => `${obj}.starts_with(${args[0]})`,
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    endsWith: {
      generateRust: (obj, args) => `${obj}.ends_with(${args[0]})`,
      mutates: false,
      isStatement: false,
      returnType: 'bool',
    },
    padStart: {
      generateRust: (obj, args) => {
        const len = args[0];
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
      generateRust: (obj: string | null) => `${obj}.to_string()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    length: {
      // This is actually a property, but we handle it as a method for consistency
      generateRust: (obj) => `${obj}.len()`,
      mutates: false,
      isStatement: false,
      returnType: 'usize',
    },
  },
};
