export const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      if ((value & 1) !== 0) {
        value = 0xedb88320 ^ (value >>> 1);
      } else {
        value >>>= 1;
      }
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let index = 0; index < data.length; index++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export function getDosDateTime(date: Date) {
  let year = date.getFullYear();
  if (year < 1980) {
    year = 1980;
  }
  const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff;
  const dosDate = (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time: dosTime, date: dosDate };
}

export function createZipArchive(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();

  let totalLocalSize = 0;
  let totalCentralSize = 0;

  const entries = files.map((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const size = data.length;
    const { time, date } = getDosDateTime(new Date());

    totalLocalSize += 30 + nameBytes.length + size;
    totalCentralSize += 46 + nameBytes.length;

    return { nameBytes, data, crc, size, time, date };
  });

  const archive = new Uint8Array(totalLocalSize + totalCentralSize + 22);
  const view = new DataView(archive.buffer);
  let offset = 0;

  const centralEntries: Array<{
    nameBytes: Uint8Array;
    crc: number;
    size: number;
    time: number;
    date: number;
    offset: number;
  }> = [];

  for (const entry of entries) {
    const localHeaderOffset = offset;

    view.setUint32(offset, 0x04034b50, true); offset += 4;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, entry.time, true); offset += 2;
    view.setUint16(offset, entry.date, true); offset += 2;
    view.setUint32(offset, entry.crc >>> 0, true); offset += 4;
    view.setUint32(offset, entry.size >>> 0, true); offset += 4;
    view.setUint32(offset, entry.size >>> 0, true); offset += 4;
    view.setUint16(offset, entry.nameBytes.length, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;

    archive.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
    archive.set(entry.data, offset);
    offset += entry.size;

    centralEntries.push({
      nameBytes: entry.nameBytes,
      crc: entry.crc,
      size: entry.size,
      time: entry.time,
      date: entry.date,
      offset: localHeaderOffset,
    });
  }

  const centralDirectoryOffset = offset;

  for (const entry of centralEntries) {
    view.setUint32(offset, 0x02014b50, true); offset += 4;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, entry.time, true); offset += 2;
    view.setUint16(offset, entry.date, true); offset += 2;
    view.setUint32(offset, entry.crc >>> 0, true); offset += 4;
    view.setUint32(offset, entry.size >>> 0, true); offset += 4;
    view.setUint32(offset, entry.size >>> 0, true); offset += 4;
    view.setUint16(offset, entry.nameBytes.length, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint32(offset, 0, true); offset += 4;
    view.setUint32(offset, entry.offset >>> 0, true); offset += 4;

    archive.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
  }

  const centralDirectorySize = offset - centralDirectoryOffset;

  view.setUint32(offset, 0x06054b50, true); offset += 4;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, centralEntries.length, true); offset += 2;
  view.setUint16(offset, centralEntries.length, true); offset += 2;
  view.setUint32(offset, centralDirectorySize >>> 0, true); offset += 4;
  view.setUint32(offset, centralDirectoryOffset >>> 0, true); offset += 4;
  view.setUint16(offset, 0, true); offset += 2;

  return archive;
}

