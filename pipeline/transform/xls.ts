/**
 * Minimal read-only reader for the old binary `.xls` format (BIFF8 inside an OLE2 compound file; first worksheet
 * only), so the trade pipeline needs no spreadsheet dependency. Census's HS10 -> end-use concordances for 2010-2019
 * are published in this format (2020 on are `.xlsx`, see `xlsx.ts`). It reads what those files contain: text cells
 * (shared strings, inline labels) and numbers (NUMBER, RK, MULRK); formulas, dates and styles are not interpreted.
 * Returns each row as an array indexed by column, with cell values as strings (numbers as their shortest decimal
 * form) and "" for a blank cell.
 */

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

/** The named stream's bytes from an OLE2 compound file. */
function readStream(buf: Buffer, wanted: string[]): Buffer {
  if (buf.readUInt32BE(0) !== 0xd0cf11e0 || buf.readUInt32BE(4) !== 0xa1b11ae1) throw new Error("not an OLE2 compound file (not a .xls)");
  const sectorSize = 1 << buf.readUInt16LE(30);
  const miniSize = 1 << buf.readUInt16LE(32);
  const dirStart = buf.readUInt32LE(48);
  const miniCutoff = buf.readUInt32LE(56);
  const miniFatStart = buf.readUInt32LE(60);
  const difatStart = buf.readUInt32LE(68);
  const sector = (n: number) => buf.subarray((n + 1) * sectorSize, (n + 2) * sectorSize);

  // The FAT: sector numbers listed in the header (109) and then in the DIFAT chain.
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = buf.readUInt32LE(76 + 4 * i);
    if (s !== FREESECT) fatSectors.push(s);
  }
  for (let d = difatStart; d !== ENDOFCHAIN && d !== FREESECT; ) {
    const sec = sector(d);
    const per = sectorSize / 4 - 1;
    for (let i = 0; i < per; i++) {
      const s = sec.readUInt32LE(4 * i);
      if (s !== FREESECT) fatSectors.push(s);
    }
    d = sec.readUInt32LE(4 * per);
  }
  const fat: number[] = [];
  for (const fs of fatSectors) {
    const sec = sector(fs);
    for (let i = 0; i < sectorSize; i += 4) fat.push(sec.readUInt32LE(i));
  }
  const chain = (start: number, table: number[]): number[] => {
    const out: number[] = [];
    for (let s = start; s !== ENDOFCHAIN; s = table[s]) {
      if (s === undefined || s === FREESECT || out.length > table.length) throw new Error("corrupt .xls sector chain");
      out.push(s);
    }
    return out;
  };
  const bigStream = (start: number, size: number) => Buffer.concat(chain(start, fat).map(sector)).subarray(0, size);

  const dir = bigStream(dirStart, chain(dirStart, fat).length * sectorSize);
  let root: { start: number; size: number } | undefined;
  let found: { start: number; size: number } | undefined;
  for (let p = 0; p + 128 <= dir.length; p += 128) {
    const nameLen = dir.readUInt16LE(p + 64);
    if (nameLen < 2) continue;
    const name = dir.toString("utf16le", p, p + nameLen - 2);
    const type = dir[p + 66];
    const entry = { start: dir.readUInt32LE(p + 116), size: dir.readUInt32LE(p + 120) };
    if (type === 5) root = entry;
    else if (type === 2 && wanted.includes(name) && !found) found = entry;
  }
  if (!found) throw new Error(`.xls has no ${wanted.join(" / ")} stream`);
  if (found.size >= miniCutoff) return bigStream(found.start, found.size);

  // Small streams live in the mini stream (64-byte sectors inside the root entry's stream).
  if (!root) throw new Error(".xls has no root entry");
  const miniStream = bigStream(root.start, root.size);
  const miniFat: number[] = [];
  for (const s of chain(miniFatStart, fat)) {
    const sec = sector(s);
    for (let i = 0; i < sectorSize; i += 4) miniFat.push(sec.readUInt32LE(i));
  }
  return Buffer.concat(chain(found.start, miniFat).map((s) => miniStream.subarray(s * miniSize, (s + 1) * miniSize))).subarray(0, found.size);
}

interface Rec {
  id: number;
  data: Buffer;
}

function records(book: Buffer, from = 0): Rec[] {
  const out: Rec[] = [];
  for (let p = from; p + 4 <= book.length; ) {
    const id = book.readUInt16LE(p);
    const len = book.readUInt16LE(p + 2);
    out.push({ id, data: book.subarray(p + 4, p + 4 + len) });
    p += 4 + len;
  }
  return out;
}

const CONTINUE = 0x003c;
const EOF = 0x000a;

/** The shared string table. Strings may continue into the next CONTINUE record, where a one-byte encoding flag restarts. */
function sharedStrings(chunks: Buffer[]): string[] {
  let ci = 0;
  let pos = 8; // after the total/unique counts
  const unique = chunks[0].readUInt32LE(4);
  /** Move to the next chunk when the current one is exhausted (a CONTINUE boundary can fall between fields, never inside one). */
  const need = () => {
    while (pos >= chunks[ci].length) {
      ci++;
      pos = 0;
      if (ci >= chunks.length) throw new Error("shared string table ends early");
    }
  };
  const u8 = () => (need(), chunks[ci][pos++]);
  const u16 = () => u8() | (u8() << 8);
  const u32 = () => (u16() | (u16() << 16)) >>> 0;
  const skip = (n: number) => {
    while (n > 0) {
      if (pos >= chunks[ci].length) need();
      const take = Math.min(n, chunks[ci].length - pos);
      pos += take;
      n -= take;
    }
  };
  const out: string[] = [];
  for (let i = 0; i < unique; i++) {
    const cch = u16();
    const flags = u8();
    let wide = (flags & 1) === 1;
    const rich = (flags & 8) !== 0;
    const ext = (flags & 4) !== 0;
    const runs = rich ? u16() : 0;
    const extLen = ext ? u32() : 0;
    let s = "";
    for (let got = 0; got < cch; ) {
      if (pos >= chunks[ci].length) {
        ci++;
        pos = 0;
        if (ci >= chunks.length) throw new Error("shared string table ends early");
        wide = (chunks[ci][pos++] & 1) === 1; // a continued string restates its encoding
      }
      const left = chunks[ci].length - pos;
      const n = Math.min(cch - got, wide ? left >> 1 : left);
      if (n === 0) {
        // One byte of a 2-byte character at the end of a chunk cannot happen in valid files.
        throw new Error("shared string table: split character");
      }
      s += wide ? chunks[ci].toString("utf16le", pos, pos + 2 * n) : chunks[ci].toString("latin1", pos, pos + n);
      pos += wide ? 2 * n : n;
      got += n;
    }
    skip(4 * runs + extLen);
    out.push(s);
  }
  return out;
}

function rkValue(rk: number): number {
  let v: number;
  if (rk & 2) v = rk >> 2;
  else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE((rk & 0xfffffffc) >>> 0, 4);
    v = b.readDoubleLE(0);
  }
  return rk & 1 ? v / 100 : v;
}

const num = (n: number) => String(n);

export function readXls(file: Buffer): string[][] {
  const book = readStream(file, ["Workbook", "Book"]);
  const all = records(book);
  // Workbook globals: the shared string table and the first sheet's offset.
  let sheetStart = -1;
  let sstChunks: Buffer[] | undefined;
  for (let i = 0; i < all.length; i++) {
    const r = all[i];
    if (r.id === 0x0085 && sheetStart < 0) sheetStart = r.data.readUInt32LE(0); // BOUNDSHEET: the first sheet
    if (r.id === 0x00fc) {
      sstChunks = [r.data];
      while (all[i + 1]?.id === CONTINUE) sstChunks.push(all[++i].data);
    }
    if (r.id === EOF) break;
  }
  if (sheetStart < 0) throw new Error(".xls has no worksheet");
  const strings = sstChunks ? sharedStrings(sstChunks) : [];

  const rows: string[][] = [];
  const put = (row: number, col: number, v: string) => {
    (rows[row] ??= [])[col] = v;
  };
  const sheet = records(book, sheetStart);
  for (let i = 1; i < sheet.length; i++) {
    const { id, data } = sheet[i];
    if (id === EOF) break;
    if (id === 0x00fd) put(data.readUInt16LE(0), data.readUInt16LE(2), strings[data.readUInt32LE(6)] ?? ""); // LABELSST
    else if (id === 0x0204) {
      const n = data.readUInt16LE(6); // LABEL: BIFF8 unicode string
      const wide = (data[8] & 1) === 1;
      put(data.readUInt16LE(0), data.readUInt16LE(2), wide ? data.toString("utf16le", 9, 9 + 2 * n) : data.toString("latin1", 9, 9 + n));
    } else if (id === 0x0203) put(data.readUInt16LE(0), data.readUInt16LE(2), num(data.readDoubleLE(6))); // NUMBER
    else if (id === 0x027e) put(data.readUInt16LE(0), data.readUInt16LE(2), num(rkValue(data.readUInt32LE(6)))); // RK
    else if (id === 0x00bd) {
      const row = data.readUInt16LE(0);
      const first = data.readUInt16LE(2);
      const count = (data.length - 6) / 6;
      for (let k = 0; k < count; k++) put(row, first + k, num(rkValue(data.readUInt32LE(4 + 6 * k + 2))));
    }
  }
  return Array.from(rows, (r) => Array.from(r ?? [], (c) => c ?? ""));
}
