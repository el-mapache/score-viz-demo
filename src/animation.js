export const opacity = (svg, time = 1000, easing = "<>", delay = '0.0s', value) =>
  svg.animate(time, easing, delay).opacity(0)