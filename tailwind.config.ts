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
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        white: "rgb(var(--c-white) / <alpha-value>)",
        black: "rgb(var(--c-black) / <alpha-value>)",
        cyan: "#42e8e0",
        gold: "#d9b74a",
        night: "#8fa6ff",
        voice: "#7fd88f",
        port: "#ffd75e",
        wire: "#d9a63f",
        onorange: "#1a0f05", // dark text on orange buttons
        panel: "#0b1020", // opaque dropdown/option background
      },
      fontFamily: {
        sans: ["Poppins", "sans-serif"],
        hand: ["Caveat", "cursive"],
        mono: ["JetBrains Mono", "monospace"],
      },
      // Type scale: the ONLY font sizes the UI should use (rem; html is 106.25%).
      fontSize: {
        nano: "0.58rem", // chart ticks, tiny badges
        micro: "0.62rem", // mono caps labels, column headers
        label: "0.68rem", // buttons, tags, status chips
        caption: "0.74rem", // hints, meta, secondary info
        small: "0.8rem", // compact body, table rows, form fields
        body: "0.86rem", // default UI text
        lead: "0.92rem", // card titles, emphasis
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
} satisfies Config;
