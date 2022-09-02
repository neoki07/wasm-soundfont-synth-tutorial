import { useState } from "react";
import "./App.css";
import { setupAudio } from "./setupAudio";
import SoundFontSynthNode from "./audioWorklet/SoundFontSynthNode";
import { Piano, KeyboardShortcuts } from "react-piano";
import "react-piano/dist/styles.css";

const keyboardShortcuts = [
  ...KeyboardShortcuts.create({
    firstNote: 36,
    lastNote: 52,
    keyboardConfig: KeyboardShortcuts.BOTTOM_ROW,
  }),
  ...KeyboardShortcuts.create({
    firstNote: 53,
    lastNote: 71,
    keyboardConfig: KeyboardShortcuts.QWERTY_ROW,
  }),
];

function SoundFontPlayer() {
  // Ensure the latest state of the audio module is reflected in the UI
  // by defining some variables (and a setter function for updating them)
  // that are managed by React, passing their initial values to useState.

  // 1. audio is the object returned from the initial audio setup that
  //    will be used to start/stop the audio based on user input. While
  //    this is initialized once in our simple application, it is good
  //    practice to let React know about any state that _could_ change
  //    again.
  const [audio, setAudio] = useState<
    { context: AudioContext; node: SoundFontSynthNode } | undefined
  >(undefined);

  // 2. running holds whether the application is currently recording and
  //    processing audio and is used to provide button text (Start vs Stop).
  const [running, setRunning] = useState(false);

  const [presetHeaders, setPresetHeaders] = useState([]);

  // 3. latestPitch holds the latest detected pitch to be displayed in
  //    the UI.

  // Initial state. Initialize the web audio once a user gesture on the page
  // has been registered.
  if (!audio) {
    return (
      <button
        onClick={async () => {
          setAudio(await setupAudio(setPresetHeaders));
          setRunning(true);
        }}
      >
        Start
      </button>
    );
  }

  // Audio already initialized. Suspend / resume based on its current state.
  const { context, node } = audio;

  return (
    <div>
      <button
        onClick={async () => {
          if (running) {
            await context.suspend();
            setRunning(context.state === "running");
          } else {
            await context.resume();
            setRunning(context.state === "running");
          }
        }}
        disabled={context.state !== "running" && context.state !== "suspended"}
      >
        {running ? "Pause" : "Resume"}
      </button>

      <select
        onChange={(e) => {
          if (!running) return;

          const presetIndex = Number(e.target.value);
          node.port.postMessage({
            type: "program-select",
            preset_num: (presetHeaders[presetIndex] as any).preset,
            bank_num: (presetHeaders[presetIndex] as any).bank,
          });
        }}
      >
        {presetHeaders.map((presetHeader: any, index) => (
          <option key={index} value={index}>
            {index} {presetHeader.name}
          </option>
        ))}
      </select>

      <Piano
        noteRange={{ first: 36, last: 71 }}
        playNote={(midiNumber: number) => {
          if (!running) return;
          node.port.postMessage({
            type: "send-note-on-event",
            channel: 0,
            key: midiNumber,
            vel: 100,
          });
        }}
        stopNote={(midiNumber: number) => {
          if (!running) return;
          node.port.postMessage({
            type: "send-note-off-event",
            channel: 0,
            key: midiNumber,
          });
        }}
        width={1000}
        keyboardShortcuts={keyboardShortcuts}
      />
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <header className="App-header">Wasm SoundFont Synth Tutorial</header>
      <div className="App-content">
        <SoundFontPlayer />
      </div>
    </div>
  );
}

export default App;
