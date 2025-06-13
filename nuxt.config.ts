import { OgImage } from "./.nuxt/components.d";
// https://nuxt.com/docs/api/configuration/nuxt-config

import { checkEnv } from "./config/env.config";
import { env } from "node:process";

checkEnv(env);

export default defineNuxtConfig({
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
  ],
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
});
