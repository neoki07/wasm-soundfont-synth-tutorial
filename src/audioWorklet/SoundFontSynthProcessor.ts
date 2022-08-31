import "./TextEncoder.js";

import init, { WasmSoundFontSynth } from "./pkg/wasm_src";
import soundFontPath from "../../testdata/A320U.sf2?url";

class SoundFontSynthProcessor extends AudioWorkletProcessor {
  samples: any;
  totalSamples: any;
  detector: any;
  numAudioSamplesPerAnalysis: any;
  synth: WasmSoundFontSynth | undefined;
  sf2Bytes: any;

  constructor() {
    super();

    // Listen to events from the PitchNode running on the main thread.
    this.port.onmessage = (event) => this.onmessage(event.data);

    this.synth = undefined;
    this.sf2Bytes = undefined;
  }

  onmessage(event: any) {
    if (event.type === "send-wasm-module") {
      init(WebAssembly.compile(event.wasmBytes)).then(() => {
        this.port.postMessage({ type: "wasm-module-loaded" });
      });
      this.sf2Bytes = event.sf2Bytes;
      console.log("this.sf2Bytes:", this.sf2Bytes);
    } else if (event.type === "init-detector") {
      const { sampleRate } = event;

      if (!this.sf2Bytes) {
        console.warn("sf2Bytes is undefined");
      }

      this.synth = WasmSoundFontSynth.new(new Uint8Array(this.sf2Bytes));
    } else if (event.type === "send-note-on-event") {
      if (!this.synth) return;
      this.synth.note_on(event.channel, event.key, event.vel);
    } else if (event.type === "send-note-off-event") {
      if (!this.synth) return;
      this.synth.note_off(event.channel, event.key);
    }
  }

  process(
    _inputs: Array<Array<Float32Array>>,
    outputs: Array<Array<Float32Array>>
  ): boolean {
    if (!this.synth) return true;

    const outputChannels = outputs[0];
    const blockSize = outputChannels[0].length;

    let next_block = this.synth.read_next_block(blockSize);
    outputChannels[0].set(next_block[0]);
    outputChannels.length > 1 && outputChannels[1].set(next_block[1]);

    // Returning true tells the Audio system to keep going.
    return true;
  }
}

registerProcessor("SoundFontSynthProcessor", SoundFontSynthProcessor);
