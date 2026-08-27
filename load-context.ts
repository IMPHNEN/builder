import { type PlatformProxy } from 'wrangler';

type Cloudflare = Omit<PlatformProxy<Env>, 'dispose'>;

/**
 * Cloudflare bindings on the load context. Optional: present only when running
 * under the Cloudflare adapter (wrangler / Pages). The Node adapter leaves this
 * undefined, and no app code depends on it (provider keys are client-persisted).
 */
declare module '@remix-run/node' {
  interface AppLoadContext {
    cloudflare?: Cloudflare;
  }
}
