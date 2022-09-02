export default class SoundFontSynthNode extends AudioWorkletNode {
  setPresetHeaders: any;

  /**
   * Initialize the Audio processor by sending the fetched WebAssembly module to
   * the processor worklet.
   *
   * @param {ArrayBuffer} wasmBytes Sequence of bytes representing the entire
   * WASM module that will handle pitch detection.
   * @param {number} numAudioSamplesPerAnalysis Number of audio samples used
   * for each analysis. Must be a power of 2.
   */
  init(wasmBytes: any, sf2Bytes: any, setPresetHeaders: any) {
    // Listen to messages sent from the audio processor.
    this.port.onmessage = (event) => this.onmessage(event.data);

    this.port.postMessage({
      type: "send-wasm-module",
      wasmBytes,
      sf2Bytes,
    });

    this.setPresetHeaders = setPresetHeaders;
  }

  // Handle an uncaught exception thrown in the PitchProcessor.
  onprocessorerror = (err: any) => {
    console.log(
      `An error from AudioWorkletProcessor.process() occurred: ${err}`
    );
  };

  onmessage(event: any) {
    if (event.type === "wasm-module-loaded") {
      // The Wasm module was successfully sent to the PitchProcessor running on the
      // AudioWorklet thread and compiled. This is our cue to configure the pitch
      // detector.
      this.port.postMessage({
        type: "init-detector",
        sampleRate: this.context.sampleRate,
      });
    } else if (event.type === "synth-initialized") {
      this.port.postMessage({
        type: "get-preset-headers",
      });
    } else if (event.type === "preset-headers-got") {
      this.setPresetHeaders(event.presetHeaders);
    }
  }
}
