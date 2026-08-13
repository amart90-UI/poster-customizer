/**
 * Generates a placeholder background PNG (1100x1700px dark gray)
 * for the hoss-dark template. Replace with actual artwork later.
 */
const fs = require('fs');
const zlib = require('zlib');

const width = 1100;
const height = 1700;

// PNG signature
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR chunk
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(width, 0);
ihdrData.writeUInt32BE(height, 4);
ihdrData[8] = 8;  // bit depth
ihdrData[9] = 2;  // color type (RGB)
ihdrData[10] = 0; // compression
ihdrData[11] = 0; // filter
ihdrData[12] = 0; // interlace
const ihdr = createChunk('IHDR', ihdrData);

// IDAT chunk - dark gray pixels (#1a1a1a)
const rowSize = 1 + width * 3; // filter byte + RGB per pixel
const rawData = Buffer.alloc(rowSize * height);
for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0; // no filter
    for (let x = 0; x < width; x++) {
        const px = offset + 1 + x * 3;
        rawData[px] = 0x1a;     // R
        rawData[px + 1] = 0x1a; // G
        rawData[px + 2] = 0x1a; // B
    }
}
const compressed = zlib.deflateSync(rawData, { level: 9 });
const idat = createChunk('IDAT', compressed);

// IEND chunk
const iend = createChunk('IEND', Buffer.alloc(0));

const png = Buffer.concat([signature, ihdr, idat, iend]);
fs.writeFileSync('templates/hoss-dark/background.png', png);
console.log(`Created background.png (${png.length} bytes, ${width}x${height}px)`);

// Also create a small thumbnail placeholder
const thumbWidth = 110;
const thumbHeight = 170;

const thumbIhdrData = Buffer.alloc(13);
thumbIhdrData.writeUInt32BE(thumbWidth, 0);
thumbIhdrData.writeUInt32BE(thumbHeight, 4);
thumbIhdrData[8] = 8;
thumbIhdrData[9] = 2;
thumbIhdrData[10] = 0;
thumbIhdrData[11] = 0;
thumbIhdrData[12] = 0;
const thumbIhdr = createChunk('IHDR', thumbIhdrData);

const thumbRowSize = 1 + thumbWidth * 3;
const thumbRawData = Buffer.alloc(thumbRowSize * thumbHeight);
for (let y = 0; y < thumbHeight; y++) {
    const offset = y * thumbRowSize;
    thumbRawData[offset] = 0;
    for (let x = 0; x < thumbWidth; x++) {
        const px = offset + 1 + x * 3;
        thumbRawData[px] = 0x1a;
        thumbRawData[px + 1] = 0x1a;
        thumbRawData[px + 2] = 0x1a;
    }
}
const thumbCompressed = zlib.deflateSync(thumbRawData, { level: 9 });
const thumbIdat = createChunk('IDAT', thumbCompressed);
const thumbIend = createChunk('IEND', Buffer.alloc(0));

const thumbPng = Buffer.concat([signature, thumbIhdr, thumbIdat, thumbIend]);
fs.writeFileSync('templates/hoss-dark/thumbnail.png', thumbPng);
console.log(`Created thumbnail.png (${thumbPng.length} bytes, ${thumbWidth}x${thumbHeight}px)`);

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcData);
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);
    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 1) crc = (crc >>> 1) ^ 0xEDB88320;
            else crc = crc >>> 1;
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
