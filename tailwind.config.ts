import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        panel: "#f7f8fb",
        line: "#d9dee8",
        accent: "#0f766e"
      }
    }
  },
  plugins: []
};

export default config;
