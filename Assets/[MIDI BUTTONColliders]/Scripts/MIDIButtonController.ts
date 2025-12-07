/**
 * MIDIButtonController.ts
 * ONLY CHANGE: Removed crossfadeSlider and audioPositionSlider inputs and related functions
 * Everything else is exactly as it was
 */

import { mix } from "SpectaclesInteractionKit/Utils/animate";
import { clamp } from "SpectaclesInteractionKit/Utils/mathUtils";

@component
export class MIDIButtonController extends BaseScriptComponent {
  @input
  @hint("The collider that will detect the soft press interaction")
  colliderObject: SceneObject;
  
  // REMOVED: crossfadeSlider
  // REMOVED: audioPositionSlider
  
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
  buttonMoveDistance: number = 5.0;

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

  // REMOVED: enableAudioSeeking

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
  
  private isNoteOn: boolean = false;
  private audioComponent: AudioComponent;
  private isAudioPlaying: boolean = false;
  private materialInstance: Material = null;

  private originalButtonPosition: vec3;
  private isButtonAnimating: boolean = false;
  private buttonAnimationEvent: SceneEvent = null;

  // REMOVED: lastAudioPosition, isSeekingEnabled

  onAwake() {
    this.collider = this.colliderObject.getComponent("Physics.ColliderComponent");
    
    this.audioComponent = this.getSceneObject().createComponent("Component.AudioComponent");
    if (this.noteAudioAsset) {
      this.audioComponent.audioTrack = this.noteAudioAsset;
    }

    if (this.pressableVisual) {
      this.originalButtonPosition = this.pressableVisual.getTransform().getLocalPosition();
    }

    if (this.buttonImage && this.buttonImage.mainMaterial) {
      this.materialInstance = this.buttonImage.mainMaterial.clone();
      this.buttonImage.mainMaterial = this.materialInstance;
      
      if (this.buttonOffTexture) {
        this.materialInstance.mainPass.baseTex = this.buttonOffTexture;
      }
    }

    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });

    this.createEvent("UpdateEvent").bind(() => {
      this.update();
    });

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
    this.collider.onOverlapEnter.add((e) => {
      const overlap = e.overlap;
      const interactingObject = overlap.collider.getSceneObject();
      
      if (this.isRegisteredInteractor(interactingObject)) {
        if (this.isEnteringFromTop(interactingObject)) {
          this.activeInteractors.set(overlap.id, interactingObject);
          this.pressValues.set(overlap.id, 0);
          this.lastClosestPointsLocal.set(overlap.id, this.localTop);
          this.isResetting = false;
          this.resetProgress = 0;
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
        this.activeInteractors.delete(overlap.id);
        
        if (this.activeInteractors.size === 0) {
          this.isResetting = true;
          this.resetProgress = 0;
        }
      }
    });
    
    // REMOVED: initializeCrossfadeControl()
    // REMOVED: initializeAudioPositionControl()
  }

  // REMOVED: initializeCrossfadeControl
  // REMOVED: initializeAudioPositionControl
  // REMOVED: onAudioPositionValueChanged
  // REMOVED: seekAudioPosition
  // REMOVED: getCurrentAudioPositionValue
  // REMOVED: onCrossfadeValueChanged
  // REMOVED: getCrossfadeVolumes
  // REMOVED: applyCrossfadeVolumes
  // REMOVED: getCurrentCrossfadeValue

  private static addPlayingTrack(audioComponent: AudioComponent) {
    const index = MIDIButtonController.playingTracks.indexOf(audioComponent);
    if (index !== -1) {
      MIDIButtonController.playingTracks.splice(index, 1);
    }
    MIDIButtonController.playingTracks.push(audioComponent);
    if (MIDIButtonController.playingTracks.length > MIDIButtonController.maxPlayingTracks) {
      MIDIButtonController.playingTracks.shift();
    }
  }

  private static removePlayingTrack(audioComponent: AudioComponent) {
    const index = MIDIButtonController.playingTracks.indexOf(audioComponent);
    if (index !== -1) {
      MIDIButtonController.playingTracks.splice(index, 1);
    }
  }

  private animateButtonPress() {
    if (!this.pressableVisual || this.isButtonAnimating) return;
    
    this.isButtonAnimating = true;
    this.cancelButtonAnimation();
    
    let animationTime = 0;
    const totalDuration = this.resetDuration;
    const halfDuration = totalDuration / 2;
    
    this.buttonAnimationEvent = this.createEvent("UpdateEvent");
    this.buttonAnimationEvent.bind(() => {
      animationTime += getDeltaTime();
      
      let currentYOffset = 0;
      
      if (animationTime <= halfDuration) {
        const progress = animationTime / halfDuration;
        currentYOffset = -this.buttonMoveDistance * progress;
      } else if (animationTime <= totalDuration) {
        const progress = (animationTime - halfDuration) / halfDuration;
        currentYOffset = -this.buttonMoveDistance * (1 - progress);
      } else {
        currentYOffset = 0;
        this.isButtonAnimating = false;
        this.cancelButtonAnimation();
      }
      
      const newPosition = new vec3(
        this.originalButtonPosition.x,
        this.originalButtonPosition.y + currentYOffset,
        this.originalButtonPosition.z
      );
      
      this.pressableVisual.getTransform().setLocalPosition(newPosition);
    });
    this.buttonAnimationEvent.enabled = true;
  }

  private cancelButtonAnimation() {
    if (this.buttonAnimationEvent) {
      this.buttonAnimationEvent.enabled = false;
      this.buttonAnimationEvent = null;
    }
  }

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
      this.hasTriggeredEvent = false;
    }

    if (this.resetProgress >= 1) {
      this.isResetting = false;
      this.resetProgress = 0;
      this.pressValues.clear();
      this.lastClosestPointsLocal.clear();
    }
  }

  private onPressThresholdReached() {
    this.toggleNoteState();
    this.animateButtonPress();
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
        this.audioComponent.play(-1);
        this.isAudioPlaying = true;
        MIDIButtonController.addPlayingTrack(this.audioComponent);
      } catch (error) {
        print(`Error playing audio: ${error}`);
      }
    }
  }

  private stopNote() {
    try {
      if (this.audioComponent) {
        MIDIButtonController.removePlayingTrack(this.audioComponent);
        this.audioComponent.stop(true);
        this.isAudioPlaying = false;
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
    }
  }

  private update() {
    for (const [overlapId, interactor] of this.activeInteractors.entries()) {
      this.calculatePressValue(overlapId, interactor);
    }
    
    if (this.isResetting) {
      this.smoothReset();
    }
    
    if (this.isNoteOn && this.isAudioPlaying) {
      if (!this.audioComponent.isPlaying()) {
        this.audioComponent.play(-1);
      }
    }
  }
}