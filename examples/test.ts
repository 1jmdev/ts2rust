// 1. Array of objects
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
console.table(users);
