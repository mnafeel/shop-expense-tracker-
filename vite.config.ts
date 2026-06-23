import { defineConfig } from "vite";

// Base path must match GitHub repo name for Pages
// Use esbuild for JSX (avoids Babel read timeouts on synced/iCloud folders)
export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  base: "/shop-expense-tracker-/",
});
