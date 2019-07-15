import chroma from 'chroma-js';

// Generate a palette from an array of colors
const makePalette = ({ colors = [], paletteSize = 6 }) => {
  return chroma.bezier(colors).scale().colors(paletteSize);
};

export default makePalette;
