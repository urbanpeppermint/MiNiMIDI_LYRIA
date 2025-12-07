/**
 * MidiPadController.ts
 * SIMPLE VERSION - No pre-computed volumes
 */

import { Interactable } from 'SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable';
import { AudioLayerManager } from './AudioLayerManager';
import { DotPoolVisualizer } from './DotPoolVisualizer';

export enum PadState {
    Empty = 0,
    Loading = 1,
    Ready = 2,
    Playing = 3,
    Error = 4
}

@component
export class MidiPadController extends BaseScriptComponent {
    
    @input
    @hint("Pad index (0-8)")
    padIndex: number = 0;
    
    @input
    @hint("Genre ID this pad belongs to (1-5)")
    genreId: number = 1;
    
    @input
    @allowUndefined
    padMesh: RenderMeshVisual;
    
    @input
    @allowUndefined
    emptyMaterial: Material;
    
    @input
    @allowUndefined
    loadingMaterial: Material;
    
    @input
    @allowUndefined
    readyMaterial: Material;
    
    @input
    @allowUndefined
    playingMaterial: Material;
    
    @input
    @allowUndefined
    errorMaterial: Material;
    
    @input
    @allowUndefined
    labelText: Text;
    
    @input
    @allowUndefined
    emojiText: Text;
    
    // Callbacks
    public onPadToggled: ((padIndex: number, isPlaying: boolean, pad: MidiPadController) => void)[] = [];
    public onPadStateChanged: ((padIndex: number, state: PadState) => void)[] = [];
    
    // Private state
    private _state: PadState = PadState.Empty;
    private _instrumentId: string = "";
    private _instrumentName: string = "";
    private _instrumentEmoji: string = "";
    private _isPlaying: boolean = false;
    private _audioData: Uint8Array | null = null;
    private _ownerId: string = "";
    private _layerIndex: number = -1;
    private _interactable: Interactable | null = null;
    private _lastTapTime: number = 0;
    
    // Static registry
    private static allPads: Map<number, MidiPadController> = new Map();
    
    private static readonly TAP_COOLDOWN: number = 0.3;
    private static readonly BASE64_CHARS: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    
    onAwake(): void {
        this._ownerId = `g${this.genreId}_p${this.padIndex}`;
        
        this.createEvent('OnStartEvent').bind(() => {
            this.setupInteraction();
            MidiPadController.allPads.set(this.padIndex, this);
            this.setState(PadState.Empty);
            print(`[Pad ${this.padIndex}] Initialized - Owner: ${this._ownerId}`);
        });
    }
    
    private setupInteraction(): void {
        this._interactable = this.getSceneObject().getComponent(Interactable.getTypeName()) as Interactable;
        
        if (this._interactable) {
            this._interactable.onInteractorTriggerEnd.add(() => {
                this.onPadTapped();
            });
        } else {
            print(`[Pad ${this.padIndex}] WARNING: No Interactable!`);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STATIC API
    // ═══════════════════════════════════════════════════════════════
    
    public static getPad(index: number): MidiPadController | undefined {
        return MidiPadController.allPads.get(index);
    }
    
    public static getAllPads(): MidiPadController[] {
        return Array.from(MidiPadController.allPads.values());
    }
    
    public static clearAllForGenreSwitch(): void {
        MidiPadController.allPads.forEach(pad => pad.reset());
        AudioLayerManager.getInstance()?.stopAll();
        print(`[MidiPadController] All pads cleared`);
    }
    
    public static stopAll(): void {
        MidiPadController.allPads.forEach(pad => {
            if (pad._isPlaying) pad.stop();
        });
    }
    
    public static getPlayingPads(): MidiPadController[] {
        return Array.from(MidiPadController.allPads.values()).filter(p => p._isPlaying);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // TAP HANDLER
    // ═══════════════════════════════════════════════════════════════
    
    private onPadTapped(): void {
        const now = getTime();
        if (now - this._lastTapTime < MidiPadController.TAP_COOLDOWN) {
            print(`[Pad ${this.padIndex}] Tap ignored (debounce)`);
            return;
        }
        this._lastTapTime = now;
        
        print(`[Pad ${this.padIndex}] Tapped - State:${this._state} Playing:${this._isPlaying}`);
        
        if (this._isPlaying) {
            print(`[Pad ${this.padIndex}] Currently playing, stopping...`);
            this.stop();
            return;
        }
        
        if (this._state !== PadState.Ready) {
            print(`[Pad ${this.padIndex}] Not ready to play! State: ${this._state}`);
            return;
        }
        
        if (!this._audioData) {
            print(`[Pad ${this.padIndex}] No audio data!`);
            return;
        }
        
        this.play();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PLAYBACK
    // ═══════════════════════════════════════════════════════════════
    
    public play(): void {
        if (!this._audioData) {
            print(`[Pad ${this.padIndex}] Cannot play - no audio`);
            return;
        }
        
        if (this._isPlaying) {
            print(`[Pad ${this.padIndex}] Already playing`);
            return;
        }
        
        const manager = AudioLayerManager.getInstance();
        if (!manager) {
            print(`[Pad ${this.padIndex}] Cannot play - no manager`);
            return;
        }
        
        // Acquire layer if needed
        if (this._layerIndex < 0) {
            this._layerIndex = manager.acquireLayer(this._ownerId);
            print(`[Pad ${this.padIndex}] Acquired layer: ${this._layerIndex}`);
        }
        
        if (this._layerIndex < 0) {
            print(`[Pad ${this.padIndex}] No layer available!`);
            return;
        }
        
        // Play
        manager.playOnLayer(this._layerIndex, this._audioData);
        
        this._isPlaying = true;
        this.setState(PadState.Playing);
        
        // Register visualizer
        const visualizer = DotPoolVisualizer.getInstance();
        if (visualizer) {
            visualizer.registerTrack(this._layerIndex);
        }
        
        print(`[Pad ${this.padIndex}] ▶ ${this._instrumentName} on layer ${this._layerIndex}`);
        
        this.onPadToggled.forEach(cb => cb(this.padIndex, true, this));
    }
    
    public stop(): void {
        print(`[Pad ${this.padIndex}] Stopping... (layer: ${this._layerIndex}, playing: ${this._isPlaying})`);
        
        const manager = AudioLayerManager.getInstance();
        
        if (manager && this._layerIndex >= 0) {
            manager.stopLayer(this._layerIndex);
            manager.releaseLayer(this._layerIndex);
            print(`[Pad ${this.padIndex}] Released layer ${this._layerIndex}`);
        }
        
        const visualizer = DotPoolVisualizer.getInstance();
        if (visualizer && this._layerIndex >= 0) {
            visualizer.unregisterTrack(this._layerIndex);
        }
        
        this._layerIndex = -1;
        this._isPlaying = false;
        
        if (this._audioData) {
            this.setState(PadState.Ready);
        } else {
            this.setState(PadState.Empty);
        }
        
        print(`[Pad ${this.padIndex}] ⏹ ${this._instrumentName}`);
        
        this.onPadToggled.forEach(cb => cb(this.padIndex, false, this));
    }
    
    public releaseLayer(): void {
        const manager = AudioLayerManager.getInstance();
        
        if (manager && this._layerIndex >= 0) {
            manager.stopLayer(this._layerIndex);
            manager.releaseLayer(this._layerIndex);
        }
        
        this._layerIndex = -1;
        this._isPlaying = false;
        
        if (this._state === PadState.Playing) {
            this.setState(this._audioData ? PadState.Ready : PadState.Empty);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // VOLUME CONTROL - Simple, just passes to AudioLayerManager
    // ═══════════════════════════════════════════════════════════════
    
    public setVolume(volume: number): void {
        if (this._layerIndex >= 0) {
            const manager = AudioLayerManager.getInstance();
            if (manager) {
                manager.setLayerVolume(this._layerIndex, volume);
            }
        }
    }
    
    public getVolume(): number {
        if (this._layerIndex >= 0) {
            const manager = AudioLayerManager.getInstance();
            if (manager) {
                return manager.getLayerVolume(this._layerIndex);
            }
        }
        return 1.0;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    
    public configure(instrumentId: string, instrumentName: string, emoji: string = "🎵"): void {
        this._instrumentId = instrumentId;
        this._instrumentName = instrumentName;
        this._instrumentEmoji = emoji;
        
        if (this.labelText) {
            this.labelText.text = instrumentName;
        }
        if (this.emojiText) {
            this.emojiText.text = emoji;
        }
        
        print(`[Pad ${this.padIndex}] Configured: ${emoji} ${instrumentName}`);
    }
    
    public loadAudioB64(base64Data: string): void {
        try {
            this._audioData = this.decodeBase64(base64Data);
            this.setState(PadState.Ready);
            print(`[Pad ${this.padIndex}] ${this._instrumentName} loaded: ${this._audioData.length} bytes`);
        } catch (e) {
            print(`[Pad ${this.padIndex}] Load error: ${e}`);
            this.setState(PadState.Error);
        }
    }
    
    public loadAudioData(audioData: Uint8Array): void {
        this._audioData = audioData;
        this.setState(PadState.Ready);
    }
    
    public setLoading(): void { this.setState(PadState.Loading); }
    public setError(): void { this.setState(PadState.Error); }
    public setReady(): void { this.setState(PadState.Ready); }
    
    public reset(): void {
        this.releaseLayer();
        this._audioData = null;
        this._isPlaying = false;
        this._instrumentId = "";
        this._instrumentName = "";
        this._instrumentEmoji = "";
        
        if (this.labelText) {
            this.labelText.text = "";
        }
        if (this.emojiText) {
            this.emojiText.text = "";
        }
        
        this.setState(PadState.Empty);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════
    
    public getState(): PadState { return this._state; }
    public getPadIndex(): number { return this.padIndex; }
    public getGenreId(): number { return this.genreId; }
    public getInstrumentId(): string { return this._instrumentId; }
    public getInstrumentName(): string { return this._instrumentName; }
    public getInstrumentEmoji(): string { return this._instrumentEmoji; }
    public isPlaying(): boolean { return this._isPlaying; }
    public hasAudio(): boolean { return this._audioData !== null; }
    public getLayerIndex(): number { return this._layerIndex; }
    public getOwnerId(): string { return this._ownerId; }
    public getAudioData(): Uint8Array | null { return this._audioData; }
    
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE
    // ═══════════════════════════════════════════════════════════════
    
    private setState(state: PadState): void {
        this._state = state;
        this.updateVisuals();
        this.onPadStateChanged.forEach(cb => cb(this.padIndex, state));
    }
    
    private updateVisuals(): void {
        if (!this.padMesh) return;
        
        let mat: Material | null = null;
        switch (this._state) {
            case PadState.Empty: mat = this.emptyMaterial; break;
            case PadState.Loading: mat = this.loadingMaterial; break;
            case PadState.Ready: mat = this.readyMaterial; break;
            case PadState.Playing: mat = this.playingMaterial; break;
            case PadState.Error: mat = this.errorMaterial; break;
        }
        if (mat) this.padMesh.mainMaterial = mat;
    }
    
    private decodeBase64(base64: string): Uint8Array {
        const cleaned = base64.replace(/[\s]/g, '');
        
        let padding = 0;
        if (cleaned.endsWith('==')) padding = 2;
        else if (cleaned.endsWith('=')) padding = 1;
        
        const outputLength = Math.floor((cleaned.length * 3) / 4) - padding;
        const output = new Uint8Array(outputLength);
        
        let outputIndex = 0;
        
        for (let i = 0; i < cleaned.length; i += 4) {
            const c0 = this.getBase64Index(cleaned.charAt(i));
            const c1 = this.getBase64Index(cleaned.charAt(i + 1));
            const c2 = this.getBase64Index(cleaned.charAt(i + 2));
            const c3 = this.getBase64Index(cleaned.charAt(i + 3));
            
            if (outputIndex < outputLength) output[outputIndex++] = (c0 << 2) | (c1 >> 4);
            if (outputIndex < outputLength) output[outputIndex++] = ((c1 & 0x0F) << 4) | (c2 >> 2);
            if (outputIndex < outputLength) output[outputIndex++] = ((c2 & 0x03) << 6) | c3;
        }
        
        return output;
    }
    
    private getBase64Index(char: string): number {
        if (char === '=') return 0;
        const idx = MidiPadController.BASE64_CHARS.indexOf(char);
        return idx === -1 ? 0 : idx;
    }
    
    onDestroy(): void {
        this.releaseLayer();
        MidiPadController.allPads.delete(this.padIndex);
    }
}