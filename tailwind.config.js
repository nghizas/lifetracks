/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lifetracks tokens — calm-over-complete palette
        ink: "#0f1217",
        muted: "#6b7280",
        canvas: "#fafafa",
        playhead: "#e11d48",
        snug: "#eab308",
        overload: "#dc2626",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
