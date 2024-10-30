// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  future: { compatibilityVersion: 4 },
  devtools: { enabled: true },
  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxtjs/seo",
    "@vueuse/nuxt",
    "@nuxt/content",
    "@formkit/nuxt",
    "nuxt-auth-utils",
    "shadcn-nuxt",
    "@nuxt/eslint",
    "radix-vue/nuxt",
    "@nuxt/image",
    "@nuxtjs/color-mode",
    "@nuxt/icon"
  ],
  formkit: {
    // autoImport: true,
    configFile: './config/formkit.config.ts',
  },
  tailwindcss: {
    exposeConfig: true,
    editorSupport: true,
    configPath: "./config/tailwind.config.ts"
  },
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: './app/components/ui'
  },
  colorMode: {
    classSuffix: ''
  }
})