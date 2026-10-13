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
      spacing: {
        "layout-1": "var(--space-1)",
        "layout-2": "var(--space-2)",
        "layout-3": "var(--space-3)",
        "layout-4": "var(--space-4)",
        "layout-6": "var(--space-6)",
        "layout-8": "var(--space-8)",
      },
      zIndex: {
        content: "var(--z-content)",
        sticky: "var(--z-sticky)",
        "bottom-nav": "var(--z-bottom-nav)",
        "floating-back": "var(--z-floating-back)",
        toast: "var(--z-toast)",
        "overlay-menu": "var(--z-overlay-menu)",
        modal: "var(--z-modal)",
      },
    },
  },
  plugins: [],
};

export default config;
