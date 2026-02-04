// Example: Structs, Enums, and Property Access
// This demonstrates the new features of the transpiler

// ============================================================================
// Enum Declaration
// ============================================================================

enum Direction {
  North = 0,
  East = 1,
  South = 2,
  West = 3,
}

enum Status {
  Pending,
  Active,
  Completed,
  Failed,
}

// ============================================================================
// Interface/Struct Declaration
// ============================================================================

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  topLeft: Point;
  width: number;
  height: number;
}

interface Player {
  name: string;
  score: number;
  direction: Direction;
  position: Point;
}

// ============================================================================
// Functions using structs and enums
// ============================================================================

function createPoint(x: number, y: number): Point {
  const p: Point = { x: x, y: y };
  return p;
}

function movePoint(p: Point, dx: number, dy: number): Point {
  const result: Point = {
    x: p.x + dx,
    y: p.y + dy,
  };
  return result;
}

function getArea(rect: Rectangle): number {
  return rect.width * rect.height;
}

function turnRight(dir: Direction): Direction {
  if (dir === Direction.North) {
    return Direction.East;
  }
  if (dir === Direction.East) {
    return Direction.South;
  }
  if (dir === Direction.South) {
    return Direction.West;
  }
  return Direction.North;
}

function printPlayer(player: Player): void {
  console.log("Player:", player.name);
  console.log("Score:", player.score);
  console.log("Position:", player.position.x, player.position.y);
}

function updateScore(player: Player, points: number): Player {
  const updated: Player = {
    name: player.name,
    score: player.score + points,
    direction: player.direction,
    position: player.position,
  };
  return updated;
}

// ============================================================================
// Main function
// ============================================================================

function main(): void {
  // Create a point
  const origin: Point = createPoint(0, 0);
  const moved: Point = movePoint(origin, 10, 20);
  
  console.log("Moved point:", moved.x, moved.y);
  
  // Create a rectangle
  const rect: Rectangle = {
    topLeft: origin,
    width: 100,
    height: 50,
  };
  
  const area: number = getArea(rect);
  console.log("Rectangle area:", area);
  
  // Use enum
  let dir: Direction = Direction.North;
  dir = turnRight(dir);
  console.log("New direction:", dir);
  
  // Create a player
  const player: Player = {
    name: "Alice",
    score: 0,
    direction: Direction.North,
    position: origin,
  };
  
  printPlayer(player);
  
  const updatedPlayer: Player = updateScore(player, 100);
  console.log("Updated score:", updatedPlayer.score);
}
