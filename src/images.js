import images from './img/**/*.png';

const IMAGE_TYPES = {
  SERIES: 'series',
  PHRASE: 'phrase',
};

const SERIES_REGEXP = new RegExp(IMAGE_TYPES.SERIES);
const PHRASE_REGEXP = new RegExp(IMAGE_TYPES.PHRASE);

const isSeries = name => SERIES_REGEXP.test(name);
const isPhrase = name => PHRASE_REGEXP.test(name);

export const getImage = (name) => {
  let imageType;
  
  if (isSeries(name)) {
    imageType = 'series';
  } else if (isPhrase(name)) {
    imageType = 'phrases';
  }

  return images[imageType][name] || '';
};
