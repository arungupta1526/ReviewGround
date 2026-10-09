/**
 * ReviewGround - Shared Fetch Retry Utility (I1)
 * Eliminates the ~250-line duplication of try/catch + AbortSignal.timeout
 * across all provider adapters. Provides exponential back-off with jitter.
 */

/**
 * Performs an HTTP fetch with automatic retries on transient failures.
 * Uses exponential back-off with jitter (50–250ms) between attempts.
 *
 * @param url        - Request URL
 * @param init       - Standard RequestInit (method, headers, body, etc.)
 * @param retries    - How many extra attempts after the first (default 2)
 * @param timeoutMs  - AbortSignal timeout per attempt in ms (default 25000)
 * @returns          - The first successful Response
 * @throws           - Rethrows the last error when all attempts fail
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  retries = 2,
  timeoutMs = 25000
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response;
    } catch (err: unknown) {
      lastError = err;

      if (attempt < retries) {
        // Exponential back-off with jitter: 50ms, 150ms, 350ms…
        const backoffMs = 50 * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}
