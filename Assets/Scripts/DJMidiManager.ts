/**
 * DJMidiManager.ts
 * Main controller for DJ MIDI with Lyria generation
 * Handles dynamic layer allocation and genre switching
 */

import { Lyria } from "RemoteServiceGateway.lspkg/HostedExternal/Lyria";
import { GoogleGenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes";
import { MidiPadController, PadState } from "./MidiPadController";
import { CrossfaderController } from "./CrossfaderController";
import { AudioLayerManager } from "./AudioLayerManager";
import { DotPoolVisualizer } from './DotPoolVisualizer';
import { 
    GenreConfig, 
    getGenreByMode, 
    buildSafePrompt, 
    getGenreCount 
} from "./GenreInstrumentData";

@component
export class DJMidiManager extends BaseScriptComponent {
    
    // ═══════════════════════════════════════════════════════════════
    // INPUTS - MIDI PAD BATCHES (5 genres x 9 pads)
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @hint("Batch 1: Electronic pads")
    midiButtonsBatch1: SceneObject;
    
    @input
    @hint("Batch 2: Hip Hop pads")
    midiButtonsBatch2: SceneObject;
    
    @input
    @hint("Batch 3: Lofi Jazz pads")
    midiButtonsBatch3: SceneObject;
    
    @input
    @hint("Batch 4: House pads")
    midiButtonsBatch4: SceneObject;
    
    @input
    @hint("Batch 5: Rock pads")
    midiButtonsBatch5: SceneObject;
    
    // ═══════════════════════════════════════════════════════════════
    // INPUTS - UI
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @allowUndefined
    statusText: Text;
    
    @input
    @allowUndefined
    genreLabel: Text;
    
    @input
    @allowUndefined
    bpmLabel: Text;
    
    // ═══════════════════════════════════════════════════════════════
    // INPUTS - CROSSFADER
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @hint("CrossfaderController for mixing")
    @allowUndefined
    crossfaderController: CrossfaderController;
    
    // ═══════════════════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @hint("Delay between generating each track (ms)")
    delayBetweenTracks: number = 2500;
    
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE STATE
    // ═══════════════════════════════════════════════════════════════
    
    private padsByGenre: { [key: number]: MidiPadController[] } = {};
    private isGenerating: { [key: number]: boolean } = {};
    private generatedGenres: { [key: number]: boolean } = {};
    private currentMode: number = 0;
    
    // ═══════════════════════════════════════════════════════════════
    // SINGLETON
    // ═══════════════════════════════════════════════════════════════
    
    private static _instance: DJMidiManager;
    public static getInstance(): DJMidiManager {
        return DJMidiManager._instance;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════════════
    
    onAwake(): void {
        DJMidiManager._instance = this;
        
        this.createEvent('OnStartEvent').bind(() => {
            this.initialize();
        });
    }
    
    private initialize(): void {
        print("[DJMidiManager] Initializing...");
        this.waitForAudioLayerManager();
    }
    
    private waitForAudioLayerManager(): void {
        const manager = AudioLayerManager.getInstance();
        
        if (manager && manager.isReady()) {
            this.setupPads();
        } else {
            print("[DJMidiManager] Waiting for AudioLayerManager...");
            const event = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
            event.bind(() => this.waitForAudioLayerManager());
            event.reset(0.2);
        }
    }
    
    private setupPads(): void {
        // Initialize state for all genres
        for (let i = 1; i <= getGenreCount(); i++) {
            this.isGenerating[i] = false;
            this.generatedGenres[i] = false;
            this.padsByGenre[i] = [];
        }
        
        // Collect pads from each batch
        this.padsByGenre[1] = this.collectPadsFromBatch(this.midiButtonsBatch1, 1);
        this.padsByGenre[2] = this.collectPadsFromBatch(this.midiButtonsBatch2, 2);
        this.padsByGenre[3] = this.collectPadsFromBatch(this.midiButtonsBatch3, 3);
        this.padsByGenre[4] = this.collectPadsFromBatch(this.midiButtonsBatch4, 4);
        this.padsByGenre[5] = this.collectPadsFromBatch(this.midiButtonsBatch5, 5);
        
        // Configure pads with instrument data
        for (let i = 1; i <= getGenreCount(); i++) {
            const genre = getGenreByMode(i);
            if (genre) {
                this.configurePadsForGenre(this.padsByGenre[i], genre);
            }
            print(`[DJMidiManager] Genre ${i}: ${this.padsByGenre[i].length} pads`);
        }
        
        this.updateStatus("Select a genre to start");
        print("[DJMidiManager] Ready!");
    }
    
    private collectPadsFromBatch(batch: SceneObject, genreId: number): MidiPadController[] {
        const pads: MidiPadController[] = [];
        if (!batch) return pads;
        
        const childCount = batch.getChildrenCount();
        for (let i = 0; i < childCount; i++) {
            const child = batch.getChild(i);
            const pad = child.getComponent(MidiPadController.getTypeName()) as MidiPadController;
            
            if (pad) {
                pads.push(pad);
                
                // Setup callback for play/stop events
                pad.onPadToggled.push((padIndex, isPlaying, padRef) => {
                    this.onPadToggled(padIndex, isPlaying, padRef);
                });
            }
        }
        
        // Sort by pad index
        pads.sort((a, b) => a.getPadIndex() - b.getPadIndex());
        return pads;
    }
    
    private configurePadsForGenre(pads: MidiPadController[], genre: GenreConfig): void {
        for (let i = 0; i < pads.length && i < genre.instruments.length; i++) {
            const inst = genre.instruments[i];
            pads[i].configure(inst.id, inst.name, inst.emoji);
        }
    }
    
    private onPadToggled(padIndex: number, isPlaying: boolean, pad: MidiPadController): void {
        // Register/unregister with crossfader
        if (this.crossfaderController) {
            if (isPlaying) {
                this.crossfaderController.registerPlayingPad(pad);
            } else {
                this.crossfaderController.unregisterPad(pad);
            }
        }
        
        print(`[DJMidiManager] Pad ${padIndex} ${isPlaying ? "PLAYING" : "STOPPED"}`);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API - GENRE SELECTION
    // ═══════════════════════════════════════════════════════════════
    
    public onGenreSelected(mode: number): void {
        if (mode < 1 || mode > getGenreCount()) {
            print(`[DJMidiManager] Invalid mode: ${mode}`);
            return;
        }
        
        print(`[DJMidiManager] ═══════════════════════════════════════`);
        print(`[DJMidiManager] Switching to mode ${mode}`);
        
        // ═══════════════════════════════════════════════════════════
        // STEP 1: Stop and release ALL layers from ALL genres
        // ═══════════════════════════════════════════════════════════
        
        this.releaseAllPadsAndLayers();
        
        // ═══════════════════════════════════════════════════════════
        // STEP 2: Clear visualizer
        // ═══════════════════════════════════════════════════════════
        
        const visualizer = DotPoolVisualizer.getInstance();
        if (visualizer) {
            visualizer.clearAllTracks();
        }
        
        // ═══════════════════════════════════════════════════════════
        // STEP 3: Set current mode and update UI
        // ═══════════════════════════════════════════════════════════
        
        this.currentMode = mode;
        const genre = getGenreByMode(mode);
        if (!genre) return;
        
        print(`[DJMidiManager] Selected: ${genre.emoji} ${genre.name} @ ${genre.bpm} BPM`);
        
        if (this.genreLabel) this.genreLabel.text = `${genre.emoji} ${genre.name}`;
        if (this.bpmLabel) this.bpmLabel.text = `${genre.bpm} BPM`;
        
        // ═══════════════════════════════════════════════════════════
        // STEP 3.5: RECONFIGURE PADS WITH NEW GENRE DATA <-- ADD THIS!
        // ═══════════════════════════════════════════════════════════
        
        const pads = this.padsByGenre[mode] || [];
        this.configurePadsForGenre(pads, genre);
        print(`[DJMidiManager] Configured ${pads.length} pads for ${genre.name}`);
        
        // Log available layers
        const manager = AudioLayerManager.getInstance();
        if (manager) {
            print(`[DJMidiManager] Available layers: ${manager.getAvailableLayerCount()}/${10}`);
        }
        
        // ═══════════════════════════════════════════════════════════
        // STEP 4: Check if already generated or start generation
        // ═══════════════════════════════════════════════════════════
        
        if (this.generatedGenres[mode]) {
            this.updateStatus(`${genre.name} Ready!`);
            return;
        }
        
        this.generateGenre(mode);
    }
    
    /**
     * Release all pads and layers across ALL genres
     */
    private releaseAllPadsAndLayers(): void {
        print(`[DJMidiManager] Releasing all pads and layers...`);
        
        // Stop and release all pads from ALL genres
        for (let i = 1; i <= getGenreCount(); i++) {
            const pads = this.padsByGenre[i] || [];
            pads.forEach(pad => {
                if (pad.isPlaying()) {
                    pad.stop();
                } else {
                    pad.releaseLayer();
                }
            });
        }
        
        // Also release all layers at manager level (safety net)
        const manager = AudioLayerManager.getInstance();
        if (manager) {
            manager.releaseAllLayers();
            print(`[DJMidiManager] All layers released. Available: ${manager.getAvailableLayerCount()}`);
        }
        
        // Unregister all from crossfader - use individual unregister calls
        this.unregisterAllFromCrossfader();
    }
    
    /**
     * Unregister all pads from crossfader
     */
    private unregisterAllFromCrossfader(): void {
        if (!this.crossfaderController) return;
        
        // Unregister each pad individually from all genres
        for (let i = 1; i <= getGenreCount(); i++) {
            const pads = this.padsByGenre[i] || [];
            pads.forEach(pad => {
                this.crossfaderController.unregisterPad(pad);
            });
        }
        
        print(`[DJMidiManager] All pads unregistered from crossfader`);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API - PLAYBACK CONTROL
    // ═══════════════════════════════════════════════════════════════
    
    public stopAll(): void {
        print(`[DJMidiManager] Stopping all...`);
        
        const manager = AudioLayerManager.getInstance();
        if (manager) {
            manager.stopAll();
            manager.releaseAllLayers();
        }
        
        // Stop all pads in current genre
        const pads = this.padsByGenre[this.currentMode] || [];
        pads.forEach(p => {
            if (p.isPlaying()) {
                p.stop();
            }
        });
        
        // Unregister all from crossfader
        this.unregisterAllFromCrossfader();
        
        print("[DJMidiManager] Stopped all");
    }
    
    public playAllCurrent(): void {
        const pads = this.padsByGenre[this.currentMode] || [];
        let playedCount = 0;
        
        pads.forEach(p => {
            if (p.getState() === PadState.Ready && !p.isPlaying()) {
                p.play();
                playedCount++;
            }
        });
        
        print(`[DJMidiManager] Started ${playedCount} pads`);
    }
    
    public getCurrentMode(): number {
        return this.currentMode;
    }
    
    public getPadsForCurrentMode(): MidiPadController[] {
        return this.padsByGenre[this.currentMode] || [];
    }
    
    // ═══════════════════════════════════════════════════════════════
    // GENERATION
    // ═══════════════════════════════════════════════════════════════
    
    private generateGenre(mode: number): void {
        if (this.isGenerating[mode]) {
            print(`[DJMidiManager] Mode ${mode} already generating`);
            return;
        }
        
        const genre = getGenreByMode(mode);
        const pads = this.padsByGenre[mode] || [];
        
        if (!genre || pads.length === 0) {
            print(`[DJMidiManager] Invalid genre or no pads`);
            return;
        }
        
        this.isGenerating[mode] = true;
        this.updateStatus(`Generating ${genre.name}...`);
        
        // Set all pads to loading state
        pads.forEach(p => p.setLoading());
        
        // Start sequential generation
        this.generateTracksSequentially(genre, pads, 0, () => {
            this.isGenerating[mode] = false;
            this.generatedGenres[mode] = true;
            this.updateStatus(`${genre.name} Ready!`);
            print(`[DJMidiManager] ${genre.name} generation complete`);
        });
    }
    
    private generateTracksSequentially(
        genre: GenreConfig,
        pads: MidiPadController[],
        index: number,
        onComplete: () => void
    ): void {
        if (index >= pads.length || index >= genre.instruments.length) {
            onComplete();
            return;
        }
        
        const pad = pads[index];
        const inst = genre.instruments[index];
        
        this.updateStatus(`${genre.name}: ${index + 1}/${genre.instruments.length} - ${inst.emoji} ${inst.name}`);
        
        const prompt = buildSafePrompt(genre, inst);
        print(`[DJMidiManager] Generating: ${inst.name}`);
        print(`[DJMidiManager] Prompt: ${prompt.substring(0, 100)}...`);
        
        const req: GoogleGenAITypes.Lyria.LyriaRequest = {
            model: "lyria-002",
            type: "predict",
            body: {
                instances: [{ prompt: prompt }],
                parameters: { sample_count: 1 }
            }
        };
        
        Lyria.performLyriaRequest(req)
            .then((res) => {
                if (res?.predictions?.length) {
                    const b64 = res.predictions[0].bytesBase64Encoded;
                    if (b64) {
                        pad.loadAudioB64(b64);
                        print(`[DJMidiManager] ✓ Loaded: ${inst.name}`);
                    } else {
                        pad.setError();
                        print(`[DJMidiManager] ✗ No audio for: ${inst.name}`);
                    }
                } else {
                    pad.setError();
                    print(`[DJMidiManager] ✗ Empty response for: ${inst.name}`);
                }
                
                this.scheduleNextTrack(genre, pads, index, onComplete);
            })
            .catch((error) => {
                print(`[DJMidiManager] ✗ Error generating ${inst.name}: ${error}`);
                pad.setError();
                this.scheduleNextTrack(genre, pads, index, onComplete);
            });
    }
    
    private scheduleNextTrack(
        genre: GenreConfig,
        pads: MidiPadController[],
        index: number,
        onComplete: () => void
    ): void {
        const event = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
        event.bind(() => {
            this.generateTracksSequentially(genre, pads, index + 1, onComplete);
        });
        event.reset(this.delayBetweenTracks / 1000);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════════════════════════
    
    private updateStatus(text: string): void {
        if (this.statusText) {
            this.statusText.text = text;
        }
        print(`[DJMidiManager] ${text}`);
    }
}