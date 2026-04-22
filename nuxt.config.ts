import { OgImage } from "./.nuxt/components.d";
// Import polyfill early to ensure it's available before Vite initializes
import "./polyfills/crypto-hash";
// https://nuxt.com/docs/api/configuration/nuxt-config

/** PostHog Cloud: client only registers when `NUXT_PUBLIC_POSTHOG_KEY` is set (also required at `nuxt build` for inlined public config). */
const posthogEnabled = Boolean(process.env.NUXT_PUBLIC_POSTHOG_KEY?.trim());

export default defineNuxtConfig({
  vite: {
    server: {
      allowedHosts: ["localhost", "127.0.0.1", "webhook.moaad.ly", "moaad.ly", "w2svdl2ix6xq.share.zrok.io"],
      hmr: {
        clientPort: 3000,
        port: 3000,
      },
    },
  },
  devServer: {
    host: "localhost",
    // host: "0.0.0.0",
    port: 3000,
  },
  nitro: {
    experimental: {
      asyncContext: true,
    },
    devServer: {
      watch: [],
    },
  },
  compatibilityDate: "2024-04-03",
  future: { compatibilityVersion: 4 },
  devtools: { enabled: true },
  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxtjs/seo",
    "@vueuse/nuxt",
    // "@nuxt/content",
    "@formkit/nuxt",
    "nuxt-auth-utils",
    "shadcn-nuxt",
    "@nuxt/eslint",
    "radix-vue/nuxt",
    "@nuxt/image",
    "@nuxtjs/color-mode",
    "@nuxt/icon",
    "@unlighthouse/nuxt",
    // "@nuxt/fonts", // Temporarily disabled to avoid Vite CSS import.meta issue in nuxt-fonts-global.css
    "@vueuse/motion/nuxt",
    "@nuxtjs/i18n",
    "@hebilicious/vue-query-nuxt",
    ...(posthogEnabled ? ["@posthog/nuxt"] : []),
  ],
  vueQuery: {
    // useState key used by nuxt-vue-query
    stateKey: "vue-query-state",
    // Nuxt Vue Query configuration options
    queryClientOptions: {
      defaultOptions: {
        queries: {
          staleTime: 5000,
        },
      },
    },
  },
  i18n: {
    vueI18n: "./i18n.config.ts",
    locales: ["en"],
    defaultLocale: "en",
    strategy: "prefix_except_default",
  },
  formkit: {
    // autoImport: true,
    configFile: "./config/formkit.config.ts",
  },
  tailwindcss: {
    exposeConfig: true,
    editorSupport: true,
    configPath: "./config/tailwind.config.ts",
  },
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: "Ui",
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: "./app/components/ui",
  },
  colorMode: {
    classSuffix: "",
  },
  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
  ],
  site: {
    url: "https://nuxt-better-auth.giessen.dev/",
    name: "Nuxt setup with Better Auth module |  Drizzle + Nuxt + Tailwind CSS + content + FormKit",
    description:
      "How to get started with Nuxt 4 and Better Auth| Step by step tutorial.",
    defaultLocale: "en", // not needed if you have @nuxtjs/i18n installed
  },
  image: {
    quality: 75,
    format: ["webp"],
  },
  ogImage: {
    componentOptions: {
      global: true,
    },
  },
  runtimeConfig: {
    // Better Auth Google OAuth secret (server-side only)
    NUXT_GOOGLE_CLIENT_SECRET: process.env.NUXT_GOOGLE_CLIENT_SECRET,

    // Redis configuration
    redisHost: process.env.REDIS_HOST || "localhost",
    redisPort: parseInt(process.env.REDIS_PORT || "6379", 10),
    redisPassword: process.env.REDIS_PASSWORD || "",

    DRIVE_WEBHOOK_BASE_URL: process.env.DRIVE_WEBHOOK_BASE_URL,

    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    twilioWebhookSecret: "",
    // Optional: API Key for access tokens (more secure than using Auth Token)
    twilioApiKeySid: "",
    twilioApiKeySecret: "",
    // Optional: TwiML App SID (if using TwiML App)
    twilioAppSid: "",

    // Stripe configuration (server-side only)
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

    // NOWPayments configuration (server-side only)
    nowpaymentsApiKey: '',
    nowpaymentsIpnSecret: '',
    nowpaymentsBaseUrl: '',

    // Call profit margin (server-side only)
    CALL_PROFIT_MARGIN: parseFloat(process.env.CALL_PROFIT_MARGIN || "0.50"),
    twilioWebhookBaseUrl: "",

    // Public config (exposed to the client)
    public: {
      GOOGLE_CLIENT_ID: process.env.NUXT_GOOGLE_CLIENT_ID,
      // Stripe publishable key (safe to expose to client)
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,

      // Base URL for webhooks and API endpoints (safe to expose)
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,

      // Twilio region for Voice SDK (safe to expose)
      TWILIO_REGION: process.env.TWILIO_REGION,
    },
  },

  ...(posthogEnabled
    ? {
        posthogConfig: {
          publicKey: process.env.NUXT_PUBLIC_POSTHOG_KEY!,
          host:
            process.env.NUXT_PUBLIC_POSTHOG_HOST?.trim() ||
            "https://us.i.posthog.com",
        },
      }
    : {}),
});
