import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        bg: "rgb(var(--background-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised-rgb) / <alpha-value>)",
        border: "var(--border)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        text: "rgb(var(--foreground-rgb) / <alpha-value>)",
        muted: "var(--muted)",
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
        "primary-foreground": "rgb(var(--primary-foreground-rgb) / <alpha-value>)",
        ring: "rgb(var(--ring-rgb) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          hover: "rgb(var(--primary-hover-rgb) / <alpha-value>)",
          on: "rgb(var(--primary-foreground-rgb) / <alpha-value>)",
        },
        "accent-text": "rgb(var(--accent-text-rgb) / <alpha-value>)",
        success: "rgb(var(--primary-rgb) / <alpha-value>)",
        warning: "rgb(var(--primary-rgb) / <alpha-value>)",
        danger: "rgb(var(--primary-rgb) / <alpha-value>)",
        "danger-text": "rgb(var(--foreground-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        sm: "var(--shadow-soft)",
        DEFAULT: "var(--shadow-soft)",
        md: "var(--shadow-soft)",
        lg: "var(--shadow-soft)",
        xl: "var(--shadow-soft)",
        "2xl": "var(--shadow-soft)",
      },
    },
  },
  plugins: [],
};

export default config;
