import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          50: "#e8f3ee",
          100: "#c8e3d3",
          200: "#8fc7a7",
          300: "#5aab7f",
          400: "#358e60",
          500: "#1f7148",
          600: "#175638",
          700: "#0f3d28",
          800: "#0a2c1d",
          900: "#061a11",
        },
        board: {
          50: "#f2e2c4",
          100: "#e6cc97",
          200: "#d6ad60",
          300: "#b6873a",
          400: "#8e6627",
          500: "#6b4a1a",
          600: "#523710",
          700: "#3a280b",
          800: "#241906",
          900: "#100b03",
        },
        peg: {
          red: "#d63b3b",
          redDark: "#7a1f1f",
          blue: "#2e6bd6",
          blueDark: "#1c3e7a",
          green: "#2fa14e",
          greenDark: "#185529",
          yellow: "#e0b020",
          yellowDark: "#7a5e0f",
        },
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
      animation: {
        "peg-move": "peg-move 0.5s ease-out",
        "card-flip": "card-flip 0.6s ease-in-out",
        "fade-in": "fade-in 0.3s ease-out",
        "score-pop": "score-pop 0.8s ease-out",
      },
      keyframes: {
        "peg-move": {
          "0%": { transform: "translateY(-4px) scale(1.1)" },
          "100%": { transform: "translateY(0) scale(1)" },
        },
        "card-flip": {
          "0%": { transform: "rotateY(180deg)" },
          "100%": { transform: "rotateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "score-pop": {
          "0%": { opacity: "0", transform: "translateY(0) scale(0.8)" },
          "30%": { opacity: "1", transform: "translateY(-12px) scale(1.15)" },
          "100%": { opacity: "0", transform: "translateY(-40px) scale(1)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
