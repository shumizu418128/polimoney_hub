import { defineConfig } from "$fresh/server.ts";
import tailwind from "$fresh/plugins/tailwind.ts";

export default defineConfig({
  plugins: [tailwind()],
  server: {
    port: 3002, // polimoney: 3000, ledger: 3001, hub-admin: 3002
  },
});
