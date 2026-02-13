import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: false,
  clean: true,
  target: "node18",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
