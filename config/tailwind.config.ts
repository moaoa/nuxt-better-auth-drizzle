import type { Config } from "tailwindcss";


export default <Partial<Config>>{
    content: [
    "./app/**/*.{vue,js,ts,jsx,tsx,md}",
    "./content/**/*.{json,yml,md}",
    "./formkit/formkit.theme.ts" 
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}