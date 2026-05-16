import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path must match GitHub repo name for Pages
export default defineConfig({
  plugins: [react()],
  base: "/shop-expense-tracker-/",
});
