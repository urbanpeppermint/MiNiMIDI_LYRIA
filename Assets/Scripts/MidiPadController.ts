/**
 * MidiPadController.ts
 * Controls a single MIDI pad with dynamic layer acquisition
 */

import { Interactable } from 'SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable';
import { AudioLayerManager } from './AudioLayerManager';

export enum PadState {
    Empty = 0,
    Loading = 1,
    Ready = 2,
    Playing = 3,
    Error = 4
}

@component
export class MidiPadController extends BaseScriptComponent {
    
    // ═══════════════════════════════════════════════════════════════
    // INPUTS
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @hint("Pad index (0-8)")
    padIndex: number = 0;
    
    @input
    @hint("Genre ID this pad belongs to (1-5)")
    genreId: number = 1;
    
    @input
    @hint("Visual mesh for the pad")
    @allowUndefined
    padMesh: RenderMeshVisual;
    
    @input
    @hint("Material for empty state")
    @allowUndefined
    emptyMaterial: Material;
    
    @input
    @hint("Material for loading state")
    @allowUndefined
    loadingMaterial: Material;
    
    @input
    @hint("Material for ready state")
    @allowUndefined
    readyMaterial: Material;
    
    @input
    @hint("Material for playing state")
    @allowUndefined
    playingMaterial: Material;
    
    @input
    @hint("Material for error state")
    @allowUndefined
    errorMaterial: Material;
    
    @input
    @hint("Optional label text")
    @allowUndefined
    labelText: Text;
    
    @input
    @hint("Optional emoji text")
    @allowUndefined
    emojiText: Text;
    
    // ═══════════════════════════════════════════════════════════════
    // CALLBACKS
    // ═══════════════════════════════════════════════════════════════
    
    public onPadToggled: ((padIndex: number, isPlaying: boolean, pad: MidiPadController) => void)[] = [];
    
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE STATE
    // ═══════════════════════════════════════════════════════════════
    
    private _state: PadState = PadState.Empty;
    private _instrumentId: string = "";
    private _instrumentName: string = "";
    private _instrumentEmoji: string = "";
    private _isPlaying: boolean = false;
    private _audioData: Uint8Array | null = null;
    private _ownerId: string = "";
    private _layerIndex: number = -1;
    private _interactable: Interactable | null = null;
    
    // Base64 lookup table
    private static readonly BASE64_CHARS: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    
    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════════════
    
    onAwake(): void {
        // Create unique owner ID: "genre_padIndex"
        this._ownerId = `g${this.genreId}_p${this.padIndex}`;
        
        this.createEvent('OnStartEvent').bind(() => {
            this.setupInteraction();
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
            print(`[Pad ${this.padIndex}] Interaction setup complete`);
        } else {
            print(`[Pad ${this.padIndex}] WARNING: No Interactable component found`);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // TAP HANDLER
    // ═══════════════════════════════════════════════════════════════
    
    private onPadTapped(): void {
        print(`[Pad ${this.padIndex}] Tapped (${this._instrumentName}) - State: ${this._state}, HasAudio: ${this._audioData !== null}, Layer: ${this._layerIndex}`);
        
        // Check if ready
        if (this._state !== PadState.Ready && this._state !== PadState.Playing) {
            print(`[Pad ${this.padIndex}] Not ready!`);
            return;
        }
        
        // Toggle play/stop
        if (this._isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PLAYBACK CONTROL
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Play the pad - acquire layer dynamically
     */
    public play(): void {
        if (this._state !== PadState.Ready && this._state !== PadState.Playing) {
            print(`[Pad ${this.padIndex}] Cannot play - not ready (state: ${this._state})`);
            return;
        }
        
        if (!this._audioData) {
            print(`[Pad ${this.padIndex}] Cannot play - no audio data`);
            return;
        }
        
        const manager = AudioLayerManager.getInstance();
        if (!manager) {
            print(`[Pad ${this.padIndex}] Cannot play - no AudioLayerManager`);
            return;
        }
        
        // Acquire layer if we don't have one
        if (this._layerIndex < 0) {
            this._layerIndex = manager.acquireLayer(this._ownerId);
            print(`[Pad ${this.padIndex}] Acquired layer: ${this._layerIndex}`);
        }
        
        if (this._layerIndex < 0) {
            print(`[Pad ${this.padIndex}] Could not acquire layer! (${manager.getActiveLayerCount()}/${10} in use)`);
            return;
        }
        
        // Play audio
        manager.playOnLayer(this._layerIndex, this._audioData);
        
        this._state = PadState.Playing;
        this._isPlaying = true;
        this.updateVisuals();
        
        print(`[Pad ${this.padIndex}] ${this._instrumentEmoji} ${this._instrumentName} ▶ PLAYING on layer ${this._layerIndex}`);
        
        // Notify callbacks
        this.onPadToggled.forEach(cb => cb(this.padIndex, true, this));
    }
    
    /**
     * Stop the pad - release layer
     */
    public stop(): void {
        const manager = AudioLayerManager.getInstance();
        
        if (manager && this._layerIndex >= 0) {
            manager.stopLayer(this._layerIndex);
            manager.releaseLayer(this._layerIndex);
            print(`[Pad ${this.padIndex}] Released layer ${this._layerIndex}`);
        }
        
        this._layerIndex = -1;
        this._isPlaying = false;
        
        if (this._state === PadState.Playing) {
            this._state = PadState.Ready;
        }
        
        this.updateVisuals();
        
        print(`[Pad ${this.padIndex}] ${this._instrumentEmoji} ${this._instrumentName} ⏹ STOPPED`);
        
        // Notify callbacks
        this.onPadToggled.forEach(cb => cb(this.padIndex, false, this));
    }
    
    /**
     * Force release layer (called when switching genres)
     */
    public releaseLayer(): void {
        const manager = AudioLayerManager.getInstance();
        
        if (manager && this._layerIndex >= 0) {
            manager.stopLayer(this._layerIndex);
            manager.releaseLayer(this._layerIndex);
            print(`[Pad ${this.padIndex}] Force released layer ${this._layerIndex}`);
        }
        
        this._layerIndex = -1;
        this._isPlaying = false;
        
        if (this._state === PadState.Playing) {
            this._state = PadState.Ready;
        }
        
        this.updateVisuals();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Configure the pad for an instrument
     */
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
    
    /**
     * Load audio data from base64
     */
    public loadAudioB64(base64Data: string): void {
        try {
            const decoded = this.decodeBase64(base64Data);
            this._audioData = decoded;
            this._state = PadState.Ready;
            this.updateVisuals();
            print(`[Pad ${this.padIndex}] ${this._instrumentName} loaded: ${decoded.length} bytes`);
        } catch (e) {
            print(`[Pad ${this.padIndex}] Error loading audio: ${e}`);
            this._state = PadState.Error;
            this.updateVisuals();
        }
    }
    
    /**
     * Load audio data directly
     */
    public loadAudioData(audioData: Uint8Array): void {
        this._audioData = audioData;
        this._state = PadState.Ready;
        this.updateVisuals();
        print(`[Pad ${this.padIndex}] ${this._instrumentName} loaded: ${audioData.length} bytes`);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════
    
    public setState(state: PadState): void {
        this._state = state;
        this.updateVisuals();
    }
    
    public setLoading(): void {
        this._state = PadState.Loading;
        this.updateVisuals();
    }
    
    public setError(): void {
        this._state = PadState.Error;
        this.updateVisuals();
    }
    
    public setReady(): void {
        this._state = PadState.Ready;
        this.updateVisuals();
    }
    
    /**
     * Reset pad to empty state (for genre switching)
     */
    public reset(): void {
        this.releaseLayer();
        this._audioData = null;
        this._state = PadState.Empty;
        this._isPlaying = false;
        this.updateVisuals();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════
    
    public getState(): PadState {
        return this._state;
    }
    
    public getPadIndex(): number {
        return this.padIndex;
    }
    
    public getGenreId(): number {
        return this.genreId;
    }
    
    public getInstrumentId(): string {
        return this._instrumentId;
    }
    
    public getInstrumentName(): string {
        return this._instrumentName;
    }
    
    public isPlaying(): boolean {
        return this._isPlaying;
    }
    
    public hasAudio(): boolean {
        return this._audioData !== null;
    }
    
    public getLayerIndex(): number {
        return this._layerIndex;
    }
    
    public getOwnerId(): string {
        return this._ownerId;
    }
    
    public getAudioData(): Uint8Array | null {
        return this._audioData;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // VISUALS
    // ═══════════════════════════════════════════════════════════════
    
    private updateVisuals(): void {
        if (!this.padMesh) return;
        
        let material: Material | null = null;
        
        switch (this._state) {
            case PadState.Empty:
                material = this.emptyMaterial;
                break;
            case PadState.Loading:
                material = this.loadingMaterial;
                break;
            case PadState.Ready:
                material = this.readyMaterial;
                break;
            case PadState.Playing:
                material = this.playingMaterial;
                break;
            case PadState.Error:
                material = this.errorMaterial;
                break;
        }
        
        if (material) {
            this.padMesh.mainMaterial = material;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // BASE64 DECODE (Lens Studio compatible - no atob)
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Decode base64 string to Uint8Array
     * Custom implementation that doesn't rely on atob
     */
    private decodeBase64(base64: string): Uint8Array {
        // Remove any whitespace and padding
        const cleanedBase64 = base64.replace(/[\s]/g, '');
        
        // Calculate output length
        let padding = 0;
        if (cleanedBase64.endsWith('==')) {
            padding = 2;
        } else if (cleanedBase64.endsWith('=')) {
            padding = 1;
        }
        
        const outputLength = Math.floor((cleanedBase64.length * 3) / 4) - padding;
        const output = new Uint8Array(outputLength);
        
        let outputIndex = 0;
        
        for (let i = 0; i < cleanedBase64.length; i += 4) {
            // Get indices for 4 base64 characters
            const c0 = this.getBase64CharIndex(cleanedBase64.charAt(i));
            const c1 = this.getBase64CharIndex(cleanedBase64.charAt(i + 1));
            const c2 = this.getBase64CharIndex(cleanedBase64.charAt(i + 2));
            const c3 = this.getBase64CharIndex(cleanedBase64.charAt(i + 3));
            
            // Combine into bytes
            if (outputIndex < outputLength) {
                output[outputIndex++] = (c0 << 2) | (c1 >> 4);
            }
            if (outputIndex < outputLength) {
                output[outputIndex++] = ((c1 & 0x0F) << 4) | (c2 >> 2);
            }
            if (outputIndex < outputLength) {
                output[outputIndex++] = ((c2 & 0x03) << 6) | c3;
            }
        }
        
        return output;
    }
    
    /**
     * Get index of base64 character
     */
    private getBase64CharIndex(char: string): number {
        if (char === '=') return 0;
        
        const index = MidiPadController.BASE64_CHARS.indexOf(char);
        if (index === -1) {
            print(`[Pad ${this.padIndex}] Invalid base64 character: ${char}`);
            return 0;
        }
        return index;
    }
}