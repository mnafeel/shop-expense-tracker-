import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Must match GitHub repo name for Pages: https://mnafeel.github.io/shop-expense-tracker-/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/shop-expense-tracker-/",
});
