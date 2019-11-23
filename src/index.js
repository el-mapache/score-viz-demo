import './styles.css';
import { getImage } from './images';
import SVG from './svg';
import createHexagonGrid from './hex-grid';
import connect from './socket';
import ShuffledList from './shuffled-list';
import PriorityQueue from './priority-queue';
import makePalette from './palette';
import { centerElement, parseJSON, getRandomBetween } from './utils'

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

const canvasEl = document.getElementById('svg-canvas');
const bodyBox = canvasEl.getBoundingClientRect();

// Initialize the SVG container elements
const imageContainer = SVG(canvasEl);
const syncMarkerContainer = SVG(document.getElementById('ripple'));

const syncCounterEl = document.getElementById('sync-counter');
const seriesCounterEl = document.getElementById('series-counter');
const latencyCounterEl = document.getElementById('latency-counter');
const seriesInfoEl = document.getElementById('series-info');

const paletteA = '#e55d87';
const paletteB = '#5fc3e4';

const paletteC = '#ff512f'
const paletteD = '#dd2476';

const paletteE = '#43cea2';
const paletteF = '#185a9d';

const colorPalettes = (() => {
  const palettes = new ShuffledList([
    new ShuffledList(makePalette({
      colors: ['#e55d87', '#5fc3e4'],
      size: 6
    })),
    new ShuffledList(makePalette({
      colors: ['#ff512f', '#dd2476'],
      size: 6
    })),
    new ShuffledList(makePalette({
      colors: ['#43cea2', '#185a9d'],
      size: 6
    }))
  ]);

  return {
    getColorPalette() {
      return palettes.takeRandom();
    }
  };
})();

let rippleColorPalette;

// = new ShuffledList(makePalette({
//   colors: [ paletteC, paletteD ],
//   paletteSize: 6
// }));

const visibleMaskProps = {
  opacity: 1,
  'stroke-color': '#1f1f1f'
};

const stutterFilter = ((container) => {
  const f = new SVG.Filter();
  const t = new SVG.TurbulenceEffect("0.07 0.4", "5", "2", "stitch", "turbulence");
  const d = new SVG.DisplacementMapEffect('SourceGraphic', t.result(), "9.82881e-13", "R", "B");
  const g = new SVG.GaussianBlurEffect(0);
  const b = new SVG.BlendEffect(b, d.result());

  /**
   * This value indicates that all coordinates for the
   * geometry preoperties refer to the user coordinate system
   * as defined when the pattern was applied.
   * 
   * if i understand correctly this means the image wont stretch to fit
   * the shape 
   */
  d.attr({ filterUnits: "userSpaceOnUse", scale: 0 });
  f.node.appendChild(t.node);
  f.node.appendChild(d.node);
  f.node.appendChild(g.node);
  f.node.appendChild(b.node);
  container.node.appendChild(f.node);

  return {
    addTo(element) {
      element.attr({ filter: `url(#${f.id()})` });
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
})(imageContainer);

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

const paintImage = ({ svg, url, offset, size }) => {
  const image = size
    ? svg.image(url, size.width, size.height)
    : svg.image(url).loaded(function (imgData) {
      image.size(imgData.width, imgData.height);
    });

  if (offset) {
    image.translate(offset.x, offset.y);
  }

  return Promise.resolve(image);
};

const loadImages = (...images) => {
  return new Promise(function (resolve, _) {
    const imageTasks = images.map((name) => {
      return paintImage({
        svg: imageContainer,
        url: getImage(name),
        size: { width: 1080, height: 520 }
      });
    });

    return Promise.all(imageTasks).then(resolve);
  });
};

let baseImageRef;
let maskingImageRef;
let hexImageMask;
let scoreImageBorder;
let backingGrid;
let hexagons;

function positionImagesAndMask(images) {
  [baseImageRef, maskingImageRef] = images;
  const baseImageBounds = baseImageRef.node.getBoundingClientRect();

  backingGrid = createHexagonGrid({ width: baseImageBounds.width / 10, height: baseImageBounds.height / 10 });
  hexagons = imageContainer.hexagonGroup(backingGrid);

  hexImageMask = imageContainer.mask();
  rippleColorPalette = colorPalettes.getColorPalette();

  stutterFilter.addTo(baseImageRef);

  // move image to the back of the canvas
  baseImageRef.back();

  // maskingImageRef
  // .translate(
  //   imageDisplayOffset.x,
  //   imageDisplayOffset.y
  // )
  //.scale(IMG_SCALE_FACTOR, IMG_SCALE_FACTOR);

  scoreImageBorder && scoreImageBorder.remove();
  // Add a rectangle around the image to generate a border effect
  scoreImageBorder = imageContainer.rect(
    baseImageBounds.width,// * IMG_SCALE_FACTOR + SCORE_STROKE_WIDTH,
    baseImageBounds.height// * IMG_SCALE_FACTOR + SCORE_STROKE_WIDTH
  )
    .fill({ color: 'transparent' })
    .stroke({ width: SCORE_STROKE_WIDTH });

  // Position DOM nodes relative to the image. We do this after load because we don't know how
  // large the image is, and thus we wouldn't know where to place it
  seriesInfoEl.setAttribute('style', `width: ${baseImageBounds.width}px; visibility: visible;`);
  canvasEl.setAttribute('style', `height: ${baseImageBounds.height}px; min-width: 600px; width: ${baseImageBounds.width}px`);

  hexagonsInImage = new ShuffledList(
    getMaskOverlap(
      backingGrid,
      hexagons,
      maskingImageRef,
    )
  );

  maskingImageRef.maskWith(hexImageMask);

  return Promise.resolve();
}

const runDisplayImages = (series, phrase) => {
  return loadImages(series, phrase).then(positionImagesAndMask);
};

/**
 * 
 * @param {number} percentToReveal between 0 - 1 exclusive
 */
let lastPercentageRevealed = 0;

// realistically, the queue should wrap everything in a promise? how to handle
// weirdo code like this with nested afters?
const runRevealAnimation = (percentToReveal, maskProps) => {
  return new Promise(function (resolve, _) {
    const percentageDelta = Number((percentToReveal - lastPercentageRevealed));
    const numElementsToReveal = Math.floor(hexagonsInImage.length * percentageDelta);
    const tilesToReveal = hexagonsInImage.take(percentToReveal * 100);
    //const tilesToReveal = hexagonsInImage.take(1);
    console.log('delta', percentageDelta, '%reveal', percentToReveal, 'hexes', hexagonsInImage, 'num els', numElementsToReveal)

    lastPercentageRevealed = percentToReveal;

    tilesToReveal.forEach(({ svg, memory }) => {
      if (!svg) {
        return;
      }

      hexImageMask.add(svg.opacity(0));

      const { x, y } = memory.toPoint();

      svg.animate(1000)
        .opacity(0.2)
        .after(() => {
          svg.animate(2000).opacity(1)
          svg.translate(x, y);
          svg.animate(2500).fill(maskProps);
        });
    });
    return resolve();
  })
    .catch((e) => {
      console.log('oops i did it again', e)
    });
};

const fullscreenBox = (svg, opacity = 0) =>
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
const blackFrame = fullscreenBox(syncMarkerContainer).style({ 'z-index': 1000 });

const flashBlack = () => {
  return new Promise((resolve, _) => {
    blackFrame
      .animate(1, '-')
      .opacity(0.8)
      .animate(1, '-', 100)
      .opacity(0);

    return squareMarker().then(() => {
      return resolve();
    });
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

const pq = PriorityQueue({ id: 'pq1' });
let previousState = {};
let changes = {};

window.pq = pq;

//runDisplayImages('series1', 'phrase1')
connect()
  .then(socket => {
    socket.listen((message) => {
      /**
       * {"series":{"type":"series","data":"series1","label":"Series 1"},
       * "marker":{"type":"marker","data":"27"},
       * "end":{"type":"end","data":"0"},
       * "rtt":{"type":"rtt","data":"0.1"},
       * "reveal":{"type":"reveal","data":"0.2"}}
       */
      for (const [label, value] of Object.entries(message)) {
        const data = Number(value);
        const lastValue = previousState[label];

        if (data === lastValue) {
          changes[label] = undefined;
          continue;
        }

        changes[label] = data;
        previousState[label] = data;
      }

      if (changes[messageTypes.SERIES]) {
        lastPercentageRevealed = 0;
        pq.flush().then(() => {
          latencyCounterEl.textContent = '-';
          syncCounterEl.textContent = 0;

          baseImageRef && baseImageRef.remove();
          maskingImageRef && maskingImageRef.remove();

          pq.pushHighPriority(runDisplayImages, null, `series${changes[messageTypes.SERIES]}`, `phrase${changes[messageTypes.SERIES]}`);
          seriesCounterEl.textContent = changes[messageTypes.SERIES];

          if (changes[messageTypes.MARKER]) {
            if (changes[messageTypes.MARKER]) {
              pq.pushHighPriority(flashBlack, null);

              pq.pushHighPriority(function updateSyncMarkers() {
                if (getRandomBetween(1, 2) % 2) {
                  stutterFilter.animate();
                }
                syncCounterEl.textContent = changes[messageTypes.MARKER];
                return Promise.resolve()
              });
            }
          }

          if (changes[messageTypes.REVEAL]) {
            pq.pushLowPriority(
              runRevealAnimation,
              null,
              changes[messageTypes.REVEAL],
              visibleMaskProps
            );
          }

          if (changes[messageTypes.RTT]) {
            latencyCounterEl.textContent = changes[messageTypes.RTT]
          }

          if (changes[messageTypes.END]) {
            pq.flush().then(() => {
              latencyCounterEl.textContent = '-';
              syncCounterEl.textContent = 0;
            });
          }
        });
      } else {
        if (changes[messageTypes.MARKER]) {
          if (changes[messageTypes.MARKER]) {
            pq.pushHighPriority(flashBlack, null);

            pq.pushHighPriority(function updateSyncMarkers() {
              if (getRandomBetween(1, 2) % 2) {
                stutterFilter.animate();
              }
              syncCounterEl.textContent = changes[messageTypes.MARKER];
              return Promise.resolve()
            });
          }
        }

        if (changes[messageTypes.REVEAL]) {
          pq.pushLowPriority(
            runRevealAnimation,
            null,
            changes[messageTypes.REVEAL],
            visibleMaskProps
          );
        }

        if (changes[messageTypes.RTT]) {
          latencyCounterEl.textContent = changes[messageTypes.RTT]
        }

        if (changes[messageTypes.END]) {
          pq.flush().then(() => {
            latencyCounterEl.textContent = '-';
            syncCounterEl.textContent = 0;
          });
        }
      }
    });
  });
