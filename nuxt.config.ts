import { OgImage } from "./.nuxt/components.d";
// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  vite: {
    server: {
      allowedHosts: ["localhost", "127.0.0.1", "webhook.moaad.ly", "moaad.ly"],
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
    "@nuxt/fonts",
    "@vueuse/motion/nuxt",
    "@nuxtjs/i18n",
    "@hebilicious/vue-query-nuxt",
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
  content: {
    // studio: {
    //   enabled: true
    // },
    build: {
      pathMeta: {
        forceLeadingSlash: true,
      },
      markdown: {
        highlight: {
          // Theme used in all color schemes.
          // theme: 'github-light',
          // OR
          theme: {
            // Default theme (same as single string)
            default: "github-light",
            // Theme used if `html.dark`
            dark: "monokai",
            // Theme used if `html.sepia`
            sepia: "monokai",
          },
        },
      },
    },
  },
  runtimeConfig: {
    NOTION_OAUTH_CLIENT_SECRET: process.env.NOTION_OAUTH_CLIENT_SECRET,
    GOOGLE_SHEETS_CLIENT_SECRET: process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    // Better Auth Google OAuth secret (server-side only)
    NUXT_GOOGLE_CLIENT_SECRET: process.env.NUXT_GOOGLE_CLIENT_SECRET,

    // Redis configuration
    redisHost: process.env.REDIS_HOST || "localhost",
    redisPort: parseInt(process.env.REDIS_PORT || "6379", 10),
    redisPassword: process.env.REDIS_PASSWORD || "",

    // Public config (exposed to the client)
    public: {
      NOTION_OAUTH_REDIRECT_URI: process.env.NOTION_OAUTH_REDIRECT_URI,
      NOTION_OAUTH_CLIENT_ID: process.env.NOTION_OAUTH_CLIENT_ID,
      NOTION_TOKEN_URL: process.env.NOTION_TOKEN_URL,
      NOTION_AUTH_URL: process.env.NOTION_AUTH_URL,
      NOTION_TO_GOOGLE_SHEETS_REDIRECT_URI:
        process.env.NOTION_TO_GOOGLE_SHEETS_REDIRECT_URI,
      GOOGLE_CLIENT_ID: process.env.NUXT_GOOGLE_CLIENT_ID,

      GOOGLE_SHEETS_CLIENT_ID: process.env.GOOGLE_SHEETS_CLIENT_ID,
      GOOGLE_SHEETS_REDIRECT_URI: process.env.GOOGLE_SHEETS_REDIRECT_URI,
    },
  },
});
