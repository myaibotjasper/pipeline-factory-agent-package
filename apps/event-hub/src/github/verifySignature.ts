import crypto from 'node:crypto';

export function verifyGithubSignature(opts: {
  secret: string;
  signatureHeader: string | undefined;
  rawBody: Buffer;
}): boolean {
  const { secret, signatureHeader, rawBody } = opts;
  if (!secret) return false;
  if (!signatureHeader) return false;

  // Expected: "sha256=<hex>"
  const [algo, theirHex] = signatureHeader.split('=');
  if (algo !== 'sha256' || !theirHex) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const oursHex = hmac.digest('hex');

  // timing-safe compare
  const a = Buffer.from(oursHex, 'hex');
  const b = Buffer.from(theirHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
