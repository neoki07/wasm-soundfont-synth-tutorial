import processorUrl from "./audioWorklet/SoundFontSynthProcessor.ts?url";
import wasmUrl from "./audioWorklet/pkg/wasm_src_bg.wasm?url";
import SoundFontSynthNode from "./audioWorklet/SoundFontSynthNode";

export async function setupAudio() {
  // Get the browser audio. Awaits user "allowing" it for the current tab.
  // const mediaStream = await getWebAudioMediaStream();

  const context = new window.AudioContext();
  // const audioSource = context.createMediaStreamSource(mediaStream);

  let node;

  try {
    // Fetch the WebAssembly module that performs pitch detection.
    const response = await window.fetch(wasmUrl);
    const wasmBytes = await response.arrayBuffer();

    // Add our audio processor worklet to the context.
    try {
      await context.audioWorklet.addModule(processorUrl);
    } catch (e: any) {
      throw new Error(
        `Failed to load audio analyzer worklet at url: ${processorUrl}. Further info: ${e.message}`
      );
    }

    // Create the AudioWorkletNode which enables the main JavaScript thread to
    // communicate with the audio processor (which runs in a Worklet).
    node = new SoundFontSynthNode(context, "SoundFontSynthProcessor");

    const sf2Url = new URL("./assets/A320U.sf2", import.meta.url);
    const sf2Response = await fetch(sf2Url);
    const sf2Bytes = await sf2Response.arrayBuffer();

    // Send the Wasm module to the audio node which in turn passes it to the
    // processor running in the Worklet thread. Also, pass any configuration
    // parameters for the Wasm detection algorithm.
    node.init(wasmBytes, sf2Bytes);

    // Connect our analysis node to the output. Required even though we do not
    // output any audio. Allows further downstream audio processing or output to
    // occur.
    node.connect(context.destination);
  } catch (err: any) {
    throw new Error(
      `Failed to load audio analyzer WASM module. Further info: ${err.message}`
    );
  }

  return { context, node };
}
