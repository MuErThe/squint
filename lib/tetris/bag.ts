import type { PieceType } from "./types";

const ALL: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

export class SevenBag {
  private bag: PieceType[] = [];

  next(): PieceType {
    if (this.bag.length === 0) this.refill();
    return this.bag.pop()!;
  }

  private refill(): void {
    this.bag = [...ALL];
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }
}
