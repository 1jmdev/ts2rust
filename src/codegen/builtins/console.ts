// Console Builtins - console.log, console.error, etc.

import type { BuiltinNamespace } from './types.ts';
import { buildPrintln } from './types.ts';

export const consoleBuiltins: BuiltinNamespace = {
  methods: {
    log: {
      generateRust: (_obj, args, rawArgs) => buildPrintln('println', '', args, rawArgs),
      mutates: false,
      isStatement: true,
    },
    error: {
      generateRust: (_obj, args, rawArgs) => buildPrintln('eprintln', '', args, rawArgs),
      mutates: false,
      isStatement: true,
    },
    warn: {
      generateRust: (_obj, args, rawArgs) => buildPrintln('eprintln', '[WARN]', args, rawArgs),
      mutates: false,
      isStatement: true,
    },
    info: {
      generateRust: (_obj, args, rawArgs) => buildPrintln('println', '[INFO]', args, rawArgs),
      mutates: false,
      isStatement: true,
    },
    debug: {
      generateRust: (_obj, args, rawArgs) => buildPrintln('println', '[DEBUG]', args, rawArgs),
      mutates: false,
      isStatement: true,
    },
    table: {
      generateRust: (_obj, args) => {
        if (args.length === 0) return 'println!("[TABLE] (empty)")';
        // Generate table display function call
        return `console_table(&${args[0]});`;
      },
      mutates: false,
      isStatement: true,
    },
    clear: {
      generateRust: () => {
        return 'console_clear();';
      },
      mutates: false,
      isStatement: true,
    },
    trace: {
      generateRust: (_obj, args) => {
        const message = args.length > 0 ? args[0] : '"Trace"';
        return `println!("Stack trace: {} (backtrace not available)", ${message});`;
      },
      mutates: false,
      isStatement: true,
    },
    dir: {
      generateRust: (_obj, args) => {
        if (args.length === 0) return 'println!("[DIR] (no arguments)")';
        return `println!("[DIR] {:#?}", ${args[0]});`;
      },
      mutates: false,
      isStatement: true,
    },
    group: {
      generateRust: (_obj, args) => {
        const label = args.length > 0 ? args[0] : '"Group"';
        return `println!("\\n=== {} ===", ${label});`;
      },
      mutates: false,
      isStatement: true,
    },
    groupCollapsed: {
      generateRust: (_obj, args) => {
        const label = args.length > 0 ? args[0] : '"Group"';
        return `println!("\\n=== [Collapsed] {} ===", ${label});`;
      },
      mutates: false,
      isStatement: true,
    },
    groupEnd: {
      generateRust: () => {
        return 'println!("=== End Group ===\\n");';
      },
      mutates: false,
      isStatement: true,
    },
    count: {
      generateRust: (_obj, args) => {
        const label = args[0] ?? '"default"';
        // Handle string literals properly - they should remain quoted
        if (label.startsWith('"') && label.endsWith('"')) {
          return `console_count(${label});`;
        }
        // For non-string expressions, wrap in quotes
        return `console_count(&${label});`;
      },
      mutates: false,
      isStatement: true,
    },
    countReset: {
      generateRust: (_obj, args) => {
        const label = args[0] ?? '"default"';
        // Handle string literals properly - they should remain quoted
        if (label.startsWith('"') && label.endsWith('"')) {
          return `console_count_reset(${label});`;
        }
        // For non-string expressions, wrap in quotes
        return `console_count_reset(&${label});`;
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
        const label = args[0] ?? '"default"';
        // Handle string literals properly - they should remain quoted
        if (label.startsWith('"') && label.endsWith('"')) {
          return `console_time_start(${label});`;
        }
        // For non-string expressions, wrap in quotes
        return `console_time_start(&${label});`;
      },
      mutates: false,
      isStatement: true,
    },
    timeEnd: {
      generateRust: (_obj, args) => {
        const label = args[0] ?? '"default"';
        // Handle string literals properly - they should remain quoted
        if (label.startsWith('"') && label.endsWith('"')) {
          return `console_time_end(${label});`;
        }
        // For non-string expressions, wrap in quotes
        return `console_time_end(&${label});`;
      },
      mutates: false,
      isStatement: true,
    },
  },
};
