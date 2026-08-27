import { PassThrough } from 'node:stream';
import type { AppLoadContext, EntryContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

const ABORT_DELAY = 5000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  const bot = isbot(request.headers.get('user-agent') || '');

  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false;

    const { pipe, abort } = renderToPipeableStream(<RemixServer context={remixContext} url={request.url} />, {
      [bot ? 'onAllReady' : 'onShellReady']() {
        shellRendered = true;

        const head = renderHeadToString({ request, remixContext, Head });

        /**
         * React renders into this intermediate stream; we concatenate the custom
         * HTML shell around it into the response body in the correct order.
         */
        const reactBody = new PassThrough();

        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();

            controller.enqueue(
              encoder.encode(
                `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
              ),
            );

            reactBody.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));

            reactBody.on('end', () => {
              controller.enqueue(encoder.encode('</div></body></html>'));
              controller.close();
            });

            reactBody.on('error', (error) => controller.error(error));
          },
          cancel() {
            reactBody.destroy();
          },
        });

        responseHeaders.set('Content-Type', 'text/html');
        responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
        responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

        resolve(
          new Response(body, {
            headers: responseHeaders,
            status: responseStatusCode,
          }),
        );

        pipe(reactBody);
      },
      onShellError(error: unknown) {
        reject(error);
      },
      onError(error: unknown) {
        responseStatusCode = 500;

        if (shellRendered) {
          console.error(error);
        }
      },
    });

    setTimeout(abort, ABORT_DELAY);
  });
}
