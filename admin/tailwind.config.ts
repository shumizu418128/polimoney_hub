import { type Config } from "tailwindcss";
import daisyui from "daisyui";

export default {
  content: [
    "{routes,islands,components}/**/*.{ts,tsx,js,jsx}",
  ],
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        admin: {
          "primary": "#2e7d32",
          "primary-content": "#ffffff",
          "secondary": "#1e5128",
          "secondary-content": "#ffffff",
          "accent": "#4caf50",
          "accent-content": "#ffffff",
          "neutral": "#1f2937",
          "neutral-content": "#f3f4f6",
          "base-100": "#ffffff",
          "base-200": "#f9fafb",
          "base-300": "#f3f4f6",
          "base-content": "#1f2937",
          "info": "#3b82f6",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
      "light",
      "dark",
    ],
  },
} satisfies Config;
