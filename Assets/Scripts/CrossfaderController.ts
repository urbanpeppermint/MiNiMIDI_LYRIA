/**
 * CrossfaderController.ts
 * SPECTACLES SAFE: Only applies volume to ONE track (the last active one)
 */

import { Slider } from 'SpectaclesInteractionKit/Components/UI/Slider/Slider';
import { MidiPadController } from './MidiPadController';

@component
export class CrossfaderController extends BaseScriptComponent {
    
    @input
    slider: Slider;
    
    @input
    @allowUndefined
    trackALabel: Text;
    
    @input
    @allowUndefined
    trackBLabel: Text;
    
    private _trackA: MidiPadController | null = null;
    private _trackB: MidiPadController | null = null;
    private _lastSliderValue: number = 0.5;
    private _initialized: boolean = false;
    
    // Lazy update
    private _sliderMoving: boolean = false;
    private _sliderStopTimer: number = 0;
    private readonly SLIDER_STOP_DELAY: number = 0.5;
    
    // Track which was last applied to avoid redundant calls
    private _lastAppliedVolume: number = -1;
    
    onAwake(): void {
        this.createEvent('OnStartEvent').bind(() => {
            this.initialize();
        });
        
        this.createEvent('UpdateEvent').bind(() => {
            this.onUpdate();
        });
    }
    
    private initialize(): void {
        if (!this.slider) {
            print("[CrossfaderController] No slider assigned!");
            return;
        }
        
        this._lastSliderValue = this.slider.currentValue || 0.5;
        
        this.slider.onValueUpdate.add((value: number) => {
            this._lastSliderValue = value;
            this._sliderMoving = true;
            this._sliderStopTimer = this.SLIDER_STOP_DELAY;
        });
        
        this._initialized = true;
        this.updateLabels();
        print("[CrossfaderController] Initialized (single track volume mode)");
    }
    
    private onUpdate(): void {
        if (this._sliderMoving) {
            this._sliderStopTimer -= getDeltaTime();
            
            if (this._sliderStopTimer <= 0) {
                this._sliderMoving = false;
                this.applyCrossfade(this._lastSliderValue);
            }
        }
    }
    
    /**
     * Get stepped volume: 0, 0.25, 0.5, 1.0
     */
    private getSteppedVolume(value: number): number {
        if (value < 0.15) return 0;
        if (value < 0.4) return 0.25;
        if (value < 0.65) return 0.5;
        return 1.0;
    }
    
    private applyCrossfade(value: number): void {
        // Only apply to Track B (the most recent track)
        if (!this._trackB || !this._trackB.isPlaying()) {
            return;
        }
        
        const volume = this.getSteppedVolume(value);
        
        // Skip if same volume already applied
        if (volume === this._lastAppliedVolume) {
            return;
        }
        
        this._lastAppliedVolume = volume;
        this._trackB.setVolume(volume);
        
        print(`[Crossfader] Applied ${Math.round(volume * 100)}% to ${this._trackB.getInstrumentName()}`);
    }
    
    public registerPlayingPad(pad: MidiPadController): void {
        if (!pad) return;
        if (this._trackA === pad || this._trackB === pad) return;
        
        this._trackA = this._trackB;
        this._trackB = pad;
        
        // Reset applied volume for new track
        this._lastAppliedVolume = -1;
        
        this.updateLabels();
        print(`[Crossfader] A=${this._trackA?.getInstrumentName() || 'None'}, B=${this._trackB?.getInstrumentName() || 'None'}`);
    }
    
    public unregisterPad(pad: MidiPadController): void {
        if (!pad) return;
        
        if (this._trackA === pad) {
            this._trackA = null;
        }
        if (this._trackB === pad) {
            this._trackB = null;
            this._lastAppliedVolume = -1;
        }
        
        this.updateLabels();
    }
    
    public clearTracks(): void {
        this._trackA = null;
        this._trackB = null;
        this._lastAppliedVolume = -1;
        this._sliderMoving = false;
        this.updateLabels();
    }
    
    public getTrackA(): MidiPadController | null { return this._trackA; }
    public getTrackB(): MidiPadController | null { return this._trackB; }
    
    private updateLabels(): void {
        if (this.trackALabel) {
            this.trackALabel.text = this._trackA ? this._trackA.getInstrumentName() : "---";
        }
        if (this.trackBLabel) {
            this.trackBLabel.text = this._trackB ? this._trackB.getInstrumentName() : "---";
        }
    }
}