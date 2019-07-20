/**
 * Fisher-Yates array
 * 
 * Order the element pseudorandomly
 * 
 * Exposes a method `take`, which returns n elements from the
 * shuffled array, clamped to the length of the array.
 * 
 * Once the entire array has been sampled, take will return 0 items
 **/
class ShuffledList extends Array {
  // built-in methods will use this as the constructor
  static get [Symbol.species]() {
    return Array;
  }

  constructor(elements) {
    super(...elements);
    this.shuffle();
  }

  shuffle() {
    this.samplePointer = 0;

    for (let i = this.length - 1; i > 0; i--) {
      const max = i + 1;
      // get a random (non-inclusive) index between
      // the current index and 0
      const j = (Math.random() * max) | 0;
      
      // swap the current and random indicies
      [ this[i], this[j] ] = [ this[j], this[i] ];
    }
  }

  isSampleOutOfBounds(nextPointer) {
    return nextPointer >= this.length;
  }

  reset() {
    this.shuffle();
  }

  // once we've taken every item, dont let the user take more? is this correct?
  take(n) {
    const nextSamplePointer = n + this.samplePointer;
    let selected;

    if (this.isSampleOutOfBounds(nextSamplePointer)) {
      // clamp the number of elements to take
      selected = this.slice(this.samplePointer, this.length);
      this.samplePointer = this.length;
    } else {
      selected = this.slice(this.samplePointer, nextSamplePointer);
      this.samplePointer = nextSamplePointer;
    }

    return selected;
  }  

  // Generate a new shuffled list from the existing list, and take the first element
  // TODO: still want a clean way to sample each element once
  takeRandom() {
    return new ShuffledList(this.slice()).take(1)[0];
  }
}

export default ShuffledList;
