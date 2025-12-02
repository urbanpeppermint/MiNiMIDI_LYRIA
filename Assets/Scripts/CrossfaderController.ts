/**
 * CrossfaderController.ts
 * Manages crossfade between two playing tracks
 */

import { MidiPadController } from "./MidiPadController";
import { AudioLayerManager } from "./AudioLayerManager";

@component
export class CrossfaderController extends BaseScriptComponent {
    
    @input
    @hint("Crossfader slider (0 = Track A, 1 = Track B)")
    @allowUndefined
    crossfaderSlider: ScriptComponent;
    
    @input
    @hint("Track A label")
    @allowUndefined
    trackALabel: Text;
    
    @input
    @hint("Track B label")
    @allowUndefined
    trackBLabel: Text;
    
    private _trackA: MidiPadController | null = null;
    private _trackB: MidiPadController | null = null;
    private _crossfadeValue: number = 0.5;
    
    private static _instance: CrossfaderController;
    public static getInstance(): CrossfaderController {
        return CrossfaderController._instance;
    }
    
    onAwake(): void {
        CrossfaderController._instance = this;
        
        this.createEvent("OnStartEvent").bind(() => {
            this.setupSlider();
        });
    }
    
    private setupSlider(): void {
        if (this.crossfaderSlider) {
            const api = (this.crossfaderSlider as any).api;
            if (api && api.onValueUpdate) {
                api.currentValue = 0.5;
                api.onValueUpdate.add((value: number) => {
                    this.onCrossfadeChanged(value);
                });
                print("[Crossfader] Slider connected");
            }
        }
    }
    
    private onCrossfadeChanged(value: number): void {
        this._crossfadeValue = value;
        this.applyCrossfade();
    }
    
    private applyCrossfade(): void {
        const manager = AudioLayerManager.getInstance();
        if (!manager) return;
        
        // Calculate volumes: 0 = full A, 1 = full B, 0.5 = equal
        const volumeA = 1.0 - this._crossfadeValue;
        const volumeB = this._crossfadeValue;
        
        if (this._trackA) {
            const layerA = this._trackA.getLayerIndex();
            if (layerA >= 0) {
                manager.setLayerVolume(layerA, volumeA);
            }
        }
        
        if (this._trackB) {
            const layerB = this._trackB.getLayerIndex();
            if (layerB >= 0) {
                manager.setLayerVolume(layerB, volumeB);
            }
        }
    }
    
    /**
     * Register a playing pad with the crossfader
     * New pads become Track B, pushing Track A out
     */
    public registerPlayingPad(pad: MidiPadController): void {
        if (!pad) return;
        
        // If this pad is already registered, skip
        if (this._trackA === pad || this._trackB === pad) {
            return;
        }
        
        // Shift: A becomes untracked, B becomes A, new pad becomes B
        this._trackA = this._trackB;
        this._trackB = pad;
        
        this.updateLabels();
        this.applyCrossfade();
        
        print(`[Crossfader] Registered: ${pad.getInstrumentName()} as Track B`);
    }
    
    /**
     * Unregister a specific pad
     */
    public unregisterPad(pad: MidiPadController): void {
        if (!pad) return;
        
        if (this._trackA === pad) {
            print(`[Crossfader] Unregistered Track A: ${pad.getInstrumentName()}`);
            this._trackA = null;
        }
        
        if (this._trackB === pad) {
            print(`[Crossfader] Unregistered Track B: ${pad.getInstrumentName()}`);
            this._trackB = this._trackA;
            this._trackA = null;
        }
        
        this.updateLabels();
    }
    
    /**
     * Unregister all pads from crossfader
     */
    public unregisterAll(): void {
        if (this._trackA) {
            print(`[Crossfader] Unregistering Track A: ${this._trackA.getInstrumentName()}`);
        }
        if (this._trackB) {
            print(`[Crossfader] Unregistering Track B: ${this._trackB.getInstrumentName()}`);
        }
        
        this._trackA = null;
        this._trackB = null;
        
        this.updateLabels();
        print(`[Crossfader] All tracks unregistered`);
    }
    
    private updateLabels(): void {
        if (this.trackALabel) {
            this.trackALabel.text = this._trackA ? this._trackA.getInstrumentName() : "---";
        }
        if (this.trackBLabel) {
            this.trackBLabel.text = this._trackB ? this._trackB.getInstrumentName() : "---";
        }
    }
    
    public getTrackA(): MidiPadController | null {
        return this._trackA;
    }
    
    public getTrackB(): MidiPadController | null {
        return this._trackB;
    }
}