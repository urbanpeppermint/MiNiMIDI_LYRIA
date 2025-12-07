
# 🎹 MiNiMIDI LYRIA - Play and Mix Multiple AI Music Generated Loops on Spectacles 


> **AI-Powered DJ for Snap Spectacles** — Generate unique beats with Google Lyria, mix in AR

[![Lens Studio](https://img.shields.io/badge/Lens%20Studio-5.x-FFFC00?style=for-the-badge&logo=snapchat&logoColor=black)](https://lensstudio.snapchat.com/)
[![Spectacles](https://img.shields.io/badge/Spectacles-2024-00D4AA?style=for-the-badge)](https://www.spectacles.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<p align="center">
  <img src="Media/banner.png" alt="MiNiMIDI LYRIA Banner" width="100%">
</p>

---

## 🎬 Demo

<p align="center">
  <a href="https://youtu.be/WdkZOLbd4og">
    <img src="Media/demo.gif" alt="MiNiMIDI LYRIA Demo" width="600">
  </a>
  <br><br>
  <a href="https://youtu.be/WdkZOLbd4og">
    <img src="https://img.shields.io/badge/▶_Watch_Full_Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch Demo">
  </a>
</p>

---

An AR music creation experience for Snap Spectacles that uses Google's Lyria AI to generate real-time musical loops. MiNiMIDI LYRIA transforms your Snap Spectacles into an AI-powered music creation studio.
No pre-recorded samples. No loops from a library. Every beat is generated on-the-fly using Google's Lyria AI.
---
## Spectacles Crash Proof Version 😎🤏

## ✨ Features

- **🎵 AI-Generated Music** - Uses Google Lyria API to generate unique instrument loops with a simultaneously multiple-track play possibility 
- **🎛️ 9 Interactive Pads** - Tap to play/stop individual instrument tracks
- **🎚️ Crossfader Control** - Blend between tracks with volume control
- **🎨 5 Music Genres** - Electronic, Hip Hop, Lofi Jazz, House, Rock
- **👓 Spectacles Optimized** - Designed for stable performance on Snap Spectacles
- **✨ Visual Feedback** - Dynamic dot visualizer responds to playing tracks

---

## 🚀 Getting Started

### Prerequisites

- [Lens Studio](https://lensstudio.snapchat.com/) (Latest version)
- Snap Spectacles (for on-device testing)
- Google Cloud account with Lyria API access

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/urbanpeppermint/MiNiMIDI_LYRIA.git
```

2. **Open in Lens Studio**
   - Launch Lens Studio
   - Open the project folder

3. **Configure API Access**
   - Set up your Google Lyria API credentials
   - Configure the RemoteServiceGateway package

4. **Test & Deploy**
   - Preview in Lens Studio
   - Push to Spectacles for on-device testing

---

## 🎮 How to Use

### Genre Selection
1. Look at the genre menu (Electronic, Hip Hop, Lofi Jazz, House, Rock)
2. Pinch to select a genre
3. Wait for AI to generate 9 instrument tracks (~30 seconds)

### Playing Music
1. Pinch any pad to **play** that instrument
2. Pinch again to **stop**
3. Mix multiple instruments together
4. Use the crossfader to control volume

### Position Lock
1. Pinch the lock button to **freeze** the controller position
2. Pinch again to **unlock** and reposition

---

## 📁 Project Structure

```
MiNiMIDI_LYRIA/
├── Assets/
│   ├── Scripts/
│   │   ├── DJMidiManager.ts          # Main controller - handles generation
│   │   ├── MidiPadController.ts      # Individual pad logic
│   │   ├── MidiControllerMenu.ts     # Genre selection menu
│   │   ├── AudioLayerManager.ts      # Audio playback management
│   │   ├── CrossfaderController.ts   # Crossfader/volume control
│   │   ├── DotPoolVisualizer.ts      # Visual feedback system
│   │   ├── TrackColorManager.ts      # Track color assignments
│   │   ├── GenreInstrumentData.ts    # Genre & instrument definitions
│   │   └── MIDIPositionLock.ts       # Position lock feature
│   ├── Materials/
│   ├── Textures/
│   └── Prefabs/
├── RemoteServiceGateway.lspkg/       # Lyria API integration
└── README.md
```

---

## 🎚️ Crossfader & Volume Control

### Current Implementation (Spectacles-Safe)

The crossfader in this project is designed to be **stable on Spectacles glasses**. Due to hardware limitations, we apply volume changes to **only ONE track at a time** (the most recently played track).

**How it works:**
- Slider controls volume of the **last played track only** (Track B)
- Uses **stepped volume levels**: 0%, 25%, 50%, 100%
- **Waits 500ms** after slider stops moving before applying
- All other tracks play at full volume

This approach prevents crashes while still providing useful volume control.

---

### ⚠️ Full Crossfader (Lens Studio Only - Crashes on Spectacles)

If you want **true A/B crossfading** where both tracks blend simultaneously, you can modify the code. However, **this WILL crash on Spectacles glasses**.

**Why it crashes:**
- Each AI-generated audio track is **~6MB** of raw PCM data
- Applying volume requires processing the entire 6MB buffer
- Processing TWO 6MB buffers simultaneously overwhelms Spectacles hardware
- `DynamicAudioOutput` is designed for streaming AI-generated audio, not real-time volume manipulation

**To enable full crossfader (Lens Studio testing only):**

In `CrossfaderController.ts`, modify `applyCrossfade()`:

```typescript
private applyCrossfade(value: number): void {
    const volumeA = this.getSteppedVolume(1.0 - value);
    const volumeB = this.getSteppedVolume(value);
    
    // ⚠️ WARNING: This crashes on Spectacles!
    // Apply to BOTH tracks
    if (this._trackA && this._trackA.isPlaying()) {
        this._trackA.setVolume(volumeA);
    }
    
    if (this._trackB && this._trackB.isPlaying()) {
        this._trackB.setVolume(volumeB);
    }
    
    print(`[Crossfader] A=${Math.round(volumeA * 100)}%, B=${Math.round(volumeB * 100)}%`);
}
```

**⚠️ Test in Lens Studio only - Do not deploy to Spectacles with this change.**

---

### 🔧 Technical Comparison

| Feature | Spectacles-Safe Mode | Full Crossfader Mode |
|---------|---------------------|---------------------|
| Tracks affected | 1 (last played) | 2 (A and B) |
| Volume levels | 0% / 25% / 50% / 100% | 0% / 25% / 50% / 100% |
| Debounce delay | 500ms | 500ms |
| Simultaneous processing | ❌ No | ✅ Yes |
| Spectacles stable | ✅ Yes | ❌ Crashes |
| Lens Studio stable | ✅ Yes | ✅ Yes |

---

## 🎼 Genres & Instruments

### 🔊 Electronic
Kick, Clap, Hi-Hat, Bass, Lead, Pad, Arp, FX, Vocal

### 🎤 Hip Hop
808 Kick, Snare, Hi-Hats, 808 Bass, Melody, Pad, Perc, Keys, Bells

### 🎷 Lofi Jazz
Drums, Bass, Piano, Guitar, Sax, Vibes, Vinyl, Strings, Ambient

### 🏠 House
Kick, Clap, Hi-Hat, Bass, Piano, Strings, Organ, Synth, Vocal

### 🎸 Rock
Drums, Bass, Electric Guitar, Acoustic Guitar, Piano, Organ, Lead, Strings, Vocal

---

## ⚙️ Configuration

### Audio Settings
In `AudioLayerManager.ts`:
```typescript
private readonly LAYER_COUNT: number = 10;      // Max simultaneous tracks
private readonly DEBOUNCE_TIME: number = 0.2;   // Volume change delay
```

### Crossfader Settings
In `CrossfaderController.ts`:
```typescript
private readonly SLIDER_STOP_DELAY: number = 0.5;  // Wait before applying
```

### Generation Settings
In `DJMidiManager.ts`:
```typescript
delayBetweenTracks: number = 2500;  // ms between generating tracks
```

---

## 🐛 Troubleshooting

### Tracks not generating
- Check Lyria API credentials
- Verify network connection
- Check console for API error messages

### Audio not playing
- Ensure AudioLayerManager has all 10 DynamicAudioOutput components assigned
- Check that tracks finished generating (pad shows "Ready" state)

### Crashes on Spectacles
- Avoid moving crossfader while multiple tracks play
- Wait for generation to complete before interacting
- Clear Spectacles storage if low on memory

### Pad shows Error state
- Lyria blocked the prompt (recitation check)
- Try regenerating by selecting the genre again

---

## 🔮 Future Improvements

- **Pre-computed volume versions** - Generate multiple volume levels during load
- **Native volume control** - Hardware-level volume if API becomes available
- **Smaller audio files** - Request shorter/compressed audio from Lyria
- **Smart track limiting** - Auto-stop oldest track when limit reached

---

## 📚 Related Projects

- [VIBE_MIDI_AI](https://github.com/urbanpeppermint/VIBE_MIDI_AI) - Individual track sliders version
- [Spectacles Interaction Kit](https://developers.snap.com/spectacles) - Snap AR development

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Lyria** - AI music generation
- **Snap Inc.** - Spectacles for giving me the opportunity to be among first developers who are building for this powerful device.
- **Spectacles Interaction Kit** - AR interaction framework

---

## 📧 Contact

**Urban Peppermint**
- GitHub: [@urbanpeppermint](https://github.com/urbanpeppermint)

---

Made with 🎵 for Spectacles
