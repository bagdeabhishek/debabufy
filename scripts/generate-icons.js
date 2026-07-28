#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { deflateSync } from "node:zlib";

const sizes = [16, 32, 48, 128];
const outputDirectory = path.join(process.cwd(), "extension", "icons");

await fs.mkdir(outputDirectory, { recursive: true });
for (const size of sizes) {
  const pixels = renderIcon(size);
  const file = path.join(outputDirectory, `icon-${size}.png`);
  await fs.writeFile(file, encodePng(size, size, pixels));
  console.log(`Generated ${path.relative(process.cwd(), file)}`);
}

function renderIcon(size) {
  const channels = 4;
  const pixels = Buffer.alloc(size * size * channels);
  const samples = size <= 32 ? 4 : 3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sum = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < samples; sampleY += 1) {
        for (let sampleX = 0; sampleX < samples; sampleX += 1) {
          const u = (x + (sampleX + 0.5) / samples) / size;
          const v = (y + (sampleY + 0.5) / samples) / size;
          const color = sampleIcon(u, v);
          for (let channel = 0; channel < channels; channel += 1) {
            sum[channel] += color[channel];
          }
        }
      }

      const offset = (y * size + x) * channels;
      const divisor = samples * samples;
      for (let channel = 0; channel < channels; channel += 1) {
        pixels[offset + channel] = Math.round(sum[channel] / divisor);
      }
    }
  }
  return pixels;
}

function sampleIcon(x, y) {
  let color = [0, 0, 0, 0];

  if (insideRoundedRectangle(x, y, 0.04, 0.04, 0.96, 0.96, 0.22)) {
    color = mix([29, 125, 81, 255], [13, 77, 48, 255], y);
  }
  if (insideRoundedRectangle(x, y, 0.22, 0.14, 0.75, 0.85, 0.055)) {
    color = [250, 252, 250, 255];
  }
  if (insideTriangle(x, y, [0.58, 0.14], [0.75, 0.31], [0.58, 0.31])) {
    color = [213, 235, 222, 255];
  }
  for (const lineY of [0.39, 0.50, 0.61]) {
    if (insideRoundedRectangle(x, y, 0.31, lineY, 0.64, lineY + 0.045, 0.022)) {
      color = [20, 108, 67, 255];
    }
  }
  if (distance(x, y, 0.72, 0.72) <= 0.175) {
    color = [244, 185, 66, 255];
  }
  if (
    distanceToSegment(x, y, 0.64, 0.72, 0.70, 0.78) <= 0.026 ||
    distanceToSegment(x, y, 0.70, 0.78, 0.81, 0.65) <= 0.026
  ) {
    color = [255, 255, 255, 255];
  }
  return color;
}

function insideRoundedRectangle(x, y, left, top, right, bottom, radius) {
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  return (
    x >= left &&
    x <= right &&
    y >= top &&
    y <= bottom &&
    distance(x, y, nearestX, nearestY) <= radius
  );
}

function insideTriangle(x, y, a, b, c) {
  const sign = (point1, point2, point3) =>
    (point1[0] - point3[0]) * (point2[1] - point3[1]) -
    (point2[0] - point3[0]) * (point1[1] - point3[1]);
  const point = [x, y];
  const d1 = sign(point, a, b);
  const d2 = sign(point, b, c);
  const d3 = sign(point, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return distance(x, y, x1 + amount * dx, y1 + amount * dy);
}

function mix(start, end, amount) {
  return start.map((value, index) =>
    Math.round(value + (end[index] - value) * amount)
  );
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const targetOffset = row * (stride + 1);
    scanlines[targetOffset] = 0;
    rgba.copy(scanlines, targetOffset + 1, row * stride, (row + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
