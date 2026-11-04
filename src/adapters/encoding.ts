import iconv from 'iconv-lite';

export function decode(buffer: Buffer, contentType = ''): string {
  const prefix = buffer.subarray(0, 2048).toString('ascii');
  const declared = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]
    || prefix.match(/<meta\b[^>]*charset\s*=\s*["']?([\w-]+)/i)?.[1];
  if (declared && iconv.encodingExists(declared)) return iconv.decode(buffer, declared);
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return iconv.decode(buffer, 'utf8');
  // Legacy SVUIS HTML defaults to win1256; JSON/plain text can contain raw UTF-8.
  if (/json|javascript|text\/plain/i.test(contentType)) return buffer.toString('utf8');
  return iconv.decode(buffer, 'win1256');
}

function urlEncodeWin1256(value: string): string {
  const buf = iconv.encode(value, 'win1256');
  return Array.from(buf)
    .map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
}

export function encodeForm(body: Record<string, string>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    pairs.push(`${urlEncodeWin1256(key)}=${urlEncodeWin1256(value)}`);
  }
  return pairs.join('&');
}
