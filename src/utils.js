export const getRandomBetween = (min, max) => (Math.random() * max + min) | 0;

export const centerElement = (parent, child) => ({
  x: (parent.width / 2) - (child.width / 2),
  y: (parent.height / 2) - (child.height / 2),
});

export const parseJSON = data => {
  try {
    return JSON.parse(data);
  } catch(e) {
    return data;
  }
};


// trash
// const runMarkerAnimation = () => {
  //   return new Promise(function(resolve) {
  //     let nextIndex = getRandomBetween(0, hexagonsInImage.length);
  
  //     while (selected[nextIndex]) {
  //       nextIndex = getRandomBetween(0, hexagonsInImage.length);
  //     }
    
  //     selected[nextIndex] = true;
    
  //     const { memory } = hexagonsInImage[nextIndex];
  //     const bbox = document.body.getBoundingClientRect();
  
  //     const circle = rippleContainer
  //       .circle(1)
  //       .attr({ cx: 1, cy: 1})
  //       .fill({  
  //         color: rippleColorPalette.takeRandom(),
  //         opacity: 0
  //       });
      
  //     circle
  //       .translate(memory.toPoint().x + (bodyBox.width / 4), memory.toPoint().y + (bodyBox.height / 4))
  //       .animate(1500, 'circOut')
  //       .fill({ opacity: .45 })
  //       .size(
  //         bbox.height,
  //         bbox.width
  //       ).after(function() {
  //         return this.animate(1000, '<').opacity(0);
  //       })
  //       .after(function() {
  //         setTimeout(function() { circle.remove() }, 2000);
  //       });
  
  //       return resolve();
  //   });
  // };
