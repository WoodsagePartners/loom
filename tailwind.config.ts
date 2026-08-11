import type { Config } from "tailwindcss";

// Design tokens carried over from the-loom.html so the Next.js build matches
// the glassmorphism restyle pixel for pixel rather than reinventing it.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        orange: "#f8991d",
        burnt: "#c2571b",
        ink: "#0a1119",
        text: "#e6edf3",
        muted: "#93a5b6",
        cyan: "#42e8e0",
        gold: "#d9b74a",
        night: "#8fa6ff",
        voice: "#7fd88f",
        port: "#ffd75e",
        wire: "#d9a63f",
      },
      fontFamily: {
        sans: ["Poppins", "sans-serif"],
        hand: ["Caveat", "cursive"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
} satisfies Config;
