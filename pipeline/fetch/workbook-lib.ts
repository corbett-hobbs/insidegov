import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Spreadsheet readers for the fetch stage: every sheet of a workbook as rows of cell strings, by
 * position. Two formats, no dependency:
 *   - `.xlsx` (Office Open XML): read with `unzip` on PATH;
 *   - `.xls` (Excel 97–2003 BIFF8, and BIFF5 as Excel 95 wrote it), inside an OLE compound file:
 *     read directly. DHS's Yearbook of Immigration Statistics publishes its tables as `.xls`
 *     before the FY2017 edition.
 * Values are what the cell displays as data: shared/inline strings, numbers (integers without a
 * decimal point), cached formula results. Formatting, merged ranges and hidden state are ignored.
 */

export interface SheetRow {
  /** 1-based Excel row number. */
  row: number;
  /** Cell text by 0-based column; "" for an empty cell between two filled ones. */
  cells: string[];
}

export interface Sheet {
  name: string;
  rows: SheetRow[];
}

const xmlEntities = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Column letters -> zero-based index ("A" -> 0, "AB" -> 27). */
export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Zero-based index -> column letters (0 -> "A", 27 -> "AB"). */
export function columnLetters(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function trimRow(cells: string[]): string[] {
  while (cells.length && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

// ---------------------------------------------------------------- .xlsx

/** Every sheet of an .xlsx, in workbook order. */
export function readXlsx(path: string): Sheet[] {
  const unzip = (member: string) => execFileSync("unzip", ["-p", path, member], { maxBuffer: 1 << 26 }).toString("utf8");
  const strings = [...unzip("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    xmlEntities([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const rels = new Map(
    [...unzip("xl/_rels/workbook.xml.rels").matchAll(/<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
  const sheets: Sheet[] = [];
  for (const s of unzip("xl/workbook.xml").matchAll(/<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
    const target = rels.get(s[2]);
    if (!target) throw new Error(`${path}: sheet "${s[1]}" has no relationship target`);
    const xml = unzip(`xl/${target.replace(/^\/?xl\//, "")}`);
    const rows: SheetRow[] = [];
    let implicitRow = 0;
    for (const row of xml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
      const r = Number(row[1].match(/\br="(\d+)"/)?.[1] ?? implicitRow + 1);
      implicitRow = r;
      const cells: string[] = [];
      for (const c of row[2].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = c[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? c[2]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
        if (v === undefined) continue;
        const ref = c[1].match(/r="([A-Z]+)\d+"/)?.[1];
        const at = ref ? columnIndex(ref) : cells.length;
        while (cells.length < at) cells.push("");
        cells[at] = clean(/t="s"/.test(c[1]) ? strings[Number(v)] : xmlEntities(v));
      }
      if (trimRow(cells).some((c) => c !== "")) rows.push({ row: r, cells });
    }
    sheets.push({ name: xmlEntities(s[1]), rows });
  }
  return sheets;
}

// ---------------------------------------------------------------- .xls (OLE compound file + BIFF)

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

/** The named stream of an OLE compound file (MS-CFB), e.g. "Workbook". */
export function cfbStream(buf: Buffer, wanted: readonly string[]): Buffer {
  if (buf.readUInt32LE(0) !== 0xe011cfd0 || buf.readUInt32LE(4) !== 0xe11ab1a1) throw new Error("not an OLE compound file");
  const sectorSize = 1 << buf.readUInt16LE(0x1e);
  const miniSize = 1 << buf.readUInt16LE(0x20);
  const dirStart = buf.readUInt32LE(0x30);
  const cutoff = buf.readUInt32LE(0x38);
  const miniFatStart = buf.readUInt32LE(0x3c);
  let difatNext = buf.readUInt32LE(0x44);
  const sector = (n: number) => buf.subarray((n + 1) * sectorSize, (n + 2) * sectorSize);

  // FAT sector list: 109 entries in the header, then the DIFAT chain.
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) fatSectors.push(buf.readUInt32LE(0x4c + i * 4));
  for (let guard = 0; difatNext !== ENDOFCHAIN && difatNext !== FREESECT && guard < 1 << 16; guard++) {
    const s = sector(difatNext);
    for (let i = 0; i < sectorSize / 4 - 1; i++) fatSectors.push(s.readUInt32LE(i * 4));
    difatNext = s.readUInt32LE(sectorSize - 4);
  }
  const fat: number[] = [];
  for (const fs of fatSectors) {
    if (fs === FREESECT || fs === ENDOFCHAIN) continue;
    const s = sector(fs);
    for (let i = 0; i < sectorSize / 4; i++) fat.push(s.readUInt32LE(i * 4));
  }
  const chain = (start: number, next: readonly number[]): number[] => {
    const out: number[] = [];
    for (let n = start; n !== ENDOFCHAIN && n !== FREESECT; n = next[n]) {
      if (out.length > next.length) throw new Error("compound file: sector chain loops");
      out.push(n);
    }
    return out;
  };
  const read = (start: number) => Buffer.concat(chain(start, fat).map(sector));

  const dir = read(dirStart);
  const entries: { name: string; type: number; start: number; size: number }[] = [];
  for (let off = 0; off + 128 <= dir.length; off += 128) {
    const nameLen = dir.readUInt16LE(off + 0x40);
    entries.push({
      name: dir.toString("utf16le", off, off + Math.max(0, nameLen - 2)),
      type: dir[off + 0x42],
      start: dir.readUInt32LE(off + 0x74),
      size: dir.readUInt32LE(off + 0x78),
    });
  }
  const entry = entries.find((e) => e.type === 2 && wanted.includes(e.name));
  if (!entry) throw new Error(`compound file has no ${wanted.join("/")} stream (streams: ${entries.filter((e) => e.type === 2).map((e) => e.name).join(", ")})`);
  if (entry.size >= cutoff) return read(entry.start).subarray(0, entry.size);
  // Small streams live in the mini stream (the root entry's data), addressed through the mini FAT.
  const miniFatBuf = read(miniFatStart);
  const miniFat: number[] = [];
  for (let i = 0; i + 4 <= miniFatBuf.length; i += 4) miniFat.push(miniFatBuf.readUInt32LE(i));
  const ministream = read(entries[0].start);
  return Buffer.concat(chain(entry.start, miniFat).map((n) => ministream.subarray(n * miniSize, (n + 1) * miniSize))).subarray(0, entry.size);
}

/** RK number: a 30-bit integer or the top 30 bits of an IEEE double, optionally scaled by 1/100. */
function rkValue(rk: number): number {
  let v: number;
  if (rk & 2) v = rk >> 2;
  else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(rk & 0xfffffffc, 4);
    v = b.readDoubleLE(0);
  }
  return rk & 1 ? v / 100 : v;
}

const numText = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1e9) / 1e9));

/**
 * A BIFF record stream's bytes with record boundaries kept, so strings that run into CONTINUE
 * records can be read (BIFF8 restarts the character run with a fresh option byte at each boundary).
 */
class Continued {
  pos = 0;
  constructor(
    private readonly data: Buffer,
    private readonly boundaries: readonly number[],
  ) {}
  u8() {
    return this.data[this.pos++];
  }
  u16() {
    const v = this.data.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  u32() {
    const v = this.data.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  skip(n: number) {
    this.pos += n;
  }
  /** `cch` characters starting with option byte `flags`; a record boundary inside restarts with a new option byte. */
  chars(cch: number, flags: number): string {
    let out = "";
    let wide = (flags & 1) === 1;
    while (cch > 0) {
      const boundary = this.boundaries.find((b) => b > this.pos) ?? this.data.length;
      const avail = Math.floor((boundary - this.pos) / (wide ? 2 : 1));
      const n = Math.min(cch, avail);
      out += wide ? this.data.toString("utf16le", this.pos, this.pos + n * 2) : this.data.toString("latin1", this.pos, this.pos + n);
      this.pos += n * (wide ? 2 : 1);
      cch -= n;
      if (cch > 0) wide = (this.u8() & 1) === 1;
    }
    return out;
  }
}

/** BIFF8 XLUnicodeRichExtendedString (an SST entry). */
function sstString(r: Continued): string {
  const cch = r.u16();
  const flags = r.u8();
  const runs = flags & 8 ? r.u16() : 0;
  const ext = flags & 4 ? r.u32() : 0;
  const s = r.chars(cch, flags);
  r.skip(runs * 4 + ext);
  return s;
}

/** Every sheet of a BIFF8 (Excel 97–2003) or BIFF5 (Excel 95) workbook (a path or the file's bytes), in workbook order. */
export function readXls(file: string | Buffer): Sheet[] {
  const path = typeof file === "string" ? file : "workbook";
  const stream = cfbStream(typeof file === "string" ? readFileSync(file) : file, ["Workbook", "Book"]);
  const records: { type: number; off: number; len: number }[] = [];
  for (let off = 0; off + 4 <= stream.length; ) {
    const type = stream.readUInt16LE(off);
    const len = stream.readUInt16LE(off + 2);
    records.push({ type, off: off + 4, len });
    off += 4 + len;
  }
  const data = (i: number) => stream.subarray(records[i].off, records[i].off + records[i].len);
  if (records[0]?.type !== 0x0809) throw new Error(`${path}: no BIFF BOF record`);
  const biff8 = data(0).readUInt16LE(0) === 0x0600;

  // Workbook globals: the shared string table and the sheet list.
  let sst: string[] = [];
  const bound: { name: string; pos: number; dt: number }[] = [];
  for (let i = 0; i < records.length && records[i].type !== 0x000a; i++) {
    const rec = records[i];
    if (rec.type === 0x0085) {
      const d = data(i);
      const pos = d.readUInt32LE(0);
      const dt = d[5];
      const cch = d[6];
      const name = biff8 ? (d[7] & 1 ? d.toString("utf16le", 8, 8 + cch * 2) : d.toString("latin1", 8, 8 + cch)) : d.toString("latin1", 7, 7 + cch);
      bound.push({ name, pos, dt });
    } else if (rec.type === 0x00fc) {
      const parts = [data(i)];
      const boundaries: number[] = [];
      let size = parts[0].length;
      for (let j = i + 1; records[j]?.type === 0x003c; j++) {
        boundaries.push(size);
        parts.push(data(j));
        size += records[j].len;
      }
      const r = new Continued(Buffer.concat(parts), boundaries);
      r.skip(4);
      const unique = r.u32();
      sst = [];
      for (let k = 0; k < unique; k++) sst.push(sstString(r));
    }
  }

  const sheets: Sheet[] = [];
  for (const b of bound.filter((x) => x.dt === 0)) {
    const start = records.findIndex((r) => r.off - 4 === b.pos);
    if (start < 0) throw new Error(`${path}: sheet "${b.name}" BOF not found`);
    const cells = new Map<number, string[]>();
    const put = (row: number, col: number, v: string) => {
      const r = cells.get(row) ?? [];
      while (r.length < col) r.push("");
      r[col] = clean(v);
      cells.set(row, r);
    };
    let pendingFormula: { row: number; col: number } | null = null;
    for (let i = start + 1; i < records.length && records[i].type !== 0x000a; i++) {
      const d = data(i);
      switch (records[i].type) {
        case 0x00fd: // LABELSST
          put(d.readUInt16LE(0), d.readUInt16LE(2), sst[d.readUInt32LE(6)] ?? "");
          break;
        case 0x0203: // NUMBER
          put(d.readUInt16LE(0), d.readUInt16LE(2), numText(d.readDoubleLE(6)));
          break;
        case 0x027e: // RK
          put(d.readUInt16LE(0), d.readUInt16LE(2), numText(rkValue(d.readUInt32LE(6))));
          break;
        case 0x00bd: {
          // MULRK
          const row = d.readUInt16LE(0);
          const first = d.readUInt16LE(2);
          const n = (d.length - 6) / 6;
          for (let k = 0; k < n; k++) put(row, first + k, numText(rkValue(d.readUInt32LE(4 + k * 6 + 2))));
          break;
        }
        case 0x0204: // LABEL
        case 0x00d6: {
          // RSTRING (BIFF5)
          const cch = d.readUInt16LE(6);
          const s = biff8 ? (d[8] & 1 ? d.toString("utf16le", 9, 9 + cch * 2) : d.toString("latin1", 9, 9 + cch)) : d.toString("latin1", 8, 8 + cch);
          put(d.readUInt16LE(0), d.readUInt16LE(2), s);
          break;
        }
        case 0x0006: {
          // FORMULA: cached result; a string result follows in a STRING record.
          const row = d.readUInt16LE(0);
          const col = d.readUInt16LE(2);
          if (d.readUInt16LE(12) !== 0xffff) put(row, col, numText(d.readDoubleLE(6)));
          else if (d[6] === 0) pendingFormula = { row, col };
          break;
        }
        case 0x0207: // STRING (formula result)
          if (pendingFormula) {
            const cch = d.readUInt16LE(0);
            put(pendingFormula.row, pendingFormula.col, biff8 ? (d[2] & 1 ? d.toString("utf16le", 3, 3 + cch * 2) : d.toString("latin1", 3, 3 + cch)) : d.toString("latin1", 2, 2 + cch));
            pendingFormula = null;
          }
          break;
      }
    }
    const rows = [...cells.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([row, c]) => ({ row: row + 1, cells: trimRow(c.map((x) => x ?? "")) }))
      .filter((r) => r.cells.some((c) => c !== ""));
    sheets.push({ name: b.name, rows });
  }
  return sheets;
}

// ---------------------------------------------------------------- text extracts

/**
 * `## sheet: <name>` followed by one line per non-empty row. Cells keep their column position
 * (`a |  | c`). With `rowNumbers`, each line starts with the Excel row number and a tab, so a
 * transform can cite the exact cell a value came from.
 */
export function sheetsToText(sheets: readonly Sheet[], opts: { rowNumbers?: boolean } = {}): string {
  const out: string[] = [];
  for (const s of sheets) {
    out.push(`## sheet: ${s.name}`);
    for (const r of s.rows) out.push(`${opts.rowNumbers ? `${r.row}\t` : ""}${r.cells.join(" | ")}`);
  }
  return out.join("\n") + "\n";
}
