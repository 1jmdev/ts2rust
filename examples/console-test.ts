// Test console methods
interface User {
  id: number;
  name: string;
  role: string;
  active: boolean;
}

const users: User[] = [
  { id: 1, name: "Alice", role: "admin", active: true },
  { id: 2, name: "Bob", role: "user", active: false },
  { id: 3, name: "Carol", role: "user", active: true },
];

console.clear();
console.table(users);
console.log("Simple log message");
console.error("Error message");
console.warn("Warning message");
console.info("Info message");
console.debug("Debug message");
console.trace("This is a trace");
console.dir(users);
console.group("Test Group");
console.log("Inside group");
console.groupCollapsed("Collapsed Group");
console.log("Inside collapsed group");
console.groupEnd();
console.count("counter");
console.count("counter");
console.countReset("counter");
console.assert(true, "This should pass");
// console.assert(false, "This should fail"); // Commented out - this should fail
console.time("test-timer");
console.log("Doing some work...");
// Simulate some work
let sum: number = 0;
for (let i: number = 0; i < 1000000000; i++) {
  sum += i;
}
console.timeEnd("test-timer");
