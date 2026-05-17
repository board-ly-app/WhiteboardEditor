// === ClientColorStack.ts =====================================================
//
// Utility class for keeping track of the next available color to allocate for a
// client using a given whiteboard.
//
// =============================================================================

class ClientColorStack {
  #colors : string[];
  #proceduralRGB: [number, number, number];

  constructor(startingColors: string[], proceduralRGB: [number, number, number]) {
    this.#colors = [...startingColors];
    // -- to ensure that first color listed is first color popped
    this.#colors.reverse();
    this.#proceduralRGB = [...proceduralRGB];
  }

  popColor(): string {
    const popped = this.#colors.pop();

    if (popped) {
      return popped;
    } else {
      const [r, g, b] = this.#proceduralRGB;
      this.#proceduralRGB = [b * 0.8, r, g];

      return `rgb(${b},${g},${b})`;
    }
  }// -- end popColor

  pushColor(color: string) {
    this.#colors.push(color);
  }// -- end pushColor
};

export {
  ClientColorStack
};
