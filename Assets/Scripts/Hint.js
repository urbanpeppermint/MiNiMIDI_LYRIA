// @input SceneObject hintObject
// @input float displayDuration = 5.0
// @input float minScale = 1.0
// @input float maxScale = 1.5
// @input float pulseSpeed = 2.0

let elapsedTime = 0;
let isHintActive = true;

// Ensure the hintObject is active at start
script.hintObject.enabled = true;

// Update function called every frame
function onUpdate(eventData) {
    if (!isHintActive) return;

    elapsedTime += eventData.getDeltaTime();

    // Heartbeat scaling animation
    let scaleFactor = script.minScale + (script.maxScale - script.minScale) * 0.5 * (1 + Math.sin(elapsedTime * script.pulseSpeed * Math.PI));
    script.hintObject.getTransform().setLocalScale(new vec3(scaleFactor, scaleFactor, scaleFactor));

    // Disable hint after displayDuration
    if (elapsedTime >= script.displayDuration) {
        script.hintObject.enabled = false;
        isHintActive = false;
    }
}

// Bind the update function to the UpdateEvent
var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(onUpdate);
