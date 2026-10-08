import { describe, expect, it } from "vitest";

import { videoLayoutBox, zoomRegion } from "./scan-zoom";

function fakeVideo(
  rect: { left: number; top: number; width: number; height: number },
  offset: { width: number; height: number },
): HTMLVideoElement {
  return {
    getBoundingClientRect: () => rect,
    offsetWidth: offset.width,
    offsetHeight: offset.height,
  } as unknown as HTMLVideoElement;
}

describe("zoomRegion", () => {
  it("covers the whole video without zoom", () => {
    expect(zoomRegion(1920, 1080, 1)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("takes the centred half at 2x", () => {
    expect(zoomRegion(1920, 1080, 2)).toEqual({ x: 480, y: 270, width: 960, height: 540 });
  });

  it("never widens past the video for a zoom below 1", () => {
    expect(zoomRegion(640, 480, 0.5)).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });
});

describe("videoLayoutBox", () => {
  it("returns the box as measured when the video is not zoomed", () => {
    const video = fakeVideo(
      { left: 10, top: 20, width: 300, height: 500 },
      { width: 300, height: 500 },
    );
    expect(videoLayoutBox(video)).toEqual({ left: 10, top: 20, width: 300, height: 500, zoom: 1 });
  });

  it("undoes a centred zoom transform", () => {
    const video = fakeVideo(
      { left: -140, top: -230, width: 600, height: 1000 },
      { width: 300, height: 500 },
    );
    expect(videoLayoutBox(video)).toEqual({ left: 10, top: 20, width: 300, height: 500, zoom: 2 });
  });

  it("falls back to the measured box when layout sizes are missing", () => {
    const video = fakeVideo({ left: 0, top: 0, width: 320, height: 240 }, { width: 0, height: 0 });
    expect(videoLayoutBox(video)).toMatchObject({ width: 320, height: 240, zoom: 1 });
  });
});
