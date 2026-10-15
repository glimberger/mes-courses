import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export type Member = {
  name: string;
  content?: string;
  /** Present for a symbolic link. */
  link?: string;
};

const field = (value: string, length: number) => {
  const buffer = Buffer.alloc(length);
  buffer.write(value);
  return buffer;
};

const octal = (value: number, length: number) =>
  field(value.toString(8).padStart(length - 1, '0'), length);

/** A header block; written by hand so that tests can make members `tar -c` would refuse. */
const header = (member: Member): Buffer => {
  const size = member.link ? 0 : Buffer.byteLength(member.content ?? '');
  const block = Buffer.alloc(512);
  field(member.name, 100).copy(block, 0);
  octal(0o644, 8).copy(block, 100);
  octal(0, 8).copy(block, 108);
  octal(0, 8).copy(block, 116);
  octal(size, 12).copy(block, 124);
  octal(0, 12).copy(block, 136);
  block.fill(0x20, 148, 156);
  block.write(member.link ? '2' : '0', 156);
  if (member.link) field(member.link, 100).copy(block, 157);
  block.write('ustar\0', 257);
  block.write('00', 263);
  const sum = [...block].reduce((a, b) => a + b, 0);
  block.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return block;
};

/** Writes a `.tar.gz` of the members and returns its SHA-256. */
export const writeArchive = (file: string, members: Member[]): string => {
  const parts: Buffer[] = [];
  for (const member of members) {
    parts.push(header(member));
    if (!member.link && member.content) {
      const data = Buffer.from(member.content);
      parts.push(data, Buffer.alloc((512 - (data.length % 512)) % 512));
    }
  }
  parts.push(Buffer.alloc(1024));
  const gzip = gzipSync(Buffer.concat(parts));
  writeFileSync(file, gzip);
  return createHash('sha256').update(gzip).digest('hex');
};
