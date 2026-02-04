// Example: Top-level statements (no explicit main function)
// These should be automatically wrapped in a main function in Rust

interface Point {
  x: number;
  y: number;
}

function add(a: number, b: number): number {
  return a + b;
}

function createPoint(x: number, y: number): Point {
  return { x: x, y: y };
}

// Top-level executable code - should go into main()
const greeting: string = "Hello from top-level!";
console.log(greeting);

const result: number = add(10, 20);
console.log("10 + 20 =", result);

const p: Point = createPoint(5, 10);
console.log("Point:", p.x, p.y);

let counter: number = 0;
while (counter < 3) {
  console.log("Counter:", counter);
  counter = counter + 1;
}

console.log("Done!");
