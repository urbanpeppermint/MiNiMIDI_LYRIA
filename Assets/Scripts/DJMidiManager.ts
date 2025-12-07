/**
 * DJMidiManager.ts
 * No changes needed from previous version
 */

import { Lyria } from "RemoteServiceGateway.lspkg/HostedExternal/Lyria";
import { GoogleGenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes";
import { MidiPadController, PadState } from "./MidiPadController";
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
    
    @input
    midiPadsContainer: SceneObject;
    
    @input
    @allowUndefined
    statusText: Text;
    
    @input
    @allowUndefined
    genreLabel: Text;
    
    @input
    @allowUndefined
    bpmLabel: Text;
    
    @input
    @allowUndefined
    crossfaderController: ScriptComponent;
    
    @input
    delayBetweenTracks: number = 2500;
    
    private pads: MidiPadController[] = [];
    private isGenerating: boolean = false;
    private generatedGenres: { [key: number]: boolean } = {};
    private currentMode: number = 0;
    private genreAudioCache: { [genreMode: number]: { [padIndex: number]: string } } = {};
    
    private static _instance: DJMidiManager;
    public static getInstance(): DJMidiManager {
        return DJMidiManager._instance;
    }
    
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
            const event = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
            event.bind(() => this.waitForAudioLayerManager());
            event.reset(0.2);
        }
    }
    
    private setupPads(): void {
        if (!this.midiPadsContainer) {
            print("[DJMidiManager] No midiPadsContainer!");
            return;
        }
        
        const childCount = this.midiPadsContainer.getChildrenCount();
        for (let i = 0; i < childCount; i++) {
            const child = this.midiPadsContainer.getChild(i);
            const pad = child.getComponent(MidiPadController.getTypeName()) as MidiPadController;
            
            if (pad) {
                this.pads.push(pad);
                pad.onPadToggled.push((padIndex, isPlaying, padRef) => {
                    this.onPadToggled(padIndex, isPlaying, padRef);
                });
            }
        }
        
        this.pads.sort((a, b) => a.getPadIndex() - b.getPadIndex());
        
        for (let i = 1; i <= getGenreCount(); i++) {
            this.generatedGenres[i] = false;
            this.genreAudioCache[i] = {};
        }
        
        this.updateStatus("Select a genre to start");
        if (this.genreLabel) this.genreLabel.text = "No Genre";
        if (this.bpmLabel) this.bpmLabel.text = "--- BPM";
        
        print(`[DJMidiManager] Ready with ${this.pads.length} pads!`);
    }
    
    private onPadToggled(padIndex: number, isPlaying: boolean, pad: MidiPadController): void {
        if (this.crossfaderController) {
            const cf = this.crossfaderController as any;
            if (isPlaying && cf.registerPlayingPad) {
                cf.registerPlayingPad(pad);
            } else if (!isPlaying && cf.unregisterPad) {
                cf.unregisterPad(pad);
            }
        }
    }
    
    public onGenreSelected(mode: number): void {
        print(`[DJMidiManager] onGenreSelected: ${mode}`);
        
        if (mode < 1 || mode > getGenreCount()) return;
        if (this.isGenerating) return;
        
        const visualizer = DotPoolVisualizer.getInstance();
        if (visualizer) visualizer.clearAllTracks();
        
        if (this.crossfaderController) {
            const cf = this.crossfaderController as any;
            if (cf.clearTracks) cf.clearTracks();
        }
        
        MidiPadController.clearAllForGenreSwitch();
        
        this.currentMode = mode;
        const genre = getGenreByMode(mode);
        if (!genre) return;
        
        if (this.genreLabel) this.genreLabel.text = `${genre.emoji} ${genre.name}`;
        if (this.bpmLabel) this.bpmLabel.text = `${genre.bpm} BPM`;
        
        this.configurePadsForGenre(genre);
        
        if (this.generatedGenres[mode]) {
            this.loadGenreFromCache(mode);
            this.updateStatus(`${genre.name} Ready!`);
            return;
        }
        
        this.generateGenre(mode);
    }
    
    private configurePadsForGenre(genre: GenreConfig): void {
        for (let i = 0; i < this.pads.length && i < genre.instruments.length; i++) {
            const inst = genre.instruments[i];
            this.pads[i].configure(inst.id, inst.name, inst.emoji);
        }
    }
    
    private loadGenreFromCache(mode: number): void {
        const cache = this.genreAudioCache[mode];
        if (!cache) return;
        
        for (let i = 0; i < this.pads.length; i++) {
            if (cache[i]) this.pads[i].loadAudioB64(cache[i]);
        }
    }
    
    public stopAll(): void {
        MidiPadController.stopAll();
        AudioLayerManager.getInstance()?.stopAll();
    }
    
    public playAllCurrent(): void {
        this.pads.forEach(p => {
            if (p.getState() === PadState.Ready) p.play();
        });
    }
    
    public getCurrentMode(): number { return this.currentMode; }
    public isCurrentlyGenerating(): boolean { return this.isGenerating; }
    
    private generateGenre(mode: number): void {
        const genre = getGenreByMode(mode);
        if (!genre || this.pads.length === 0) return;
        
        this.isGenerating = true;
        this.updateStatus(`Generating ${genre.name}...`);
        this.pads.forEach(p => p.setLoading());
        this.genreAudioCache[mode] = {};
        
        this.generateTracksSequentially(genre, 0, () => {
            this.isGenerating = false;
            this.generatedGenres[mode] = true;
            this.updateStatus(`${genre.name} Ready!`);
        });
    }
    
    private generateTracksSequentially(genre: GenreConfig, index: number, onComplete: () => void): void {
        if (index >= this.pads.length || index >= genre.instruments.length) {
            onComplete();
            return;
        }
        
        const pad = this.pads[index];
        const inst = genre.instruments[index];
        
        this.updateStatus(`${genre.name}: ${index + 1}/${genre.instruments.length} - ${inst.emoji} ${inst.name}`);
        
        const prompt = buildSafePrompt(genre, inst);
        
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
                        this.genreAudioCache[this.currentMode][index] = b64;
                        pad.loadAudioB64(b64);
                    } else {
                        pad.setError();
                    }
                } else {
                    pad.setError();
                }
                this.scheduleNextTrack(genre, index, onComplete);
            })
            .catch(() => {
                pad.setError();
                this.scheduleNextTrack(genre, index, onComplete);
            });
    }
    
    private scheduleNextTrack(genre: GenreConfig, index: number, onComplete: () => void): void {
        const event = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
        event.bind(() => this.generateTracksSequentially(genre, index + 1, onComplete));
        event.reset(this.delayBetweenTracks / 1000);
    }
    
    private updateStatus(text: string): void {
        if (this.statusText) this.statusText.text = text;
        print(`[DJMidiManager] ${text}`);
    }
}