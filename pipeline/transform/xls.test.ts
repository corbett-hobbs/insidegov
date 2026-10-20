import { describe, expect, it } from "vitest";
import { readXls } from "./xls";

/** A minimal BIFF8 workbook inside an OLE2 compound file (one FAT sector, a directory sector, a stream of regular sectors). */
const rec = (id: number, data: Buffer) => {
  const h = Buffer.alloc(4);
  h.writeUInt16LE(id, 0);
  h.writeUInt16LE(data.length, 2);
  return Buffer.concat([h, data]);
};
const u16 = (...v: number[]) => Buffer.from(v.flatMap((n) => [n & 255, n >> 8]));
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
const bof = (type: number) => rec(0x0809, Buffer.concat([u16(0x0600, type), Buffer.alloc(12)]));
const eof = rec(0x000a, Buffer.alloc(0));
const f64 = (n: number) => {
  const b = Buffer.alloc(8);
  b.writeDoubleLE(n);
  return b;
};

function compound(stream: Buffer): Buffer {
  const SS = 512;
  const padded = Buffer.concat([stream, Buffer.alloc(Math.max(4096, Math.ceil(stream.length / SS) * SS) - stream.length)]);
  const n = padded.length / SS;
  const header = Buffer.alloc(SS, 0xff);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.fill(0, 8, 76);
  header.writeUInt16LE(9, 30); // sector size 512
  header.writeUInt16LE(6, 32); // mini sector size 64
  header.writeUInt32LE(1, 44); // one FAT sector
  header.writeUInt32LE(1, 48); // directory starts at sector 1
  header.writeUInt32LE(4096, 56);
  header.writeUInt32LE(0xfffffffe, 60);
  header.writeUInt32LE(0xfffffffe, 68);
  header.writeUInt32LE(0, 76); // the FAT is sector 0
  const fat = Buffer.alloc(SS, 0xff);
  fat.writeUInt32LE(0xfffffffd, 0);
  fat.writeUInt32LE(0xfffffffe, 4);
  for (let i = 0; i < n; i++) fat.writeUInt32LE(i === n - 1 ? 0xfffffffe : 3 + i, 4 * (2 + i));
  const dir = Buffer.alloc(SS);
  const entry = (at: number, name: string, type: number, start: number, size: number) => {
    dir.write(name, at, "utf16le");
    dir.writeUInt16LE(name.length * 2 + 2, at + 64);
    dir[at + 66] = type;
    dir.writeUInt32LE(start, at + 116);
    dir.writeUInt32LE(size, at + 120);
  };
  entry(0, "Root Entry", 5, 0xfffffffe, 0);
  entry(128, "Workbook", 2, 2, padded.length); // (at least the 4096-byte mini-stream cutoff, as real workbooks are)
  return Buffer.concat([header, fat, dir, padded]);
}

/** Header "commodity", "end_use"; then rows of codes as text, numbers and RK cells. One string is split across a CONTINUE record. */
function workbook(): Buffer {
  const text = (s: string, wide = false) => Buffer.concat([u16(s.length), Buffer.from([wide ? 1 : 0]), Buffer.from(s, wide ? "utf16le" : "latin1")]);
  const strings = [text("commodity"), text("end_use"), text("0101210000"), text("Bœuf", true), text("00150")];
  const sstBody = Buffer.concat([u32(strings.length), u32(strings.length), ...strings]);
  // Split inside "end_use": after its length/flags and three characters. The continuation restates the encoding flag.
  const cut = 8 + strings[0].length + 3 + 3;
  const sst = Buffer.concat([rec(0x00fc, sstBody.subarray(0, cut)), rec(0x003c, Buffer.concat([Buffer.from([0]), sstBody.subarray(cut)]))]);
  const sheetAt = (offset: number) => rec(0x0085, Buffer.concat([u32(offset), u16(0), Buffer.from([4, 0]), Buffer.from("Data")]));
  const globals = (offset: number) => Buffer.concat([bof(0x0005), sheetAt(offset), sst, eof]);
  const offset = globals(0).length;
  const cell = (row: number, col: number) => Buffer.concat([u16(row, col, 0)]);
  const rk = (n: number) => u32(((n << 2) | 2) >>> 0); // an integer RK
  const sheet = Buffer.concat([
    bof(0x0010),
    rec(0x00fd, Buffer.concat([cell(0, 0), u32(0)])),
    rec(0x00fd, Buffer.concat([cell(0, 1), u32(1)])),
    rec(0x00fd, Buffer.concat([cell(1, 0), u32(2)])),
    rec(0x00fd, Buffer.concat([cell(1, 1), u32(4)])),
    rec(0x00fd, Buffer.concat([cell(2, 0), u32(3)])),
    rec(0x027e, Buffer.concat([cell(2, 1), rk(150)])),
    rec(0x0203, Buffer.concat([cell(3, 1), f64(12.5)])),
    // MULRK: columns 2 and 3 of row 3
    rec(0x00bd, Buffer.concat([u16(3, 2), u16(0), rk(7), u16(0), rk(8), u16(3)])),
    eof,
  ]);
  return Buffer.concat([globals(offset), sheet]);
}

describe("readXls", () => {
  it("reads text (a string split across CONTINUE, a UTF-16 string) and numbers (RK, NUMBER, MULRK) from a BIFF8 sheet", () => {
    expect(readXls(compound(workbook()))).toEqual([
      ["commodity", "end_use"],
      ["0101210000", "00150"],
      ["Bœuf", "150"],
      ["", "12.5", "7", "8"],
    ]);
  });

  it("rejects anything that is not an OLE2 file", () => {
    expect(() => readXls(Buffer.from("PK\u0003\u0004 not an xls"))).toThrow(/OLE2/);
  });
});
