type ZipFile = {
  name: string;
  bytes: Uint8Array;
};

type CentralDirectoryEntry = {
  name: Buffer;
  crc32: number;
  size: number;
  offset: number;
  dosTime: number;
  dosDate: number;
};

const crcTable = createCrcTable();

export function createZipArchive(files: ZipFile[]) {
  const chunks: Buffer[] = [];
  const centralDirectory: CentralDirectoryEntry[] = [];
  let offset = 0;
  const { dosTime, dosDate } = toDosDateTime(new Date());

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const bytes = Buffer.from(file.bytes);
    const crc32 = calculateCrc32(bytes);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(bytes.byteLength, 18);
    localHeader.writeUInt32LE(bytes.byteLength, 22);
    localHeader.writeUInt16LE(name.byteLength, 26);
    localHeader.writeUInt16LE(0, 28);

    chunks.push(localHeader, name, bytes);
    centralDirectory.push({
      name,
      crc32,
      size: bytes.byteLength,
      offset,
      dosTime,
      dosDate
    });
    offset += localHeader.byteLength + name.byteLength + bytes.byteLength;
  }

  const centralDirectoryOffset = offset;

  for (const entry of centralDirectory) {
    const header = Buffer.alloc(46);

    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(entry.dosTime, 12);
    header.writeUInt16LE(entry.dosDate, 14);
    header.writeUInt32LE(entry.crc32, 16);
    header.writeUInt32LE(entry.size, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.name.byteLength, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.offset, 42);

    chunks.push(header, entry.name);
    offset += header.byteLength + entry.name.byteLength;
  }

  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centralDirectory.length, 8);
  end.writeUInt16LE(centralDirectory.length, 10);
  end.writeUInt32LE(offset - centralDirectoryOffset, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  end.writeUInt16LE(0, 20);
  chunks.push(end);

  return Buffer.concat(chunks);
}

function calculateCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    return crc >>> 0;
  });
}

function toDosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980);

  return {
    dosTime:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    dosDate:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate()
  };
}
