// One-off: generate TeziPOS app icons (pure Node, no deps).
// Full-bleed #7c3aed square with a white "T" — Android masks it anyway.
import zlib from "node:zlib";
import fs from "node:fs";

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(size, draw) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Supersample 4x for smooth edges, then box-downscale.
function render(size) {
  const S = size * 4;
  const at = (fx, fy) => {
    // "T": top bar + stem, centered in the 80% safe zone.
    const inBar = fx > 0.20 && fx < 0.80 && fy > 0.24 && fy < 0.44;
    const inStem = fx > 0.41 && fx < 0.59 && fy > 0.44 && fy < 0.78;
    return inBar || inStem ? [255, 255, 255, 255] : [0x7c, 0x3a, 0xed, 255];
  };
  const out = png(size, (fx, fy) => {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const [pr, pg, pb] = at(fx + (sx + 0.5) / S, fy + (sy + 0.5) / S);
      r += pr; g += pg; b += pb;
    }
    return [r / 16, g / 16, b / 16, 255];
  });
  return out;
}

for (const size of [192, 512, 180]) {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  fs.writeFileSync(`public/${name}`, render(size));
  console.log("wrote", name);
}
