// Test process builtins

console.log("Process PID:", process.pid);
console.log("Platform:", process.platform);
console.log("Arch:", process.arch);
console.log("Version:", process.version);
console.log("CWD:", process.cwd());

const up = process.uptime();
console.log("Uptime:", up);

const mem = process.memoryUsage();
console.log("Memory usage:", mem);

console.log("Title:", process.title);
console.log("Release:", process.release);
console.log("Versions:", process.versions);
console.log("ExecPath:", process.execPath);

// process.exit(0);
