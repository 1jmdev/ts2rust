function fizzbuzz(n: number): void {
    let i: number = 1;
    while (i <= n) {
        if (i % 15 === 0) {
            console.log("FizzBuzz");
        } else if (i % 3 === 0) {
            console.log("Fizz");
        } else if (i % 5 === 0) {
            console.log("Buzz");
        } else {
            console.log(i);
        }
        i = i + 1;
    }
}

function main(): void {
    fizzbuzz(20);
}
