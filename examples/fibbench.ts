function generateFibonacci(limit: number): number[] {
    const fib: number[] = [];
    let a: number = 0;
    let b: number = 1;

    while (a <= limit) {
        fib.push(a);
        const temp: number = a + b;
        a = b;
        b = temp;
    }

    return fib;
}

function countAndPrintFibonacci(max: number): void {
    const fibonacciArray: number[] = generateFibonacci(max);

    for (let i: number = 1; i <= max; i++) {
        if (fibonacciArray.includes(i)) {
            console.log(i);
        }
    }
}

countAndPrintFibonacci(100_000_000);
