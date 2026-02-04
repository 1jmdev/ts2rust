function main(): void {
    const someString: string = "this is some string";
    console.log(someString.length);

    const someArray: string[] = ["a", "b", "c"];

    if (someArray.length > 2) {
        console.log(someArray.length, "is larger than 2")
    } else {
        console.log(someArray.length, "is smaller or equal 2")
    }
}
