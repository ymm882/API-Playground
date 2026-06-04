import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#090b12",
        panel: "rgba(18, 23, 38, 0.78)",
        aurora: "#42d9b8",
        comet: "#f5c76b",
        nebula: "#a78bfa"
      },
      boxShadow: {
        glow: "0 0 36px rgba(66, 217, 184, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
