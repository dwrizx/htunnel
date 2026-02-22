import type { TunnelInstance } from "../types";

export interface TunnelProvider {
  name: string;
  start(tunnel: TunnelInstance): Promise<void>;
  stop(tunnel: TunnelInstance): Promise<void>;
}

export async function waitForUrl(
  stream: ReadableStream<Uint8Array>,
  patterns: RegExp[],
  timeoutMs = 30000,
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for tunnel URL"));
    }, timeoutMs);

    const processChunk = async () => {
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            clearTimeout(timeout);
            reject(new Error("Stream ended without finding URL"));
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          for (const pattern of patterns) {
            const match = buffer.match(pattern);
            if (match) {
              clearTimeout(timeout);
              reader.releaseLock();
              resolve(match[0]);
              return;
            }
          }
        }
      } catch (err) {
        clearTimeout(timeout);
        reader.releaseLock();
        reject(err);
      }
    };

    processChunk();
  });
}
