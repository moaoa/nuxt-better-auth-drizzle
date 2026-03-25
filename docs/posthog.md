# PostHog (Cloud)

This app uses [`@posthog/nuxt`](https://posthog.com/docs/libraries/nuxt-js). The module loads only when `NUXT_PUBLIC_POSTHOG_KEY` is set.

## PostHog Cloud (current setup)

1. Create a project at [PostHog Cloud US](https://us.posthog.com/signup) or [EU](https://eu.posthog.com/signup).
2. In **Project settings**, copy the **Project API key** (starts with `phc_`).
3. Set in `.env`:

   - `NUXT_PUBLIC_POSTHOG_KEY` — required.
   - `NUXT_PUBLIC_POSTHOG_HOST` — optional; defaults to **`https://us.i.posthog.com`**. Use **`https://eu.i.posthog.com`** for the EU region.

4. Restart the dev server. Use `usePostHog()` in components (see PostHog’s Nuxt docs). Call `identify` after login when you want user-linked analytics.

**Production Docker:** `NUXT_PUBLIC_*` values are inlined at build time. Pass `NUXT_PUBLIC_POSTHOG_KEY` and, if needed, `NUXT_PUBLIC_POSTHOG_HOST` as build args (see `Dockerfile.prod`).

## Optional: server-side events

For events from Nitro routes, use [`posthog-node`](https://posthog.com/docs/libraries/node) (see PostHog’s Nuxt docs, “Usage on the server side”).

## Optional: reverse proxy

PostHog documents [reverse proxies](https://posthog.com/docs/advanced/proxy) to reduce ad-blocker impact; PostHog Cloud includes a [managed proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy) option.

## Self-hosting later (not in use now)

If you move off Cloud, self-hosted PostHog is a **multi-container** stack (not merged into this repo’s `docker-compose.yml`). See the official [hobby deploy](https://posthog.com/docs/self-host/deploy/hobby). Then set `NUXT_PUBLIC_POSTHOG_HOST` to your instance URL.
