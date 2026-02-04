// Comprehensive test of all features

// Test all console methods
function testConsole(): void {
    console.log("Testing console.log");
    console.error("Testing console.error");
    console.warn("Testing console.warn");
    console.info("Testing console.info");
    console.debug("Testing console.debug");
    console.log("Multiple", "arguments", "work");
}

// Test array methods
function testArrayMethods(): void {
    let arr: number[] = [1, 2, 3, 4, 5];
    
    // Mutating methods
    arr.push(6);
    console.log("After push:", arr.length);
    
    arr.reverse();
    console.log("After reverse, first element:", arr[0]);
    
    // Non-mutating methods
    const sliced: number[] = arr.slice(1, 3);
    console.log("Sliced length:", sliced.length);
    
    // Search methods
    const idx: number = arr.indexOf(3);
    console.log("Index of 3:", idx);
    
    const hasTwo: boolean = arr.includes(2);
    console.log("Includes 2:", hasTwo);
}

// Test switch statement
function testSwitch(value: number): string {
    let result: string = "";
    
    switch (value) {
        case 1:
            result = "one";
            break;
        case 2:
            result = "two";
            break;
        case 3:
            result = "three";
            break;
        default:
            result = "unknown";
            break;
    }
    
    return result;
}

// Test string methods
function testStringMethods(): void {
    const str: string = "Hello, World!";
    
    const upper: string = str.toUpperCase();
    console.log("Upper:", upper);
    
    const lower: string = str.toLowerCase();
    console.log("Lower:", lower);
    
    const trimmed: string = "  spaces  ".trim();
    console.log("Trimmed:", trimmed);
    
    const hasHello: boolean = str.includes("Hello");
    console.log("Has Hello:", hasHello);
    
    const replaced: string = str.replace("World", "Rust");
    console.log("Replaced:", replaced);
}

// Main function
function main(): void {
    console.log("=== Console Tests ===");
    testConsole();
    
    console.log("=== Array Tests ===");
    testArrayMethods();
    
    console.log("=== Switch Tests ===");
    console.log("Switch 1:", testSwitch(1));
    console.log("Switch 2:", testSwitch(2));
    console.log("Switch 99:", testSwitch(99));
    
    console.log("=== String Tests ===");
    testStringMethods();
    
    console.log("=== All tests complete! ===");
}
