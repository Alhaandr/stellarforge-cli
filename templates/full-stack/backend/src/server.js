import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { URL } from 'node:url';

/**
 * Maximum request body size accepted by the backend (64 KiB).
 * Requests exceeding this bound are rejected before unbounded memory buffering.
 */
export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export function getBackendConfig(env = globalThis.process.env) {
  return {
    network: env.STELLAR_NETWORK ?? 'TESTNET',
    horizonUrl:
      env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    rpcUrl: env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    port: Number.parseInt(env.BACKEND_PORT ?? '3000', 10),
  };
}

export function createHealthPayload(env = {}) {
  const config = getBackendConfig(env);

  return {
    status: 'ok',
    app: '{{projectName}}',
    network: config.network,
  };
}

export function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'content-type': 'application/json',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

/**
 * Reads and validates a JSON request body with a strict size boundary.
 * Returns the parsed JSON payload, or null if the request was rejected.
 */
export async function readJsonBody(
  request,
  response,
  maxBytes = MAX_REQUEST_BODY_BYTES,
) {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    sendJson(response, 415, { error: 'unsupported_media_type' });
    return null;
  }

  const contentLengthHeader = request.headers['content-length'];
  if (contentLengthHeader !== undefined) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      sendJson(response, 413, { error: 'payload_too_large' });
      request.destroy();
      return null;
    }
  }

  return new Promise((resolve) => {
    let receivedBytes = 0;
    const chunks = [];
    let exceeded = false;

    request.on('data', (chunk) => {
      if (exceeded) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        exceeded = true;
        request.destroy();
        sendJson(response, 413, { error: 'payload_too_large' });
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      if (exceeded) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim().length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch {
        sendJson(response, 400, { error: 'malformed_json' });
        resolve(null);
      }
    });

    request.on('error', () => {
      if (!exceeded) {
        sendJson(response, 400, { error: 'bad_request' });
        resolve(null);
      }
    });
  });
}

export function createRequestHandler(
  env = globalThis.process.env,
  options = {},
) {
  const maxBodyBytes = Number.isFinite(options.maxBodyBytes)
    ? options.maxBodyBytes
    : MAX_REQUEST_BODY_BYTES;

  const routes = {
    '/health': {
      methods: ['GET', 'HEAD'],
      handler: (_request, response) => {
        sendJson(response, 200, createHealthPayload(env));
      },
    },
    '/api/echo': {
      methods: ['POST'],
      handler: async (request, response) => {
        const body = await readJsonBody(request, response, maxBodyBytes);
        if (body !== null) {
          sendJson(response, 200, { status: 'ok', data: body });
        }
      },
    },
    ...options.routes,
  };

  return async (request, response) => {
    const method = request.method ?? 'GET';
    const parsedUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;

    // Reject early if declared Content-Length exceeds max limit
    const contentLengthHeader = request.headers['content-length'];
    if (contentLengthHeader !== undefined) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
        sendJson(response, 413, { error: 'payload_too_large' });
        request.destroy();
        return;
      }
    }

    const route = routes[pathname];
    if (!route) {
      sendJson(response, 404, { error: 'not_found' });
      return;
    }

    if (!route.methods.includes(method)) {
      sendJson(
        response,
        405,
        { error: 'method_not_allowed' },
        { allow: route.methods.join(', ') },
      );
      return;
    }

    if (method === 'HEAD') {
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-content-type-options': 'nosniff',
      });
      response.end();
      return;
    }

    await route.handler(request, response);
  };
}

export function createBackendServer(
  env = globalThis.process.env,
  options = {},
) {
  return createServer(createRequestHandler(env, options));
}
