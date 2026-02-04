function sum(numbers: number[]): number {
    let total: number = 0;
    for (let i: number = 0; i < numbers.length; i++) {
        total = total + numbers[i];
    }
    return total;
}

function main(): void {
    const data: number[] = [1, 2, 3, 4, 5];
    console.log(sum(data));
}
