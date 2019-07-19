import './styles.css';
import { getImage } from './images';
import SVG from './svg';
import createHexagonGrid from './hex-grid';
import connect from './socket';
import ShuffledList from './shuffled-list';
import PriorityQueue from './priority-queue';
import makePalette from './palette';
import { centerElement, parseJSON, getRandomBetween } from './utils'

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

const IMG_SCALE_FACTOR = 1.5;
const SCORE_STROKE_WIDTH = 8;
const appendChildren = (root, ...children) => {
  children.forEach(child => root.node.appendChild(child.node));
};

const messageTypes = {
  MARKER: 'marker',
  REVEAL: 'reveal',
  SERIES: 'series',
  RTT: 'rtt',
  END: 'end'
};

const canvasEl =  document.getElementById('svg-canvas');
const bodyBox = canvasEl.getBoundingClientRect();

// Initialize the SVG container elements
const imageContainer = SVG(canvasEl);
// sync marker animation container
// TODO: rename
const syncMarkerContainer = SVG(document.getElementById('ripple'));

const syncCounterEl = document.getElementById('sync-counter');
const seriesCounterEl = document.getElementById('series-counter');
const latencyCounterEl = document.getElementById('latency-counter');
const seriesInfoEl = document.getElementById('series-info');

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
let stutterFilter;

const runDisplayImages = (series, phrase) => {
  return loadImages(series, phrase).then((images) => {
    const [ baseImage, maskingImage ] = images;
    const baseImageBounds = baseImage.node.getBoundingClientRect();
    const imageDisplayOffset = centerElement(bodyBox, baseImageBounds);
    
    baseImageRef = baseImage;
    maskingImageRef = maskingImage;
    
    const f = new SVG.Filter();
    const t = new SVG.TurbulenceEffect("0.07 0.01", "5", "2", "stitch", "turbulence");
    const d = new SVG.DisplacementMapEffect('SourceGraphic', t.result(), "9.82881e-13", "R", "B");
    const g = new SVG.GaussianBlurEffect(0);
    const b = new SVG.BlendEffect(b, d.result());

    d.attr({ filterUnits: "userSpaceOnUse", scale: 0 });

    f.node.appendChild(t.node);
    f.node.appendChild(d.node);
    f.node.appendChild(g.node);
    f.node.appendChild(b.node);
    imageContainer.node.appendChild(f.node);
    
    stutterFilter = {
      addTo(element) {
        element.attr({ filter: `url(#${f.id()})`});
      },
      animate() {
        const scale = getRandomBetween(1, 25);
        const numOctaves = getRandomBetween(1, 6);
        g.animate(75).attr({ stdDeviation: 3 });
        t.attr({ numOctaves })
        d.animate(150, '<>').attr({ scale });
        g.animate(75).attr({ stdDeviation: 0 });
        d.animate(75, '<>').attr({ scale: 0 });
      },
      removeFrom(element) {
        element.attr({ filter: '' });
      }
    };

    stutterFilter.addTo(baseImageRef);
 
    hexagons.translate(
      imageDisplayOffset.x,
      imageDisplayOffset.y
    );

    baseImage.translate(
      IMG_SCALE_FACTOR * 100,
      imageDisplayOffset.y + IMG_SCALE_FACTOR * 100
    )
    .scale(IMG_SCALE_FACTOR, IMG_SCALE_FACTOR)
    // move image to the back of the canvas
    .back();

    maskingImage.translate(
      IMG_SCALE_FACTOR * 100,
      imageDisplayOffset.y + IMG_SCALE_FACTOR * 100
    )
    .scale(IMG_SCALE_FACTOR, IMG_SCALE_FACTOR);

    // Add a rectangle around the image to generate a border effect
    imageContainer.rect(
      baseImageBounds.width * IMG_SCALE_FACTOR + SCORE_STROKE_WIDTH,
      baseImageBounds.height * IMG_SCALE_FACTOR + SCORE_STROKE_WIDTH
    )
    .fill({ color: 'transparent' })
    .stroke({ width: SCORE_STROKE_WIDTH });
    
    
    // Position DOM nodes relative to the image. We do this after load because we don't know how
    // large the image is, and thus we wouldn't know where to place it
    seriesInfoEl.setAttribute('style', `width: ${baseImageBounds.width}px; visibility: visible;`);
    canvasEl.setAttribute('style', `height: ${baseImageBounds.height*IMG_SCALE_FACTOR + SCORE_STROKE_WIDTH}px; min-width: 600px; width: ${baseImageBounds.width*IMG_SCALE_FACTOR + SCORE_STROKE_WIDTH}px`);

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

const fullscreenBox = (svg, opacity=0) =>
  svg.rect(bodyBox.width, bodyBox.height)
    .opacity(opacity)
    .style({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%'
    });

const square = fullscreenBox(syncMarkerContainer).style({ 'z-index': 0 });
const blackFrame = fullscreenBox(syncMarkerContainer).style({'z-index': 1000});

const flashBlack = () => {
  return new Promise((resolve, _) => {
    blackFrame
      .animate(1, '-')
      .opacity(0.8)
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

//runDisplayImages('series1', 'phrase1')
const socket = connect();

socket.listen((message) => {
  const payload = parseJSON(message.data);

  if (typeof payload === 'string') {
    return;
  }

  const { type, data } = payload;
  console.log(type, payload)
  switch(type) {
    case messageTypes.MARKER:
      pq.pushHighPriority(flashBlack, null);

      pq.pushHighPriority(function updateSyncMarkers() {
        if (getRandomBetween(1, 2) % 2) {
          stutterFilter.animate();
        }
        syncCounterEl.textContent = data;
        return Promise.resolve()
      });
      break;
    case messageTypes.REVEAL: 
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
      pq.pushHighPriority(runDisplayImages, null, data, data.replace('series', 'phrase'));
      seriesCounterEl.textContent = data.replace('series', '');

      break;
    case messageTypes.RTT:
      latencyCounterEl.textContent = data
      break;
    case messageTypes.END:
      pq.flush().then(() => {
        latencyCounterEl.textContent = '-';
        syncCounterEl.textContent = 0;
      });
      break;
    default:
      console.warn('Unknown message type :: ', data);
      break;
  }
});
