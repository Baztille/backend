// Encoding and decoding cursors for pagination

export function encodeCursor<T>(c: T) {
  return Buffer.from(JSON.stringify(c)).toString("base64");
}
export function decodeCursor<T>(s: string): T {
  return JSON.parse(Buffer.from(s, "base64").toString("utf8"));
}
