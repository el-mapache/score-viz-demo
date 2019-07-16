import './styles.css';
import { getImage } from './images';
import SVG from './svg';
import createHexagonGrid from './hex-grid';
import connect from './socket';
import ShuffledList from './shuffled-list';
import PriorityQueue from './priority-queue';
import makePalette from './palette';
import { centerElement, parseJSON } from './utils'

const buildFilter = ({ svg, id, type, attrs }) => {
  const filter = svg.element('filter').attr({ id });
  const fe = svg.element(type).attr(attrs);

  filter.node.appendChild(fe.node);

  return {
    attachTo(element)  {
      element.attr({ filter: `url(#${id})` });
    },
    removeFrom(element) {
      setTimeout(() => { element.attr({ filter: '' }) }, 155)
    }
  };
};

const IMG_SCALE_FACTOR = 1.25;
const appendChildren = (root, ...children) => {
  children.forEach(child => root.node.appendChild(child.node));
};

const perlin = (svg) => {
  const id = 'perlin';
  const turbAttrs = {
    baseFrequency: "1.8",
    numOctaves: "3",
    result: "noise",
    type: "turbulence"
  };
  const blendAttrs = {
    mode: 'multiply',
    in: 'finalFilter',
    in2: 'SourceGraphic'
  };
  const compositeAttrs = {
    operator: "arithmetic",
    in: "noise",
    result: "compose",
    k1: "0",
    k2: "0.5",
    k3: "0.1" 
  };
  const compose2Attrs = {
    operator: "in",
    in: "compose",
    in2: "SourceGraphic",
    result: "finalFilter"
  };

  const filter = svg.element('filter').attr({ id });
  const fe = svg.element('feTurbulence').attr(turbAttrs);
  const blend = svg.element('feBlend').attr(blendAttrs)
  const composite = svg.element('feComposite').attr(compositeAttrs)
  const composite2 = svg.element('feComposite').attr(compose2Attrs)
  appendChildren(filter, fe, composite, composite2, blend);

  return (element) => element.attr({ filter: `url(#${id})` });
}

const messageTypes = {
  MARKER: 'marker',
  REVEAL: 'reveal',
  SERIES: 'series',
  RTT: 'rtt',
  END: 'end'
};

const bodyBox = document.getElementById('svg-canvas').getBoundingClientRect();

// Initialize the SVG container elements
const imageContainer = SVG(document.getElementById('svg-canvas'));
// sync marker animation container
// TODO: rename
const rippleContainer = SVG(document.getElementById('ripple'));



const gaussianBlur = buildFilter({
  svg: imageContainer,
  id: 'gauss',
  type: 'feGaussianBlur',
  attrs: { stdDeviation: 3 }
});

const syncCounterEl = document.getElementById('sync-counter');
const seriesCounterEl = document.getElementById('series-counter');
const latencyCounterEl = document.getElementById('latency-counter');

const paletteA = '#e55d87';
const paletteB = '#5fc3e4';

const backingGrid = createHexagonGrid();
const rippleColorPalette = new ShuffledList(makePalette({
  colors: [ paletteA, paletteB ],
  paletteSize: 4
}));

const hexagons = imageContainer.hexagonGroup(backingGrid);

const visibleMaskProps = {
  opacity: 1,
  'stroke-color': '#1f1f1f'
};

// filter backing hexagon grid into a new list containing all hexagons
// that fall within the base image
const getMaskOverlap = (grid, shapes, mask, offset = 0) => {
  return grid.reduce((memo, polygon, index) => {
    const { x, y } = polygon.toPoint();

    if (mask.inside(x, y - offset)) {
      memo = [
        {
          svg: shapes.get(index),
          memory: polygon
        },
        ...memo
      ];
    }

    return memo;
  }, []);
};

let hexagonsInImage;

const hexImageMask = imageContainer.mask();

const selected = {};

const paintImage = ({ svg, url, offset, size }) => {
  const image = size
    ? svg.image(url, size.width, size.height)
    : svg.image(url).loaded(function(imgData) {
        image.size(imgData.width, imgData.height);
      });

  if (offset) {
    image.translate(offset.x, offset.y);
  }

  return Promise.resolve(image);
};

const loadImages = (...images) => {
  return new Promise(function(resolve, _) {
    const imageTasks = images.map((name) => {
      return paintImage({
        svg: imageContainer,
        url: getImage(name),
        size: { width: 600, height: 200 }
      });
    });
    
    return Promise.all(imageTasks).then(resolve);
  });
};

let baseImageRef;
let maskingImageRef;

const runDisplayImages = (series, phrase) => {
  return loadImages(series, phrase).then((images) => {
    const [ baseImage, maskingImage ] = images;
    const baseImageBounds = baseImage.node.getBoundingClientRect();
    const imageDisplayOffset = centerElement(bodyBox, baseImageBounds);
    
    baseImageRef = baseImage;
    maskingImageRef = maskingImage;
    
    // const f = new SVG.Filter();
    // const t = new SVG.TurbulenceEffect("0.07 0.01", "5", "2", "stitch", "turbulence");
    // const d = new SVG.DisplacementMapEffect('SourceGraphic', t.result(), "9.82881e-13", "R", "B");

    // f.node.appendChild(t.node);
    // f.node.appendChild(d.node);
    // imageContainer.node.appendChild(f.node)

    // baseImageRef.filter(f);
    // baseImageRef.filter(function(add) {
    //   add
    //     .turbulence(
    //     .displacementMap(add.$source, "9.82881e-13", "R", "B");
    // });
   
    hexagons.translate(
      imageDisplayOffset.x,
      imageDisplayOffset.y
    )
    // move image to the back of the canvas
    baseImage.translate(
      imageDisplayOffset.x,
      imageDisplayOffset.y
    ).back().scale(IMG_SCALE_FACTOR,IMG_SCALE_FACTOR);
    maskingImage.translate(
      imageDisplayOffset.x,
      imageDisplayOffset.y
    ).scale(IMG_SCALE_FACTOR, IMG_SCALE_FACTOR);

    // Add a rectangle around the image to generate a border effect
    imageContainer.rect(
      baseImageBounds.width,
      baseImageBounds.height)
    .fill({
      color: 'transparent'
    })
    .stroke({ width: 6 })
    .translate(
      imageDisplayOffset.x,
      imageDisplayOffset.y
    )
    .scale(IMG_SCALE_FACTOR, IMG_SCALE_FACTOR)
    
    // Position DOM nodes relative to the image. We do this after load because we don't know how
    // large the image is, and thus we wouldn't know where to place it
    const seriesInfoEl = document.getElementById('series-info');

    seriesInfoEl.setAttribute('style', `width: ${baseImageBounds.width}px; visibility: visible; position: absolute; top: 120px; left: ${imageDisplayOffset.x}px`);

    /**
     * formula to center text in an element
     * 
     * x == (elementWidth / 2) + elementXOffset - (textWidth / 2)
     * y == ??
     * 
     */

    hexagonsInImage = new ShuffledList(
      getMaskOverlap(
        backingGrid,
        hexagons,
        maskingImage,
      )
    );
    
    maskingImage.maskWith(hexImageMask);

    return Promise.resolve();
  });
};


/**
 * 
 * @param {number} percentToReveal between 0 - 1 exclusive
 */
let lastPercentageRevealed = 0;

// realistically, the queue should wrap everything in a promise? how to handle
// weirdo code like this with nested afters?
const runRevealAnimation = (percentToReveal, hexagons, imageMask, maskProps) => {
  return new Promise(function(resolve, _) {
    const percentageDelta = Number((percentToReveal - lastPercentageRevealed).toFixed(2));
    const numElementsToReveal = Math.floor(hexagonsInImage.length * percentageDelta);
    const tilesToReveal = hexagons.take(numElementsToReveal);

    lastPercentageRevealed = percentToReveal;
  
    tilesToReveal.forEach(({ svg, memory}) => {
      imageMask.add(svg.opacity(0));
      
      const { x, y } = memory.toPoint();
    
      svg.animate(1000).opacity(0.2)
        .after(() => {
          svg.animate(2000).opacity(1)
          svg.translate(x, y);
          svg.animate(2500).fill(maskProps);

          return resolve();
        });
    });
  });
};

const fullscreenBox = svg =>
  svg.rect(bodyBox.width, bodyBox.height)
    .opacity(0)
    .style({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%'
    });

const square = fullscreenBox(rippleContainer).style({ 'z-index': 0 });
const blackFrame = fullscreenBox(rippleContainer).style({'z-index': 1000});

perlin(imageContainer)(square);

const flashBlack = () => {
  return new Promise((resolve, _) => {
    blackFrame
      .animate(1, '-')
      .opacity(1)
      .animate(1, '-', 100)
      .opacity(0)
      
      squareMarker()

      return resolve();
  });
};

const squareMarker = () => {
  return new Promise((resolve, _) => {
    square
      .fill({ color: rippleColorPalette.takeRandom() })
      .opacity(0.5)
      .animate(1200, '<')
      .opacity(0);
      
      return resolve();
    });
};

const pq = PriorityQueue({ id: 'pq1'});
let hasSeries = false;
window.pq = pq;
//runDisplayImages('series1', 'phrase1')
const socket = connect();
let gaussf;

socket.listen((message) => {
  const payload = parseJSON(message.data);

  if (typeof payload === 'string') {
    return;
  }

  const { type, data } = payload;
  
  switch(type) {
    case messageTypes.MARKER:
      gaussianBlur.attachTo(baseImageRef);
      gaussianBlur.attachTo(maskingImageRef);

      // baseImageRef.filter(function(add) {
      //   gaussf = add.gaussianBlur(0);
      // });
      //gaussf.animate(100).attr({ stdDeviation: 5 });
      pq.pushHighPriority(flashBlack, null);
      pq.pushHighPriority(function updateSyncMarkers() {
        syncCounterEl.textContent = data;
        return Promise.resolve()
      });
      pq.pushLowPriority(function() {
        return new Promise((resolve, reject) => {
          gaussianBlur.removeFrom(baseImageRef);
          gaussianBlur.removeFrom(maskingImageRef);
          //gaussf.animate(2000).attr({ stdDeviation: 0 })
          return resolve();
        });
      });
      break;
    case messageTypes.REVEAL:
      if (data === 1) {
        socket.unlisten();
      }
      pq.pushLowPriority(
        runRevealAnimation,
        null,
        data,
        hexagonsInImage,
        hexImageMask,
        visibleMaskProps
      );
      break;
    case messageTypes.SERIES:
      !hasSeries && pq.pushHighPriority(runDisplayImages, null, data, data.replace('series', 'phrase'));
      seriesCounterEl.textContent = data.replace('series', '');
      hasSeries = true;
      break;
    case messageTypes.RTT:
      latencyCounterEl.textContent = data
      break;
    case messageTypes.END:
      pq.flush();
      break;
    default:
      console.warn('Unknown message type :: ', data);
      break;
  }
});
