// Math Builtins - Math.* methods

import type { BuiltinNamespace } from './types.ts';

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
    asin: {
      generateRust: (_obj, args) => `(${args[0]}).asin()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    acos: {
      generateRust: (_obj, args) => `(${args[0]}).acos()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    atan: {
      generateRust: (_obj, args) => `(${args[0]}).atan()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    atan2: {
      generateRust: (_obj, args) => `(${args[0]}).atan2(${args[1]})`,
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
    log2: {
      generateRust: (_obj, args) => `(${args[0]}).log2()`,
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
      generateRust: () => `rand::random::<f64>()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    sign: {
      generateRust: (_obj, args) => `(${args[0]}).signum()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    cbrt: {
      generateRust: (_obj, args) => `(${args[0]}).cbrt()`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    hypot: {
      generateRust: (_obj, args) => `(${args[0]}).hypot(${args[1]})`,
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
  },
};

// Math constants - can be used for property access on Math
export const mathConstants: Record<string, string> = {
  PI: 'std::f64::consts::PI',
  E: 'std::f64::consts::E',
  LN2: 'std::f64::consts::LN_2',
  LN10: 'std::f64::consts::LN_10',
  LOG2E: 'std::f64::consts::LOG2_E',
  LOG10E: 'std::f64::consts::LOG10_E',
  SQRT2: 'std::f64::consts::SQRT_2',
  SQRT1_2: 'std::f64::consts::FRAC_1_SQRT_2',
};
