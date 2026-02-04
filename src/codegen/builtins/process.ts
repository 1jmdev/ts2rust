// Process Builtins - process.* methods and properties

import type { BuiltinNamespace } from './types.ts';

export const processBuiltins: BuiltinNamespace = {
  methods: {
    cwd: {
      generateRust: () => `std::env::current_dir().unwrap().to_string_lossy().to_string()`,
      mutates: false,
      isStatement: false,
      returnType: 'String',
    },
    exit: {
      generateRust: (_obj, args) => {
        const code = args[0] || '0';
        return `std::process::exit(${code})`;
      },
      mutates: false,
      isStatement: true,
    },
    uptime: {
      generateRust: () => {
        return `sysinfo::System::uptime() as f64`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    memoryUsage: {
      generateRust: () => {
        return `{
  let mut sys = sysinfo::System::new();
  sys.refresh_memory();
  sys.total_memory() as f64
}`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    hrtime: {
      generateRust: () => {
        return `{
  let start = std::time::Instant::now();
  let elapsed = start.elapsed().as_nanos() as f64 / 1e9;
  elapsed
}`;
      },
      mutates: false,
      isStatement: false,
      returnType: 'f64',
    },
    nextTick: {
      generateRust: (_obj, args) => {
        const callback = args[0] || '|| {}';
        return `${callback}()`;
      },
      mutates: false,
      isStatement: true,
    },
  },
};

// Process constants - properties accessible on process
// These are detected at runtime where possible
export const processConstants: Record<string, { code: string; returnType: string }> = {
  pid: { code: 'std::process::id()', returnType: 'u32' },
  platform: { code: 'std::env::consts::OS', returnType: '&str' },
  arch: { code: 'std::env::consts::ARCH', returnType: '&str' },
  version: { code: 'format!("{}.{}.{}", env!("CARGO_PKG_VERSION_MAJOR"), env!("CARGO_PKG_VERSION_MINOR"), env!("CARGO_PKG_VERSION_PATCH"))', returnType: 'String' },
  versions: { code: 'format!(r#"{{"node":"{}.{}.{}"}}"#, env!("CARGO_PKG_VERSION_MAJOR"), env!("CARGO_PKG_VERSION_MINOR"), env!("CARGO_PKG_VERSION_PATCH"))', returnType: 'String' },
  release: { code: 'format!("{}.{}.{}", env!("CARGO_PKG_VERSION_MAJOR"), env!("CARGO_PKG_VERSION_MINOR"), env!("CARGO_PKG_VERSION_PATCH"))', returnType: 'String' },
  title: { code: 'std::env::current_exe().unwrap().file_name().unwrap().to_string_lossy().to_string()', returnType: 'String' },
  env: { code: '&std::env::vars().collect::<Vec<_>>()', returnType: '&Vec<(String, String)>' },
  argv: { code: '&std::env::args().collect::<Vec<_>>()', returnType: '&Vec<String>' },
  execPath: { code: 'std::env::current_exe().unwrap().to_string_lossy().to_string()', returnType: 'String' },
  execArgv: { code: '&[]', returnType: '&[String]' },
  stdout: { code: '&std::io::stdout()', returnType: '&std::io::Stdout' },
  stderr: { code: '&std::io::stderr()', returnType: '&std::io::Stderr' },
  stdin: { code: '&std::io::stdin()', returnType: '&std::io::Stdin' },
};
