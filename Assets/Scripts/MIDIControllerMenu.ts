/**
 * MidiControllerMenu.ts
 * Handles genre button UI and switching between 5 genres
 * Properly releases layers when switching
 */

import { Interactable } from 'SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable';
import { DJMidiManager } from './DJMidiManager';
import { AudioLayerManager } from './AudioLayerManager';
import { getGenreByMode, getGenreCount } from './GenreInstrumentData';

enum MidiMode {
    Mode1 = 1,
    Mode2 = 2, 
    Mode3 = 3,
    Mode4 = 4,
    Mode5 = 5
}

@component 
export class MidiControllerMenu extends BaseScriptComponent {
    
    // ═══════════════════════════════════════════════════════════════
    // GENRE BUTTONS (5 total)
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @hint("Genre 1 button (Electronic)")
    mode1Button: SceneObject;
    
    @input
    @hint("Genre 2 button (Hip Hop)")
    mode2Button: SceneObject;
    
    @input
    @hint("Genre 3 button (Lofi Jazz)")
    mode3Button: SceneObject;
    
    @input
    @hint("Genre 4 button (House)")
    mode4Button: SceneObject;
    
    @input
    @hint("Genre 5 button (Rock)")
    mode5Button: SceneObject;
    
    // ═══════════════════════════════════════════════════════════════
    // GENRE BUTTON LABELS (Text children)
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @hint("Text label for Genre 1 button")
    @allowUndefined
    mode1Label: Text;
    
    @input
    @hint("Text label for Genre 2 button")
    @allowUndefined
    mode2Label: Text;
    
    @input
    @hint("Text label for Genre 3 button")
    @allowUndefined
    mode3Label: Text;
    
    @input
    @hint("Text label for Genre 4 button")
    @allowUndefined
    mode4Label: Text;
    
    @input
    @hint("Text label for Genre 5 button")
    @allowUndefined
    mode5Label: Text;
    
    // ═══════════════════════════════════════════════════════════════
    // MIDI PAD BATCHES (5 total, 9 pads each)
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @hint("Batch 1: Electronic pads (9 buttons)")
    midiButtonsBatch1: SceneObject;
    
    @input
    @hint("Batch 2: Hip Hop pads (9 buttons)")
    midiButtonsBatch2: SceneObject; 
    
    @input
    @hint("Batch 3: Lofi Jazz pads (9 buttons)")
    midiButtonsBatch3: SceneObject;
    
    @input
    @hint("Batch 4: House pads (9 buttons)")
    midiButtonsBatch4: SceneObject;
    
    @input
    @hint("Batch 5: Rock pads (9 buttons)")
    midiButtonsBatch5: SceneObject;
    
    // ═══════════════════════════════════════════════════════════════
    // MENU UI
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @allowUndefined
    menuToggleButton: SceneObject;
    
    @input
    @allowUndefined
    menuContainer: SceneObject;
    
    @input
    @hint("Status/debug text")
    @allowUndefined
    debugText: Text;
    
    // ═══════════════════════════════════════════════════════════════
    // DJ MIDI MANAGER
    // ═══════════════════════════════════════════════════════════════
    
    @input
    @hint("DJMidiManager for Lyria generation")
    @allowUndefined
    djMidiManager: DJMidiManager;
    
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE STATE
    // ═══════════════════════════════════════════════════════════════
    
    private currentMode: MidiMode = MidiMode.Mode1;
    private isMenuVisible: boolean = true;
    private isInitialized: boolean = false;
    private isSwitching: boolean = false; // Prevent rapid switching
    private hasInitialGeneration: boolean = false; // Track if initial generation happened

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════════════

    onAwake(): void {
        print("[MidiControllerMenu] Awake");
        this.createEvent('OnStartEvent').bind(() => {
            this.onStartSetup();
        });
    }
    
    private onStartSetup(): void {
        print("[MidiControllerMenu] Setting up...");
        
        // Setup genre button labels
        this.setupGenreLabels();
        
        // Set initial state (Mode 1 active)
        this.setInitialState();
        
        // Setup button listeners
        this.setupButtonListeners();
        
        // Delay initial generation to ensure everything is ready
        const event = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
        event.bind(() => {
            if (this.djMidiManager && !this.hasInitialGeneration) {
                print("[MidiControllerMenu] Triggering delayed initial generation for Mode 1");
                this.djMidiManager.onGenreSelected(1);
                this.hasInitialGeneration = true;
            }
        });
        event.reset(1.0); // 1 second delay to ensure everything is initialized
        
        this.isInitialized = true;
        print("[MidiControllerMenu] Initialized with 5 genres");
    }
    
    // ═══════════════════════════════════════════════════════════════
    // SETUP
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Setup genre labels from GenreInstrumentData
     */
    private setupGenreLabels(): void {
        const labels = [this.mode1Label, this.mode2Label, this.mode3Label, this.mode4Label, this.mode5Label];
        
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            const genre = getGenreByMode(i + 1);
            
            if (label && genre) {
                label.text = `${genre.emoji} ${genre.name}`;
                print(`[MidiControllerMenu] Label ${i + 1}: ${genre.emoji} ${genre.name}`);
            }
        }
    }
    
    private setInitialState(): void {
        // Hide all batches first
        this.hideAllBatches();
        
        // Enable batch 1
        if (this.midiButtonsBatch1) this.midiButtonsBatch1.enabled = true;
        
        // Menu visible
        if (this.menuContainer) this.menuContainer.enabled = true;
        if (this.menuToggleButton) this.menuToggleButton.enabled = true;
        
        // Update debug text
        this.updateDebugText(1);
    }
    
    private hideAllBatches(): void {
        if (this.midiButtonsBatch1) this.midiButtonsBatch1.enabled = false;
        if (this.midiButtonsBatch2) this.midiButtonsBatch2.enabled = false;
        if (this.midiButtonsBatch3) this.midiButtonsBatch3.enabled = false;
        if (this.midiButtonsBatch4) this.midiButtonsBatch4.enabled = false;
        if (this.midiButtonsBatch5) this.midiButtonsBatch5.enabled = false;
    }
    
    private setupButtonListeners(): void {
        // Mode buttons
        this.setupModeButton(this.mode1Button, MidiMode.Mode1);
        this.setupModeButton(this.mode2Button, MidiMode.Mode2);
        this.setupModeButton(this.mode3Button, MidiMode.Mode3);
        this.setupModeButton(this.mode4Button, MidiMode.Mode4);
        this.setupModeButton(this.mode5Button, MidiMode.Mode5);
        
        // Menu toggle
        if (this.menuToggleButton) {
            const interactable = this.menuToggleButton.getComponent(Interactable.getTypeName()) as Interactable;
            if (interactable) {
                interactable.onInteractorTriggerEnd.add(() => {
                    this.toggleMenuVisibility();
                });
            }
        }
        
        print("[MidiControllerMenu] All button listeners setup");
    }
    
    private setupModeButton(button: SceneObject, mode: MidiMode): void {
        if (!button) return;
        
        const interactable = button.getComponent(Interactable.getTypeName()) as Interactable;
        if (interactable) {
            interactable.onInteractorTriggerEnd.add(() => {
                this.onModeButtonPressed(mode);
            });
            print(`[MidiControllerMenu] Mode ${mode} button listener added`);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // MODE SWITCHING
    // ═══════════════════════════════════════════════════════════════
    
    private onModeButtonPressed(mode: MidiMode): void {
        // Prevent rapid switching
        if (this.isSwitching) {
            print(`[MidiControllerMenu] Already switching, ignoring`);
            return;
        }
        
        // Check if already on this mode
        if (this.currentMode === mode) {
            // Check if this mode has any generated audio
            if (this.djMidiManager) {
                const pads = this.djMidiManager.getPadsForCurrentMode();
                const hasAnyAudio = pads.some(pad => pad.hasAudio());
                
                if (!hasAnyAudio) {
                    // No audio generated yet, allow re-triggering generation
                    print(`[MidiControllerMenu] Mode ${mode} selected but no audio generated, triggering generation...`);
                    this.isSwitching = true;
                    
                    // Trigger generation
                    this.djMidiManager.onGenreSelected(mode);
                    
                    // Reset switching flag after delay
                    const event = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
                    event.bind(() => {
                        this.isSwitching = false;
                    });
                    event.reset(0.5);
                    return;
                }
            }
            
            print(`[MidiControllerMenu] Already on mode ${mode} with audio generated`);
            return;
        }
        
        this.isSwitching = true;
        print(`[MidiControllerMenu] ═══════════════════════════════════════`);
        print(`[MidiControllerMenu] Switching from mode ${this.currentMode} to mode ${mode}`);
        
        // ═══════════════════════════════════════════════════════════
        // STEP 1: Release all layers BEFORE switching
        // ═══════════════════════════════════════════════════════════
        
        const manager = AudioLayerManager.getInstance();
        if (manager) {
            print(`[MidiControllerMenu] Before release: ${manager.getActiveLayerCount()} layers in use`);
            manager.releaseAllLayers();
            print(`[MidiControllerMenu] After release: ${manager.getActiveLayerCount()} layers in use`);
        }
        
        // ═══════════════════════════════════════════════════════════
        // STEP 2: Switch UI
        // ═══════════════════════════════════════════════════════════
        
        this.switchToMode(mode);
        
        // ═══════════════════════════════════════════════════════════
        // STEP 3: Notify DJMidiManager
        // ═══════════════════════════════════════════════════════════
        
        if (this.djMidiManager) {
            this.djMidiManager.onGenreSelected(mode);
        }
        
        // Reset switching flag after a short delay
        const event = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
        event.bind(() => {
            this.isSwitching = false;
        });
        event.reset(0.5); // 500ms cooldown
    }
    
    private switchToMode(mode: MidiMode): void {
        print(`[MidiControllerMenu] Switching UI to Mode ${mode}`);
        this.currentMode = mode;
        
        // Hide all batches
        this.hideAllBatches();
        
        // Enable the selected batch
        switch (mode) {
            case MidiMode.Mode1:
                if (this.midiButtonsBatch1) this.midiButtonsBatch1.enabled = true;
                break;
            case MidiMode.Mode2:
                if (this.midiButtonsBatch2) this.midiButtonsBatch2.enabled = true;
                break;
            case MidiMode.Mode3:
                if (this.midiButtonsBatch3) this.midiButtonsBatch3.enabled = true;
                break;
            case MidiMode.Mode4:
                if (this.midiButtonsBatch4) this.midiButtonsBatch4.enabled = true;
                break;
            case MidiMode.Mode5:
                if (this.midiButtonsBatch5) this.midiButtonsBatch5.enabled = true;
                break;
        }
        
        this.updateDebugText(mode);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════════════════════════
    
    private updateDebugText(mode: number): void {
        const genre = getGenreByMode(mode);
        if (this.debugText && genre) {
            this.debugText.text = `${genre.emoji} ${genre.name} @ ${genre.bpm} BPM`;
        }
    }
    
    private toggleMenuVisibility(): void {
        this.isMenuVisible = !this.isMenuVisible;
        if (this.menuContainer) this.menuContainer.enabled = this.isMenuVisible;
        if (this.menuToggleButton) this.menuToggleButton.enabled = true;
        print(`[MidiControllerMenu] Menu ${this.isMenuVisible ? "shown" : "hidden"}`);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════
    
    public getCurrentMode(): MidiMode {
        return this.currentMode;
    }
    
    public isReady(): boolean {
        return this.isInitialized;
    }
}