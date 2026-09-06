/** Minimal JPEG EXIF DateTimeOriginal reader. Returns ISO string or null. */

function readAscii(view: DataView, offset: number, length: number): string {
  const chars: string[] = [];
  for (let i = 0; i < length; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) {
      break;
    }
    chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}

function parseExifDate(value: string): string | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+09:00`;
}

export async function readJpegTakenAt(file: File): Promise<string | null> {
  if (file.type !== "image/jpeg") {
    return null;
  }
  const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return null;
  }
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      break;
    }
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      return readExifFromApp1(view, offset + 4, size - 2);
    }
    offset += 2 + size;
  }
  return null;
}

function readExifFromApp1(view: DataView, start: number, length: number): string | null {
  if (start + length > view.byteLength) {
    return null;
  }
  if (readAscii(view, start, 4) !== "Exif") {
    return null;
  }
  const tiff = start + 6;
  const little = view.getUint16(tiff) === 0x4949;
  const get16 = (pos: number) => (little ? view.getUint16(pos, true) : view.getUint16(pos, false));
  const get32 = (pos: number) => (little ? view.getUint32(pos, true) : view.getUint32(pos, false));
  const ifd0 = tiff + get32(tiff + 4);
  const count = get16(ifd0);
  let exifOffset: number | null = null;
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    const tag = get16(entry);
    if (tag === 0x8769) {
      exifOffset = tiff + get32(entry + 8);
    }
  }
  if (!exifOffset) {
    return null;
  }
  const exifCount = get16(exifOffset);
  for (let i = 0; i < exifCount; i += 1) {
    const entry = exifOffset + 2 + i * 12;
    const tag = get16(entry);
    if (tag === 0x9003) {
      const valueOffset = tiff + get32(entry + 8);
      return parseExifDate(readAscii(view, valueOffset, 20));
    }
  }
  return null;
}
