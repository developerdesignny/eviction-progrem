import type { Config } from '@netlify/functions';
import serverless from 'serverless-http';
import { app } from '../../src/server/app';
import { ensureFirstUser } from '../../src/server/firstUser';

/**
 * Hosts the whole Express API as one Netlify Function at /api/*.
 *
 * Netlify hands us a web-standard Request; serverless-http speaks the AWS Lambda event
 * shape, so this file translates between the two. Routes, middleware and Prisma are
 * untouched; the client still calls /api/... on the same origin, so the httpOnly cookie
 * works without CORS.
 *
 * Migrations are NOT run here: the build applies them (scripts/netlify-build.mjs)
 * before the deploy goes live, so a request never meets an out-of-date schema.
 */

// `binary: true` makes serverless-http base64-encode every response body, so file
// downloads (PDFs, images) and JSON are decoded the same way below.
const handler = serverless(app, { binary: true });

// Once per function instance (cold start): create the first user if the database has
// none. A failure is retried on the next request rather than poisoning the instance.
let ready: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  if (!ready) {
    ready = ensureFirstUser().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

interface LambdaResult {
  statusCode: number;
  headers?: Record<string, string | number | boolean>;
  multiValueHeaders?: Record<string, Array<string | number | boolean>>;
  body?: string;
  isBase64Encoded?: boolean;
}

export default async (req: Request) => {
  try {
    await ensureReady();
  } catch (error) {
    console.error('First-user check failed:', error);
    return Response.json({ error: 'Database is not ready' }, { status: 503 });
  }

  const url = new URL(req.url);

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  // Express reads the original scheme from here (trust proxy is on) to decide whether
  // the auth cookie is marked Secure. Netlify always terminates TLS, so this is https.
  headers['x-forwarded-proto'] ??= url.protocol.replace(':', '');

  const queryStringParameters: Record<string, string> = {};
  const multiValueQueryStringParameters: Record<string, string[]> = {};
  url.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
    (multiValueQueryStringParameters[key] ??= []).push(value);
  });

  const body = Buffer.from(await req.arrayBuffer());

  const event = {
    httpMethod: req.method,
    path: url.pathname,
    headers,
    queryStringParameters,
    multiValueQueryStringParameters,
    body: body.length > 0 ? body : undefined,
    isBase64Encoded: false,
  };

  const result = (await handler(event, {})) as LambdaResult;

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(result.headers ?? {})) {
    responseHeaders.append(key, String(value));
  }
  for (const [key, values] of Object.entries(result.multiValueHeaders ?? {})) {
    for (const value of values) responseHeaders.append(key, String(value));
  }
  // Hop-by-hop headers belong to Node's HTTP server, not to a function response.
  responseHeaders.delete('transfer-encoding');
  responseHeaders.delete('connection');
  responseHeaders.delete('keep-alive');

  const responseBody = result.body
    ? result.isBase64Encoded
      ? Buffer.from(result.body, 'base64')
      : result.body
    : null;

  return new Response(responseBody, { status: result.statusCode, headers: responseHeaders });
};

export const config: Config = {
  path: ['/api', '/api/*'],
};
