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
