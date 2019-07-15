import { getRandomBetween } from './utils';

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

    // Only used to keep track of what elements were selected
    // via the `takeRandom` method. Would like to find a cleaner
    // way to add this functionality
    this.selected = {};

    this.samplePointer = 0;

    this.shuffle();
  }

  shuffle() {
    this.samplePointer = 0;

    for (let i = this.length - 1; i > 0; i--) {
      const max = i + 1;
      // get a random (non-inclusive) index between
      // the current index and 0
      const j = Math.floor(Math.random() * max);
      
      // swap the current and random indicies
      [ this[i], this[j] ] = [ this[j], this[i] ];
    }
  }

  isSampleOutOfBounds(nextPointer) {
    return nextPointer >= this.length;
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

  // love to do this without this goofy while loop
  takeRandom() {
    let nextIndex;

    if (Object.keys(this.selected).length !== this.length) {
      nextIndex = getRandomBetween(0, this.length);

      while (this.selected[nextIndex]) {
        nextIndex = getRandomBetween(0, this.length);
      }
    
      this.selected[nextIndex] = true;
    } else {
      this.selected = {}
      nextIndex = getRandomBetween(0, this.length);
    }


    return this[nextIndex];
  }
}

export default ShuffledList;
