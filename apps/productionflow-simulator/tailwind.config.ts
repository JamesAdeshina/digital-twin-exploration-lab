import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#10161f",
        steel: "#182231",
        ink: "#d8e2ef",
        cyanline: "#39c6d6",
      },
      boxShadow: {
        glow: "0 0 30px rgba(57, 198, 214, 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
