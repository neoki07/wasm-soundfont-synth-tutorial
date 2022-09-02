mod utils;

use std::io::Cursor;

use oxisynth::{MidiEvent, SoundFont, SoundFontId, Synth};
use pitch_detection::detector::{mcleod::McLeodDetector, PitchDetector};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmPitchDetector {
    sample_rate: usize,
    fft_size: usize,
    detector: McLeodDetector<f32>,
}

#[wasm_bindgen]
impl WasmPitchDetector {
    pub fn new(sample_rate: usize, fft_size: usize) -> WasmPitchDetector {
        utils::set_panic_hook();

        let fft_pad = fft_size / 2;

        WasmPitchDetector {
            sample_rate,
            fft_size,
            detector: McLeodDetector::<f32>::new(fft_size, fft_pad),
        }
    }

    pub fn detect_pitch(&mut self, audio_samples: Vec<f32>) -> f32 {
        if audio_samples.len() < self.fft_size {
            panic!("Insufficient samples passed to detect_pitch(). Expected an array containing {} elements but got {}", self.fft_size, audio_samples.len())
        }

        // Include only notes that exceed a power threshold which relates to the
        // amplitude of frequencies in the signal. Use the suggested default
        // value of 5.0 from the library.
        const POWER_THRESHOLD: f32 = 5.0;

        // The clarity measure describes how coherent the sound of a note is. For
        // example, the background sound in a crowded room would typically be would
        // have low clarity and a ringing tuning fork would have high clarity.
        // This threshold is used to accept detect notes that are clear enough
        // (valid values are in the range 0-1).
        const CLARITY_THRESHOLD: f32 = 0.6;

        let optional_pitch = self.detector.get_pitch(
            &audio_samples,
            self.sample_rate,
            POWER_THRESHOLD,
            CLARITY_THRESHOLD,
        );

        match optional_pitch {
            Some(pitch) => pitch.frequency,
            None => 0.0,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct SerializablePresetHeader {
    /// The name of the preset
    pub name: String,
    /// The MIDI preset number which to apply to the preset.
    pub preset: u16,
    /// The preset bank
    pub bank: u16,
    pub bag_id: u16,

    /// Reserved?
    pub library: u32,
    /// Reserved?
    pub genre: u32,
    /// Reserved?
    pub morphology: u32,
}

#[wasm_bindgen]
pub struct WasmSoundFontSynth {
    synth: Synth,
    font_id: SoundFontId,
    preset_headers: Vec<SerializablePresetHeader>,
}

#[wasm_bindgen]
impl WasmSoundFontSynth {
    pub fn new(soundfont_bytes: &[u8]) -> WasmSoundFontSynth {
        utils::set_panic_hook();

        let mut synth = Synth::default();
        let mut cur = Cursor::new(soundfont_bytes);
        let font = SoundFont::load(&mut cur).unwrap();
        let font_id = synth.add_font(font, true);

        let sf2 = soundfont::SoundFont2::load(&mut cur).unwrap();
        let mut preset_headers = sf2
            .presets
            .iter()
            .map(|p| SerializablePresetHeader {
                name: p.header.name.clone(),
                preset: p.header.preset,
                bank: p.header.bank,
                bag_id: p.header.bag_id,
                library: p.header.library,
                genre: p.header.genre,
                morphology: p.header.morphology,
            })
            .collect::<Vec<SerializablePresetHeader>>();
        preset_headers.sort_by(|a, b| a.bank.cmp(&b.bank).then(a.preset.cmp(&b.preset)));

        WasmSoundFontSynth {
            synth,
            font_id,
            preset_headers,
        }
    }

    pub fn get_preset_headers(&self) -> JsValue {
        JsValue::from_serde(&self.preset_headers).unwrap()
    }

    pub fn program_select(&mut self, chan: u8, bank_num: u32, preset_num: u8) {
        self.synth
            .program_select(chan, self.font_id, bank_num, preset_num)
            .ok();
    }

    pub fn note_on(&mut self, channel: u8, key: u8, vel: u8) {
        self.synth
            .send_event(MidiEvent::NoteOn { channel, key, vel })
            .ok();
    }

    pub fn note_off(&mut self, channel: u8, key: u8) {
        self.synth
            .send_event(MidiEvent::NoteOff { channel, key })
            .ok();
    }

    pub fn read_next_block(&mut self, block_size: usize) -> JsValue {
        let mut out = vec![
            Vec::with_capacity(block_size),
            Vec::with_capacity(block_size),
        ];

        for _ in 0..block_size {
            let (l, r) = self.synth.read_next();
            out[0].push(l);
            out[1].push(r);
        }

        JsValue::from_serde(&out).unwrap()
    }
}
