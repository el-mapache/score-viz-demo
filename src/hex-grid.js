import * as honeycomb from 'honeycomb-grid';

const createHexagonGrid = () => {
  // create a hexagon factory
  const Hex = honeycomb.extendHex({ size: 20 });
  const Grid = honeycomb.defineGrid(Hex);

  // in-memory representation of a grid of hexagons, from which the
  // concrete hex grid will be rendered
  return Grid.rectangle({ width: 200, height: 200 });
}


export default createHexagonGrid;
