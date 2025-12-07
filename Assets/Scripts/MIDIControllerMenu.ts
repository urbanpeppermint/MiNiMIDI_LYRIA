/**
 * MidiControllerMenu.ts
 * Fixed: Auto-select disabled - ignores Inspector value
 */

import { Interactable } from 'SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable';
import { DJMidiManager } from './DJMidiManager';
import { getGenreByMode, getGenreCount } from './GenreInstrumentData';

enum MidiMode {
    None = 0,
    Mode1 = 1,
    Mode2 = 2, 
    Mode3 = 3,
    Mode4 = 4,
    Mode5 = 5
}

@component 
export class MidiControllerMenu extends BaseScriptComponent {
    
    @input
    @allowUndefined
    mode1Button: SceneObject;
    
    @input
    @allowUndefined
    mode2Button: SceneObject;
    
    @input
    @allowUndefined
    mode3Button: SceneObject;
    
    @input
    @allowUndefined
    mode4Button: SceneObject;
    
    @input
    @allowUndefined
    mode5Button: SceneObject;
    
    @input
    @allowUndefined
    mode1Label: Text;
    
    @input
    @allowUndefined
    mode2Label: Text;
    
    @input
    @allowUndefined
    mode3Label: Text;
    
    @input
    @allowUndefined
    mode4Label: Text;
    
    @input
    @allowUndefined
    mode5Label: Text;
    
    @input
    @allowUndefined
    menuToggleButton: SceneObject;
    
    @input
    @allowUndefined
    menuContainer: SceneObject;
    
    @input
    @allowUndefined
    debugText: Text;
    
    @input
    @allowUndefined
    djMidiManager: DJMidiManager;
    
    private currentMode: MidiMode = MidiMode.None;
    private isMenuVisible: boolean = true;
    private isInitialized: boolean = false;

    onAwake(): void {
        print("[MidiControllerMenu] Awake");
        this.createEvent('OnStartEvent').bind(() => {
            this.onStartSetup();
        });
    }
    
    private onStartSetup(): void {
        print("[MidiControllerMenu] Setting up...");
        
        this.setupGenreLabels();
        this.setInitialState();
        this.setupButtonListeners();
        
        this.isInitialized = true;
        print("[MidiControllerMenu] Ready - waiting for user to select genre");
        
        // NO AUTO-SELECT - user must choose
    }
    
    private setupGenreLabels(): void {
        const labels = [this.mode1Label, this.mode2Label, this.mode3Label, this.mode4Label, this.mode5Label];
        
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            const genre = getGenreByMode(i + 1);
            
            if (label && genre) {
                label.text = `${genre.emoji} ${genre.name}`;
            }
        }
    }
    
    private setInitialState(): void {
        if (this.menuContainer) this.menuContainer.enabled = true;
        if (this.menuToggleButton) this.menuToggleButton.enabled = true;
        
        if (this.debugText) {
            this.debugText.text = "Select a genre to start";
        }
    }
    
    private setupButtonListeners(): void {
        this.setupModeButton(this.mode1Button, MidiMode.Mode1);
        this.setupModeButton(this.mode2Button, MidiMode.Mode2);
        this.setupModeButton(this.mode3Button, MidiMode.Mode3);
        this.setupModeButton(this.mode4Button, MidiMode.Mode4);
        this.setupModeButton(this.mode5Button, MidiMode.Mode5);
        this.setupMenuToggle();
    }
    
    private setupModeButton(button: SceneObject | undefined, mode: MidiMode): void {
        if (!button) return;
        
        const interactable = button.getComponent(Interactable.getTypeName()) as Interactable;
        if (!interactable || !interactable.onInteractorTriggerEnd) return;
        
        interactable.onInteractorTriggerEnd.add(() => {
            this.onModeButtonPressed(mode);
        });
    }
    
    private setupMenuToggle(): void {
        if (!this.menuToggleButton) return;
        
        const interactable = this.menuToggleButton.getComponent(Interactable.getTypeName()) as Interactable;
        if (!interactable || !interactable.onInteractorTriggerEnd) return;
        
        interactable.onInteractorTriggerEnd.add(() => {
            this.toggleMenuVisibility();
        });
    }
    
    private onModeButtonPressed(mode: MidiMode): void {
        print(`[MidiControllerMenu] Mode ${mode} selected`);
        
        this.currentMode = mode;
        this.updateDebugText(mode);
        
        if (this.djMidiManager) {
            this.djMidiManager.onGenreSelected(mode);
        }
    }
    
    private updateDebugText(mode: number): void {
        const genre = getGenreByMode(mode);
        if (this.debugText && genre) {
            this.debugText.text = `${genre.emoji} ${genre.name} @ ${genre.bpm} BPM`;
        }
    }
    
    private toggleMenuVisibility(): void {
        this.isMenuVisible = !this.isMenuVisible;
        if (this.menuContainer) this.menuContainer.enabled = this.isMenuVisible;
    }
    
    public getCurrentMode(): MidiMode {
        return this.currentMode;
    }
}