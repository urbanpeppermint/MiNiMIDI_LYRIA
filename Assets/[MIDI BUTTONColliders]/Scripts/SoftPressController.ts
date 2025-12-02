import { mix } from "SpectaclesInteractionKit/Utils/animate";
import { clamp } from "SpectaclesInteractionKit/Utils/mathUtils";
import { Slider } from "SpectaclesInteractionKit/Components/UI/Slider/Slider";

@component
export class MIDIButtonController extends BaseScriptComponent {
  @input
  @hint("The collider that will detect the soft press interaction")
  colliderObject: SceneObject;
  
  @input
  @hint("SIK Slider component for crossfade control")
  public crossfadeSlider: Slider;
  
  @input
  @hint("SIK Slider component for audio position/seek control")
  public audioPositionSlider: Slider;
  
  @input
  @hint("First interactor object (e.g., left hand finger tip)")
  interactorObject1: SceneObject;

  @input
  @allowUndefined
  @hint("Second interactor object (e.g., right hand finger tip)")
  interactorObject2: SceneObject;

  @input
  @allowUndefined
  @hint("Optional: A SceneObject to visually mark the closest point on the line (for debugging)")
  closestPointMarker: SceneObject;

  @input
  @allowUndefined
  @hint("The 3D SceneObject that will move based on press detection (your button mesh)")
  pressableVisual: SceneObject;

  @input
  @hint("Top vertex 0 of the collider cube")
  topVertex0: SceneObject;

  @input
  @hint("Top vertex 1 of the collider cube")
  topVertex1: SceneObject;

  @input
  @hint("Top vertex 2 of the collider cube")
  topVertex2: SceneObject;

  @input
  @hint("Top vertex 3 of the collider cube")
  topVertex3: SceneObject;

  @input
  @hint("Bottom vertex 0 of the collider cube")
  bottomVertex0: SceneObject;

  @input
  @hint("Bottom vertex 1 of the collider cube")
  bottomVertex1: SceneObject;

  @input
  @hint("Bottom vertex 2 of the collider cube")
  bottomVertex2: SceneObject;

  @input
  @hint("Bottom vertex 3 of the collider cube")
  bottomVertex3: SceneObject;

  @input
  @hint("The threshold for triggering the press event (0 to 1)")
  pressThreshold: number = 0.7;

  @input
  @hint("Time (in seconds) for the press value to smoothly reset to 0 after exit")
  resetDuration: number = 1.0;

  @input
  @hint("Vertical movement distance for button press animation (in local units)")
  buttonMoveDistance: number = 5.0; // 5 units down and up

  @input
  @hint("Audio asset to play when the button is pressed")
  noteAudioAsset: AudioTrackAsset;

  @input
  @hint("The image texture for the button when OFF (inactive)")
  buttonOffTexture: Texture;

  @input
  @hint("The image texture for the button when ON (active)")
  buttonOnTexture: Texture;

  @input
  @hint("Reference to the button's image component")
  buttonImage: Image;

  @input
  @hint("Note ID or MIDI number for this button")
  noteId: number = 0;

  @input
  @hint("Enable audio position slider control for this button")
  enableAudioSeeking: boolean = true;

  // Static variables to track global state across all buttons
  private static playingTracks: AudioComponent[] = [];
  private static maxPlayingTracks: number = 2;

  private collider: ColliderComponent;
  private activeInteractors: Map<number, SceneObject> = new Map();
  private pressValues: Map<number, number> = new Map();
  private isResetting: boolean = false;
  private resetProgress: number = 0;
  private localTop: vec3;
  private localBottom: vec3;
  private lastClosestPointsLocal: Map<number, vec3> = new Map();
  private hasTriggeredEvent: boolean = false;
  
  // MIDI state variables
  private isNoteOn: boolean = false;
  private audioComponent: AudioComponent;
  private isAudioPlaying: boolean = false;
  private materialInstance: Material = null;

  // Button animation variables
  private originalButtonPosition: vec3;
  private isButtonAnimating: boolean = false;
  private buttonAnimationEvent: SceneEvent = null;

  // Audio position control variables
  private lastAudioPosition: number = 0;
  private isSeekingEnabled: boolean = false;

  onAwake() {
    // Get the collider component
    this.collider = this.colliderObject.getComponent("Physics.ColliderComponent");
    
    // Initialize audio component
    this.audioComponent = this.getSceneObject().createComponent("Component.AudioComponent");
    if (this.noteAudioAsset) {
      this.audioComponent.audioTrack = this.noteAudioAsset;
    }

    // Store original position of the button mesh
    if (this.pressableVisual) {
      this.originalButtonPosition = this.pressableVisual.getTransform().getLocalPosition();
    }

    // Create a unique material instance for this button
    if (this.buttonImage && this.buttonImage.mainMaterial) {
      this.materialInstance = this.buttonImage.mainMaterial.clone();
      this.buttonImage.mainMaterial = this.materialInstance;
      
      // Set initial button texture to OFF
      if (this.buttonOffTexture) {
        this.materialInstance.mainPass.baseTex = this.buttonOffTexture;
      }
    }

    // Bind events
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
      print("OnStart event triggered");
    });

    this.createEvent("UpdateEvent").bind(() => {
      this.update();
    });

    // Calculate vertex positions (same as original)
    const topPositions = [
      this.topVertex0.getTransform().getWorldPosition(),
      this.topVertex1.getTransform().getWorldPosition(),
      this.topVertex2.getTransform().getWorldPosition(),
      this.topVertex3.getTransform().getWorldPosition(),
    ];
    const bottomPositions = [
      this.bottomVertex0.getTransform().getWorldPosition(),
      this.bottomVertex1.getTransform().getWorldPosition(),
      this.bottomVertex2.getTransform().getWorldPosition(),
      this.bottomVertex3.getTransform().getWorldPosition(),
    ];

    const worldTop = topPositions
      .reduce((sum, pos) => sum.add(pos), vec3.zero())
      .scale(new vec3(0.25, 0.25, 0.25));
    const worldBottom = bottomPositions
      .reduce((sum, pos) => sum.add(pos), vec3.zero())
      .scale(new vec3(0.25, 0.25, 0.25));

    const colliderTransform = this.colliderObject.getTransform();
    const inverseWorldTransform = colliderTransform.getInvertedWorldTransform();
    this.localTop = inverseWorldTransform.multiplyPoint(worldTop);
    this.localBottom = inverseWorldTransform.multiplyPoint(worldBottom);

    this.updateButtonVisuals(false);
  }

  onStart() {
    // Setup overlap events (same as original)
    this.collider.onOverlapEnter.add((e) => {
      const overlap = e.overlap;
      const interactingObject = overlap.collider.getSceneObject();
      
      if (this.isRegisteredInteractor(interactingObject)) {
        if (this.isEnteringFromTop(interactingObject)) {
          print(`OverlapEnter(${overlap.id}): Interactor entered from the top. Starting soft press interaction.`);
          this.activeInteractors.set(overlap.id, interactingObject);
          this.pressValues.set(overlap.id, 0);
          this.lastClosestPointsLocal.set(overlap.id, this.localTop);
          this.isResetting = false;
          this.resetProgress = 0;
        } else {
          print(`OverlapEnter(${overlap.id}): Interactor did not enter from the top. Ignoring.`);
        }
      }
    });

    this.collider.onOverlapStay.add((e) => {
      const overlap = e.overlap;
      const interactingObject = overlap.collider.getSceneObject();
      
      if (this.activeInteractors.has(overlap.id) && this.activeInteractors.get(overlap.id) === interactingObject) {
        this.calculatePressValue(overlap.id, interactingObject);
      }
    });

    this.collider.onOverlapExit.add((e) => {
      const overlap = e.overlap;
      if (this.activeInteractors.has(overlap.id)) {
        print(`OverlapExit(${overlap.id}): Interactor exited the collider.`);
        
        this.activeInteractors.delete(overlap.id);
        
        if (this.activeInteractors.size === 0) {
          print("No more active interactors. Starting smooth reset of press value.");
          this.isResetting = true;
          this.resetProgress = 0;
        }
      }
    });
    
    // Initialize crossfade control with SIK slider
    this.initializeCrossfadeControl();
    
    // Initialize audio position control with SIK slider
    this.initializeAudioPositionControl();
  }
  
  private initializeCrossfadeControl() {
    if (this.crossfadeSlider) {
      // Subscribe to slider value changes using SIK's callback system
      this.crossfadeSlider.onValueUpdate.add((normalizedValue: number) => {
        this.onCrossfadeValueChanged(normalizedValue);
      });
      
      print("Connected to SIK crossfade slider value updates");
    } else {
      print("No crossfade slider provided");
    }
  }

  private initializeAudioPositionControl() {
    if (this.audioPositionSlider && this.enableAudioSeeking) {
      // Subscribe to slider value changes for audio position control
      this.audioPositionSlider.onValueUpdate.add((normalizedValue: number) => {
        this.onAudioPositionValueChanged(normalizedValue);
      });
      
      print("Connected to SIK audio position slider value updates");
    } else {
      print("No audio position slider provided or seeking disabled");
    }
  }

  private onAudioPositionValueChanged(normalizedValue: number) {
    if (!this.enableAudioSeeking || !this.audioComponent || !this.audioComponent.audioTrack) {
      return;
    }

    // Calculate the target position based on audio duration
    const audioDuration = this.audioComponent.duration;
    const targetPosition = normalizedValue * audioDuration;
    
    // Apply seeking to all currently playing tracks that belong to this button
    this.seekAudioPosition(targetPosition);
    
    print(`🎵 Audio position slider: ${(normalizedValue * 100).toFixed(1)}% (${targetPosition.toFixed(2)}s / ${audioDuration.toFixed(2)}s)`);
  }

  private seekAudioPosition(positionInSeconds: number) {
    if (!this.audioComponent || !this.audioComponent.audioTrack) {
      return;
    }

    try {
      // Clamp the position to valid range
      const clampedPosition = clamp(positionInSeconds, 0, this.audioComponent.duration);
      
      // Apply seek to this button's audio component if it's currently playing
      if (this.isAudioPlaying && this.audioComponent.isPlaying()) {
        const wasPlaying = this.audioComponent.isPlaying();
        
        // Set the audio position
        this.audioComponent.position = clampedPosition;
        
        // If it was playing, ensure it continues playing from the new position
        if (wasPlaying && !this.audioComponent.isPlaying()) {
          this.audioComponent.play(-1);
        }
        
        this.lastAudioPosition = clampedPosition;
        print(`Seeked note ${this.noteId} to position ${clampedPosition.toFixed(2)}s`);
      }
      
    } catch (error) {
      print(`Error seeking audio position for note ${this.noteId}: ${error}`);
    }
  }

  // Helper method to get current audio position slider value
  private getCurrentAudioPositionValue(): number {
    if (this.audioPositionSlider && this.audioPositionSlider.currentValue !== null) {
      return this.audioPositionSlider.currentValue;
    }
    return 0.0; // Default to beginning if no slider
  }

  private onCrossfadeValueChanged(normalizedValue: number) {
    const volumes = this.getCrossfadeVolumes(normalizedValue);
    this.applyCrossfadeVolumes(volumes.a, volumes.b);
    
    // More detailed logging
    if (normalizedValue < 0.1) {
      print(`🎛️ Crossfader near A: Track A dominant (${(volumes.a*100).toFixed(0)}%), Track B quiet (${(volumes.b*100).toFixed(0)}%)`);
    } else if (normalizedValue > 0.9) {
      print(`🎛️ Crossfader near B: Track B dominant (${(volumes.b*100).toFixed(0)}%), Track A quiet (${(volumes.a*100).toFixed(0)}%)`);
    } else {
      print(`🎛️ Crossfader center: Track A=${(volumes.a*100).toFixed(0)}%, Track B=${(volumes.b*100).toFixed(0)}%`);
    }
  }

  private getCrossfadeVolumes(norm: number): {a: number, b: number} {
    // norm = 0.0 means slider is at A side (A loud, B quiet)
    // norm = 1.0 means slider is at B side (B loud, A quiet)
    // norm = 0.5 means center (both equal)
    
    return {
      a: 1.0 - norm,  // Track A (first of last 2): loud when slider near A (norm=0)
      b: norm         // Track B (second of last 2): loud when slider near B (norm=1)
    };
  }

  private applyCrossfadeVolumes(volumeA: number, volumeB: number) {
    if (MIDIButtonController.playingTracks.length >= 2) {
      // Apply volumes to the last two playing tracks
      // A = second-to-last (older of the two)
      // B = last (newer of the two)
      const trackA = MIDIButtonController.playingTracks[MIDIButtonController.playingTracks.length - 2];
      const trackB = MIDIButtonController.playingTracks[MIDIButtonController.playingTracks.length - 1];
      
      try {
        trackA.volume = volumeA;
        trackB.volume = volumeB;
        print(`🎛️ Crossfade applied: Track A (older) vol=${volumeA.toFixed(2)}, Track B (newer) vol=${volumeB.toFixed(2)}`);
      } catch (error) {
        print(`Error applying crossfade volumes: ${error}`);
      }
    } else if (MIDIButtonController.playingTracks.length === 1) {
      // Only one track playing, set full volume
      try {
        MIDIButtonController.playingTracks[0].volume = 1.0;
        print(`🎛️ Single track playing at full volume`);
      } catch (error) {
        print(`Error setting single track volume: ${error}`);
      }
    }
  }

  // Manage global playing tracks
  private static addPlayingTrack(audioComponent: AudioComponent) {
    // Remove if already exists
    const index = MIDIButtonController.playingTracks.indexOf(audioComponent);
    if (index !== -1) {
      MIDIButtonController.playingTracks.splice(index, 1);
    }
    
    // Add to end (this becomes the new "B" track)
    MIDIButtonController.playingTracks.push(audioComponent);
    
    // Keep only the last 2 tracks, but DON'T stop the older ones
    // Just remove them from crossfade control
    if (MIDIButtonController.playingTracks.length > MIDIButtonController.maxPlayingTracks) {
      MIDIButtonController.playingTracks.shift(); // Remove from crossfade control but keep playing
    }
    
    print(`Playing tracks count: ${MIDIButtonController.playingTracks.length}`);
  }

  private static removePlayingTrack(audioComponent: AudioComponent) {
    const index = MIDIButtonController.playingTracks.indexOf(audioComponent);
    if (index !== -1) {
      MIDIButtonController.playingTracks.splice(index, 1);
    }
  }

  // Helper method to get current crossfade value (useful for applying to new tracks)
  private getCurrentCrossfadeValue(): number {
    if (this.crossfadeSlider && this.crossfadeSlider.currentValue !== null) {
      return this.crossfadeSlider.currentValue;
    }
    return 0.5; // Default to center if no slider
  }

  // Button animation methods - discrete movement animation
  private animateButtonPress() {
    if (!this.pressableVisual || this.isButtonAnimating) return;
    
    this.isButtonAnimating = true;
    this.cancelButtonAnimation(); // Cancel any existing animation
    
    let animationTime = 0;
    const totalDuration = this.resetDuration; // Use the same duration as the press simulation
    const halfDuration = totalDuration / 2;
    
    this.buttonAnimationEvent = this.createEvent("UpdateEvent");
    this.buttonAnimationEvent.bind(() => {
      animationTime += getDeltaTime();
      
      let currentYOffset = 0;
      
      if (animationTime <= halfDuration) {
        // First half: move down from 0 to -buttonMoveDistance
        const progress = animationTime / halfDuration;
        currentYOffset = -this.buttonMoveDistance * progress;
      } else if (animationTime <= totalDuration) {
        // Second half: move up from -buttonMoveDistance back to 0
        const progress = (animationTime - halfDuration) / halfDuration;
        currentYOffset = -this.buttonMoveDistance * (1 - progress);
      } else {
        // Animation complete
        currentYOffset = 0;
        this.isButtonAnimating = false;
        this.cancelButtonAnimation();
      }
      
      // Apply the Y offset to the button's original position
      const newPosition = new vec3(
        this.originalButtonPosition.x,
        this.originalButtonPosition.y + currentYOffset,
        this.originalButtonPosition.z
      );
      
      this.pressableVisual.getTransform().setLocalPosition(newPosition);
    });
    this.buttonAnimationEvent.enabled = true;
    
    print(`Started button animation for note ${this.noteId} - moving ${this.buttonMoveDistance} units down and up over ${totalDuration} seconds`);
  }

  private cancelButtonAnimation() {
    if (this.buttonAnimationEvent) {
      this.buttonAnimationEvent.enabled = false;
      this.buttonAnimationEvent = null;
    }
  }

  // Same helper methods as original (unchanged)
  private isRegisteredInteractor(object: SceneObject): boolean {
    return object === this.interactorObject1 || 
           (this.interactorObject2 && object === this.interactorObject2);
  }

  private isEnteringFromTop(interactorObject: SceneObject): boolean {
    const interactorPos = interactorObject.getTransform().getWorldPosition();
    const colliderPos = this.colliderObject.getTransform().getWorldPosition();
    const colliderUp = this.colliderObject.getTransform().up;

    const directionToInteractor = interactorPos.sub(colliderPos).normalize();
    const dot = directionToInteractor.dot(colliderUp);

    return dot > 0.5;
  }

  private calculatePressValue(overlapId: number, interactorObject: SceneObject) {
    const interactorPos = interactorObject.getTransform().getWorldPosition();

    const colliderTransform = this.colliderObject.getTransform();
    const inverseWorldTransform = colliderTransform.getInvertedWorldTransform();
    const interactorPosLocal = inverseWorldTransform.multiplyPoint(interactorPos);

    const worldTop = colliderTransform.getWorldTransform().multiplyPoint(this.localTop);
    const worldBottom = colliderTransform.getWorldTransform().multiplyPoint(this.localBottom);

    const topToBottom = worldBottom.sub(worldTop);
    const topToInteractor = interactorPos.sub(worldTop);

    const projectionRatio = clamp(
      topToInteractor.dot(topToBottom) / topToBottom.dot(topToBottom),
      0,
      1
    );

    const closestPointWorld = worldTop.add(topToBottom.scale(new vec3(projectionRatio, projectionRatio, projectionRatio)));
    const closestPointLocal = inverseWorldTransform.multiplyPoint(closestPointWorld);
    this.lastClosestPointsLocal.set(overlapId, closestPointLocal);

    const localTopToBottom = this.localBottom.sub(this.localTop);
    const topToClosest = closestPointLocal.sub(this.localTop);
    const projectionLength = topToClosest.dot(localTopToBottom.normalize());
    const totalLength = localTopToBottom.length;

    const newPressValue = clamp(projectionLength / totalLength, 0, 1);
    this.pressValues.set(overlapId, newPressValue);

    if (this.closestPointMarker) {
      this.closestPointMarker.getTransform().setWorldPosition(closestPointWorld);
    }

    let maxPressValue = 0;
    for (const value of this.pressValues.values()) {
      if (value > maxPressValue) {
        maxPressValue = value;
      }
    }

    if (maxPressValue >= this.pressThreshold && !this.hasTriggeredEvent) {
      this.onPressThresholdReached();
      this.hasTriggeredEvent = true;
    }

    if (maxPressValue < this.pressThreshold && this.hasTriggeredEvent) {
      print("Press value dropped below threshold. Event can trigger again on next press.");
      this.hasTriggeredEvent = false;
    }
  }

  private smoothReset() {
    if (!this.isResetting) return;

    this.resetProgress += getDeltaTime() / this.resetDuration;
    this.resetProgress = clamp(this.resetProgress, 0, 1);

    let lastPointLocal = this.localTop;
    for (const point of this.lastClosestPointsLocal.values()) {
      lastPointLocal = point;
      break;
    }

    const interpolatedPointLocal = mix(lastPointLocal, this.localTop, this.resetProgress);

    const topToBottom = this.localBottom.sub(this.localTop);
    const topToCurrent = interpolatedPointLocal.sub(this.localTop);
    const projectionLength = topToCurrent.dot(topToBottom.normalize());
    const totalLength = topToBottom.length;
    const resetPressValue = clamp(projectionLength / totalLength, 0, 1);

    if (this.closestPointMarker) {
      const colliderTransform = this.colliderObject.getTransform();
      const interpolatedPointWorld = colliderTransform.getWorldTransform().multiplyPoint(interpolatedPointLocal);
      this.closestPointMarker.getTransform().setWorldPosition(interpolatedPointWorld);
    }

    if (resetPressValue < this.pressThreshold && this.hasTriggeredEvent) {
      print("Press value reset below threshold during smooth reset. Event can trigger again on next press.");
      this.hasTriggeredEvent = false;
    }

    if (this.resetProgress >= 1) {
      this.isResetting = false;
      this.resetProgress = 0;
      this.pressValues.clear();
      this.lastClosestPointsLocal.clear();
      print("Smooth reset complete.");
    }
  }

  private onPressThresholdReached() {
    print(`Press threshold of ${this.pressThreshold} reached! Triggering MIDI button toggle and animation.`);
    this.toggleNoteState();
    this.animateButtonPress(); // Trigger the button animation
  }
  
  private toggleNoteState() {
    this.isNoteOn = !this.isNoteOn;
    if (this.isNoteOn) {
      this.playNote();
    } else {
      this.stopNote();
    }
    this.updateButtonVisuals(this.isNoteOn);
  }

  private playNote() {
    if (this.audioComponent && this.noteAudioAsset) {
      try {
        this.audioComponent.stop(true);
        
        // Apply current audio position if seeking is enabled
        if (this.enableAudioSeeking) {
          const currentPositionValue = this.getCurrentAudioPositionValue();
          const targetPosition = currentPositionValue * this.audioComponent.duration;
          this.audioComponent.position = clamp(targetPosition, 0, this.audioComponent.duration);
        }
        
        this.audioComponent.play(-1);
        this.isAudioPlaying = true;

        // Add to global playing tracks
        MIDIButtonController.addPlayingTrack(this.audioComponent);
        
        // Apply current crossfade settings to the newly added track
        const currentCrossfadeValue = this.getCurrentCrossfadeValue();
        const volumes = this.getCrossfadeVolumes(currentCrossfadeValue);
        this.applyCrossfadeVolumes(volumes.a, volumes.b);
        
        const positionInfo = this.enableAudioSeeking ? 
          ` starting at ${(this.audioComponent.position).toFixed(2)}s` : '';
        print(`🎵 Playing note ${this.noteId} with crossfade support at position ${currentCrossfadeValue.toFixed(2)}${positionInfo}`);
      } catch (error) {
        print(`❌ Error playing audio for note ${this.noteId}: ${error}`);
      }
    } else {
      print("⚠️ Cannot play note: Audio asset or component missing");
    }
  }

  private stopNote() {
    try {
      if (this.audioComponent) {
        // Remove from global playing tracks
        MIDIButtonController.removePlayingTrack(this.audioComponent);
        
        this.audioComponent.stop(true);
        this.isAudioPlaying = false;
        
        // Reapply crossfade to remaining tracks
        const currentCrossfadeValue = this.getCurrentCrossfadeValue();
        const volumes = this.getCrossfadeVolumes(currentCrossfadeValue);
        this.applyCrossfadeVolumes(volumes.a, volumes.b);
        
        print(`Stopped note ${this.noteId}`);
      }
    } catch (error) {
      print(`Error stopping audio: ${error}`);
    }
  }

  private updateButtonVisuals(isOn: boolean) {
    if (this.materialInstance) {
      if (isOn && this.buttonOnTexture) {
        this.materialInstance.mainPass.baseTex = this.buttonOnTexture;
      } else if (!isOn && this.buttonOffTexture) {
        this.materialInstance.mainPass.baseTex = this.buttonOffTexture;
      }
    } else {
      print("Material instance not created - visual toggle may not work correctly");
    }
  }

  private update() {
    for (const [overlapId, interactor] of this.activeInteractors.entries()) {
      this.calculatePressValue(overlapId, interactor);
    }
    
    if (this.isResetting) {
      this.smoothReset();
    }
    
    // Handle looping audio (simplified - no more speed control)
    if (this.isNoteOn && this.isAudioPlaying) {
      if (!this.audioComponent.isPlaying()) {
        // When restarting, maintain the current position if seeking is enabled
        if (this.enableAudioSeeking) {
          const currentPositionValue = this.getCurrentAudioPositionValue();
          const targetPosition = currentPositionValue * this.audioComponent.duration;
          this.audioComponent.position = clamp(targetPosition, 0, this.audioComponent.duration);
        }
        
        this.audioComponent.play(-1);
        print(`Restarting note ${this.noteId} for loop effect`);
      }
    }
  }
}