const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "SoundFontSynthAudioWorklet",
      formats: ["iife"],
      fileName: (format) => `sound-font-synth-audio-worklet.${format}.js`,
    },
  },
});
