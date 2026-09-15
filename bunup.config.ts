import { defineConfig } from "bunup";

export default defineConfig({
  name: "tom-server",
  compile: {
    outfile: 'tom-server',
  },
  emitDCEAnnotations: true,
  entry: "src/main.ts",
  exports: true,
  minify: true,
  packages: "bundle",
});
