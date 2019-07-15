import SVG from 'svg.js';
import 'svg.easing.js';
import 'svg.filter.js';

SVG.Hexagon = SVG.invent({
  inherit: SVG.Shape,
  create(corners) {
    return new SVG.Defs()
      .polygon(corners.map(({ x, y }) => `${x},${y}`))
      .fill({ color: "#fff", opacity: 0.1 });
  },
  construct: {
    hexagon(x, y, corners) {
      return this.put(new SVG.Hexagon(corners)).translate(x, y);
    }
  }
});

SVG.HexagonGroup = SVG.invent({
  inherit: SVG.G,
  create(grid) {
    const group = new SVG.G();

    grid.forEach(hex => {
      const { x, y } = hex.toPoint();
      // get the corners of the hexagon. they are all identical, and placed by their point coords
      const corners = hex.corners();

      group.add(this.hexagon(x, y, corners));
    });

    return group;
  },
  construct: {
    hexagonGroup(backingHexagons) {
      return this.put(new SVG.HexagonGroup(backingHexagons));
    }
  }
});

export default SVG;
