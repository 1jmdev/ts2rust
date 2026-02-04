#!/usr/bin/env bun
// CLI Entry Point for ts2rust transpiler

import { Project } from 'ts-morph';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve, relative } from 'node:path';

/**
 * Convert an absolute path to a relative path from cwd, for cleaner output
 */
function toRelativePath(absolutePath: string): string {
  const rel = relative(process.cwd(), absolutePath);
  // If the relative path would go up many directories, just use absolute
  if (rel.startsWith('..') && rel.split('/').filter(p => p === '..').length > 2) {
    return absolutePath;
  }
  return rel || '.';
}

import { validate, formatErrors } from './validator.ts';
import { parse } from './parser.ts';
import { generate } from './rustgen.ts';

const CARGO_TEMPLATE = `[package]
name = "{{name}}"
version = "0.1.0"
edition = "2021"

[profile.release]
opt-level = 3
lto = true
`;

interface ParsedArgs {
  positional: string[];
  outdir?: string;
  skipInstall: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    positional: [],
    skipInstall: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--outdir=')) {
      result.outdir = arg.slice('--outdir='.length);
    } else if (arg === '--skipinstall') {
      result.skipInstall = true;
    } else if (!arg.startsWith('-')) {
      result.positional.push(arg);
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
ts2rust - TypeScript to Rust transpiler

Usage:
  bun src/cli.ts rust <input.ts> <output.rs>      Transpile to Rust source
  bun src/cli.ts build <input.ts> <output>        Transpile + compile to binary
  bun src/cli.ts check <input.ts>                 Validate TypeScript subset
  bun src/cli.ts project <input.ts> --outdir=DIR  Generate full Cargo project

Options:
  --help, -h       Show this help message
  --outdir=DIR     Output directory for project command
  --skipinstall    Skip cargo fetch/build (project command only)

Examples:
  bun src/cli.ts project app.ts --outdir=myproject
  bun src/cli.ts project app.ts --outdir=myproject --skipinstall
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const parsedArgs = parseArgs(args.slice(1));

  switch (command) {
    case 'rust':
      await handleRust(parsedArgs);
      break;
    case 'build':
      await handleBuild(parsedArgs);
      break;
    case 'check':
      await handleCheck(parsedArgs);
      break;
    case 'project':
      await handleProject(parsedArgs);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

async function loadAndValidate(inputPath: string): Promise<{ project: Project; valid: boolean }> {
  const absolutePath = resolve(inputPath);

  if (!existsSync(absolutePath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const project = new Project({
    compilerOptions: {
      strict: true,
    },
  });

  const sourceFile = project.addSourceFileAtPath(absolutePath);

  // Validate
  const result = validate(sourceFile);

  if (!result.valid) {
    console.error(formatErrors(result.errors, inputPath));
    return { project, valid: false };
  }

  return { project, valid: true };
}

async function handleCheck(args: ParsedArgs): Promise<void> {
  if (args.positional.length < 1) {
    console.error('Error: Missing input file');
    console.error('Usage: bun src/cli.ts check <input.ts>');
    process.exit(1);
  }

  const inputPath = args.positional[0]!;
  const { valid } = await loadAndValidate(inputPath);

  if (valid) {
    console.log(`✓ ${inputPath} is valid`);
    process.exit(0);
  } else {
    process.exit(1);
  }
}

async function handleRust(args: ParsedArgs): Promise<void> {
  if (args.positional.length < 2) {
    console.error('Error: Missing input or output file');
    console.error('Usage: bun src/cli.ts rust <input.ts> <output.rs>');
    process.exit(1);
  }

  const inputPath = args.positional[0]!;
  const outputPath = args.positional[1]!;

  const { project, valid } = await loadAndValidate(inputPath);

  if (!valid) {
    process.exit(1);
  }

  const sourceFile = project.getSourceFiles()[0]!;

  // Parse to IR
  const ir = parse(sourceFile);

  // Generate Rust
  let rustCode = generate(ir);

  // Format with rustfmt if available
  rustCode = await formatRustCode(rustCode);

  // Write output
  const outputDir = dirname(outputPath);
  if (outputDir && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  await Bun.write(outputPath, rustCode);
  console.log(`✓ Generated ${outputPath}`);
}

async function handleBuild(args: ParsedArgs): Promise<void> {
  if (args.positional.length < 2) {
    console.error('Error: Missing input or output file');
    console.error('Usage: bun src/cli.ts build <input.ts> <output>');
    process.exit(1);
  }

  const inputPath = args.positional[0]!;
  const outputPath = args.positional[1]!;

  const { project, valid } = await loadAndValidate(inputPath);

  if (!valid) {
    process.exit(1);
  }

  const sourceFile = project.getSourceFiles()[0]!;

  // Parse to IR
  const ir = parse(sourceFile);

  // Generate Rust
  let rustCode = generate(ir);

  // Format with rustfmt if available
  rustCode = await formatRustCode(rustCode);

  // Create temp directory for Cargo project
  const tempDir = join(dirname(resolve(outputPath)), '.ts2rust-build');
  const srcDir = join(tempDir, 'src');

  // Clean up any previous build
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }

  mkdirSync(srcDir, { recursive: true });

  // Determine project name from output path
  const projectName = basename(outputPath).replace(/[^a-zA-Z0-9_]/g, '_');

  // Write Cargo.toml
  const cargoToml = CARGO_TEMPLATE.replace('{{name}}', projectName);
  await Bun.write(join(tempDir, 'Cargo.toml'), cargoToml);

  // Write main.rs
  await Bun.write(join(srcDir, 'main.rs'), rustCode);

  console.log('Compiling with Cargo...');

  // Run cargo build
  const buildProc = Bun.spawn(['cargo', 'build', '--release'], {
    cwd: tempDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    new Response(buildProc.stdout).text(),
    new Response(buildProc.stderr).text(),
  ]);

  const exitCode = await buildProc.exited;

  if (exitCode !== 0) {
    console.error('Cargo build failed:');
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    process.exit(1);
  }

  // Copy binary to output path
  const binaryName = process.platform === 'win32' ? `${projectName}.exe` : projectName;
  const binaryPath = join(tempDir, 'target', 'release', binaryName);

  const outputDir = dirname(resolve(outputPath));
  if (outputDir && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Copy binary
  const binaryContent = await Bun.file(binaryPath).arrayBuffer();
  await Bun.write(outputPath, binaryContent);

  // Make executable on Unix
  if (process.platform !== 'win32') {
    const chmodProc = Bun.spawn(['chmod', '+x', outputPath]);
    await chmodProc.exited;
  }

  // Clean up temp directory
  rmSync(tempDir, { recursive: true });

  console.log(`✓ Built ${outputPath}`);
}

async function handleProject(args: ParsedArgs): Promise<void> {
  if (args.positional.length < 1) {
    console.error('Error: Missing input file');
    console.error('Usage: bun src/cli.ts project <input.ts> --outdir=DIR');
    process.exit(1);
  }

  if (!args.outdir) {
    console.error('Error: Missing --outdir flag');
    console.error('Usage: bun src/cli.ts project <input.ts> --outdir=DIR');
    process.exit(1);
  }

  const inputPath = args.positional[0]!;
  const outDir = resolve(args.outdir);

  const { project, valid } = await loadAndValidate(inputPath);

  if (!valid) {
    process.exit(1);
  }

  const sourceFile = project.getSourceFiles()[0]!;

  // Parse to IR
  const ir = parse(sourceFile);

  // Generate Rust
  let rustCode = generate(ir);

  // Format with rustfmt if available
  rustCode = await formatRustCode(rustCode);

  // Create project directory structure
  const srcDir = join(outDir, 'src');

  if (existsSync(outDir)) {
    // Check if it's not empty and warn
    const files = await Bun.file(outDir).exists();
    console.log(`Note: Output directory ${outDir} already exists, files may be overwritten`);
  }

  mkdirSync(srcDir, { recursive: true });

  // Determine project name from directory
  const projectName = basename(outDir).replace(/[^a-zA-Z0-9_]/g, '_');

  // Write Cargo.toml
  const cargoToml = CARGO_TEMPLATE.replace('{{name}}', projectName);
  await Bun.write(join(outDir, 'Cargo.toml'), cargoToml);

  // Write main.rs
  await Bun.write(join(srcDir, 'main.rs'), rustCode);

  // Write .gitignore for Rust project
  const gitignore = `/target/
Cargo.lock
`;
  await Bun.write(join(outDir, '.gitignore'), gitignore);

  const relOutDir = toRelativePath(outDir);
  const relSrcDir = toRelativePath(srcDir);

  console.log(`✓ Generated Cargo project at ${relOutDir}`);
  console.log(`  - ${toRelativePath(join(outDir, 'Cargo.toml'))}`);
  console.log(`  - ${toRelativePath(join(srcDir, 'main.rs'))}`);
  console.log(`  - ${toRelativePath(join(outDir, '.gitignore'))}`);

  if (!args.skipInstall) {
    console.log('\nFetching dependencies with cargo fetch...');

    const fetchProc = Bun.spawn(['cargo', 'fetch'], {
      cwd: outDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const [stdout, stderr] = await Promise.all([
      new Response(fetchProc.stdout).text(),
      new Response(fetchProc.stderr).text(),
    ]);

    const exitCode = await fetchProc.exited;

    if (exitCode !== 0) {
      console.error('Warning: cargo fetch failed:');
      if (stderr) console.error(stderr);
    } else {
      console.log('✓ Dependencies fetched');
    }

    console.log('\nTo build and run:');
    console.log(`  cd ${relOutDir}`);
    console.log('  cargo run --release');
  } else {
    console.log('\nSkipped dependency installation (--skipinstall)');
    console.log('\nTo build and run:');
    console.log(`  cd ${relOutDir}`);
    console.log('  cargo run --release');
  }
}

async function formatRustCode(code: string): Promise<string> {
  try {
    const proc = Bun.spawn(['rustfmt'], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    proc.stdin.write(code);
    proc.stdin.end();

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    if (exitCode === 0) {
      return stdout;
    }

    // rustfmt failed, return original code
    console.warn('Warning: rustfmt failed, using unformatted code');
    return code;
  } catch {
    // rustfmt not available
    return code;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
