// @lovable.dev/vite-tanstack-config already includes the core TanStack Start, React,
// Tailwind, path aliases, and sandbox plugins. Keep the Netlify adapter as the only
// additional build/runtime integration needed for deployment.
import netlify from "@netlify/vite-plugin-tanstack-start";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  plugins: [netlify()],
  tanstackStart: {
    // Keep the custom SSR entry used by the app's error wrapper.
    server: { entry: "server" },
  },
});
