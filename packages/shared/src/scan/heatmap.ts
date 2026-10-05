function isPeak(heat: Float32Array, width: number, height: number, x: number, y: number): boolean {
  const value = heat[y * width + x] ?? 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      const inside = nx >= 0 && ny >= 0 && nx < width && ny < height;
      if (!inside || (dx === 0 && dy === 0)) {
        continue;
      }
      const other = heat[ny * width + nx] ?? 0;
      if (other > value || (other === value && (dy < 0 || (dy === 0 && dx < 0)))) {
        return false;
      }
    }
  }
  return true;
}

export function heatmapPeaks(
  heat: Float32Array,
  width: number,
  height: number,
  threshold: number,
): { x: number; y: number; value: number }[] {
  const peaks: { x: number; y: number; value: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = heat[y * width + x] ?? 0;
      if (value >= threshold && isPeak(heat, width, height, x, y)) {
        peaks.push({ x, y, value });
      }
    }
  }
  return peaks.sort((a, b) => b.value - a.value);
}
