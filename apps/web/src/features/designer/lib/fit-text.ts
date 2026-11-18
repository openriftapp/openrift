interface FitBox {
  clientHeight: number;
}

interface FitContent {
  offsetHeight: number;
  style: { fontSize: string };
}

const MIN_SCALE = 0.6;
const STEP = 0.05;

export function shrinkToFit(box: FitBox, content: FitContent, baseCqw: number): number {
  let scale = 1;
  content.style.fontSize = `${baseCqw}cqw`;
  while (content.offsetHeight > box.clientHeight && scale - STEP >= MIN_SCALE - 1e-9) {
    scale = Math.round((scale - STEP) * 100) / 100;
    content.style.fontSize = `${baseCqw * scale}cqw`;
  }
  return scale;
}
