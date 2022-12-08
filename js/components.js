// Handles personalization of links for sharing
const shareNameComponent = {
    schema: {
        name: {},
    },
    init() {
        const message = document.getElementById("message");
        const shareBtn = document.getElementById("shareBtn");
        const nameInput = document.getElementById("nameInput");

        shareBtn.style.display = "block";

        // hide share link button when media preview is open to avoid 'share' button confusion
        window.addEventListener("mediarecorder-previewopened", () => {
            shareBtn.style.display = "none";
        });

        window.addEventListener("mediarecorder-previewclosed", () => {
            shareBtn.style.display = "block";
        });

        // sample URL: https://playground.8thwall.app/url-params-test/?name=JOE
        const params = new URLSearchParams(
            document.location.search.substring(1)
        );
        const pName = params.get("name") ? params.get("name") : "friend";

        message.textContent = `Happy Holidays, ${pName}!`;

        let isEditing = false;
        let currentText = "";

        this.data.name = message.textContent;

        // copies custom link to clipboard
        const copyToClipboard = (e) => {
            const el = document.createElement("textarea");
            el.value = e;
            document.body.appendChild(el);
            Object.assign(el.style, {
                zIndex: "-99999",
                position: "absolute",
            });

            const userAgent =
                navigator.userAgent || navigator.vendor || window.opera;
            if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
                el.contentEditable = true;
                el.readOnly = false;
                const s = window.getSelection();
                s.removeAllRanges();

                const range = document.createRange();
                range.selectNodeContents(el);
                s.addRange(range);

                el.setSelectionRange(0, 999999);
            } else {
                el.select();
            }

            document.execCommand("copy");
            document.body.removeChild(el);
        };

        const startEditing = () => {
            if (isEditing) {
                return;
            }
            isEditing = true;
            message.textContent = "Enter first name of recipient:";
            nameInput.value = "";
            nameInput.style.display = "block";
            nameInput.focus();
            nameInput.style.opacity = "1";
            nameInput.style.pointerEvents = "auto";
        };

        const stopEditing = () => {
            if (!isEditing) {
                return;
            }
            isEditing = false;
            nameInput.style.opacity = "0.01";
            nameInput.style.pointerEvents = "none";
            nameInput.style.display = "none";
            currentText = nameInput.value;

            copyToClipboard(
                `https://playground.8thwall.app/character-camera/?name=${currentText}`
            );

            const shareData = {
                url: `https://playground.8thwall.app/character-camera/?name=${currentText}`,
            };

            if (navigator.share) {
                // only appears on mobile
                navigator.share(shareData);
                message.textContent = `Custom link for ${currentText} created!`;
            } else {
                // only appears on Desktop + VR
                message.textContent = `Custom link for ${currentText} copied!`;
            }

            setTimeout(() => {
                message.textContent = this.data.name;
            }, 3000);
        };

        shareBtn.addEventListener("click", () => {
            startEditing();
            shareBtn.classList.add("pulse-once");
            setTimeout(() => {
                shareBtn.classList.remove("pulse-once");
            }, 200);
        });

        nameInput.addEventListener("blur", () => stopEditing());
    },
};

// Checks URL for name personalization and renders message accordingly
const nameFromParamComponent = {
    schema: {},
    init() {
        // sample URL: https://playground.8thwall.app/url-params-test/?name=JOE
        const params = new URLSearchParams(
            document.location.search.substring(1)
        );
        const pName = params.get("name") ? params.get("name") : "friend";

        const message = document.getElementById("message");
        message.textContent = `Happy Holidays, ${pName}!`;
    },
};

// Handles character locomotion and animation states
const clickMoveComponent = {
    schema: {
        idlePose: { default: "" },
        motionPose: { default: "" },
        speed: { default: 5 },
    },
    init() {
        const { el } = this;
        const ground = document.getElementById("ground");
        const anchor = document.getElementById("anchor");
        this.ground = ground;

        let timeout = null;
        let canMove = true;

        let { idlePose } = this.data;
        let { motionPose } = this.data;

        this.el.addEventListener("tapstart", () => {
            canMove = false;
        });

        this.el.addEventListener("tapend", () => {
            canMove = true;
        });

        const updatePoseNames = () => {
            if (
                this.el.object3D.children[0] &&
                this.el.object3D.children[0].animations &&
                this.el.object3D.children[0].animations.length >= 2
            ) {
                idlePose = this.el.object3D.children[0].animations[0].name;
                motionPose =
                    this.el.object3D.children[0].animations[1].name || idlePose;
            }
            if (idlePose) {
                el.setAttribute(
                    "animation-mixer",
                    `clip:${idlePose};loop:repeat`
                );
            }
        };

        this.el.addEventListener("model-loaded", updatePoseNames);
        updatePoseNames();

        this.tapRing = document.getElementById("tapRing");

        if (!this.tapRing) {
            const tapRingInner = document.createElement("a-ring");
            tapRingInner.setAttribute("color", "#000");
            tapRingInner.setAttribute("emissive", "#D64443");
            tapRingInner.setAttribute("ring-inner", "0.5");
            tapRingInner.setAttribute("ring-outer", "0.75");
            tapRingInner.setAttribute("rotation", "-90 0 0");
            tapRingInner.setAttribute("position", "0 0.005 0");

            this.tapRing = document.createElement("a-entity");
            this.tapRing.id = "tapRing";
            this.tapRing.setAttribute("visible", "false");
            this.tapRing.appendChild(tapRingInner);
            this.el.sceneEl.appendChild(this.tapRing);
        }

        const { tapRing } = this;
        let ringTimeout = null;
        let previousClip = null;

        this._recenterHandler = (event) => {
            setTimeout(() => {
                el.emit("lookreset", "", "");
                if (timeout) {
                    clearTimeout(timeout);
                }
                if (
                    this.el.getAttribute("animation-mixer").clip === motionPose
                ) {
                    this.el.setAttribute("animation-mixer", {
                        clip: previousClip || idlePose,
                        loop: "repeat",
                        crossFadeDuration: 0,
                    });
                }
                tapRing.setAttribute("visible", "false");
                el.object3D.position.x = anchor.object3D.position.x;
                el.object3D.position.z = anchor.object3D.position.z;
                el.emit("stopmove", "");
            });
        };

        el.sceneEl.addEventListener(
            "recenterWithOrigin",
            this._recenterHandler
        );

        this._groundClickHandler = (event) => {
            if (!canMove) {
                return;
            }
            const touchPosition = new THREE.Vector3(
                event.detail.intersection.point.x,
                0,
                event.detail.intersection.point.z
            );

            const moveVector = touchPosition.clone().sub(el.object3D.position);
            const distance = moveVector.length();

            const duration =
                (distance * 1000) / Math.max(0.01, this.data.speed);

            el.emit("move", {
                type: "lerp",
                endPosition: touchPosition,
                duration,
            });
            el.emit("look", {
                target: touchPosition,
                tilt: false,
                axis: "0 0 -1",
            });

            const currentClip = this.el.getAttribute("animation-mixer").clip;
            previousClip =
                currentClip !== motionPose ? currentClip : previousClip;
            const crossFadeDuration = previousClip === idlePose ? "0.3" : "0";
            this.el.setAttribute("animation-mixer", {
                clip: motionPose,
                loop: "repeat",
                crossFadeDuration,
            });
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                moveVector.y = 0;
                el.emit("look", {
                    target: moveVector.add(touchPosition),
                    tilt: false,
                    axis: "0 0 -1",
                });
                this.el.setAttribute("animation-mixer", {
                    clip: previousClip || idlePose,
                    loop: "repeat",
                    crossFadeDuration,
                });
            }, duration);

            tapRing.object3D.scale.copy({ x: 0.001, y: 0.001, z: 0.001 });
            tapRing.object3D.position.copy(touchPosition);

            const ringScaleDuration = Math.min(300, duration / 3);

            tapRing.setAttribute("visible", "true");
            tapRing.removeAttribute("animation__scale");
            tapRing.setAttribute("animation__scale", {
                property: "scale",
                dur: ringScaleDuration,
                from: "0.001 0.001 0.001",
                to: "0.5 0.5 0.5",
                easing: "easeOutQuad",
            });

            if (ringTimeout) {
                clearTimeout(ringTimeout);
            }
            ringTimeout = setTimeout(() => {
                tapRing.removeAttribute("animation__scale");
                tapRing.setAttribute("animation__scale", {
                    property: "scale",
                    dur: ringScaleDuration,
                    to: "0.001 0.001 0.001",
                    easing: "easeInQuad",
                });
                ringTimeout = setTimeout(
                    () => tapRing.setAttribute("visible", "false"),
                    ringScaleDuration
                );
            }, duration - ringScaleDuration);
        };

        ground.addEventListener("mousedown", this._groundClickHandler);
    },
    remove() {
        if (this.tapRing) {
            this.tapRing.setAttribute("visible", "false");
        }
        if (this.ground) {
            this.ground.removeEventListener(
                "mousedown",
                this._groundClickHandler
            );
        }
        if (this.el) {
            this.el.emit("stopmove", "");
            this.el.emit("lookreset", "", false);
            this.el.setAttribute("animation-mixer", {
                clip: this.data.idlePose,
                loop: "repeat",
                crossFadeDuration: 0,
            });
            if (this.el.sceneEl) {
                this.el.sceneEl.removeEventListener(
                    "recenterWithOrigin",
                    this._recenterHandler
                );
            }
        }
    },
};

// Character reacts when tapped or clicked
const characterTapComponent = {
    init() {
        const { el } = this;
        let moving = false;
        let canStop = false;
        let dance = false;

        const pTex = document.getElementById("purpleNoseTex");
        const rTex = document.getElementById("redNoseTex");

        // replaces texture of character
        const applyCustomTexture = (mesh, color) => {
            if (!mesh) {
                return;
            }

            const skin = mesh.getObjectByName("cuerpo");
            if (color === "red") {
                skin.material.map = new THREE.Texture(rTex);
            } else {
                skin.material.map = new THREE.Texture(pTex);
            }
            skin.material.map.flipY = false;
            skin.material.map.needsUpdate = true;
        };

        el.addEventListener("move", () => (moving = true));
        el.addEventListener("arrived", () => (moving = false));

        el.addEventListener("animation-loop", (event) => {
            if (event.detail.action._clip.name === "dance" && canStop) {
                el.emit("tapend", "");
                el.setAttribute(
                    "animation-mixer",
                    "clip: idle;loop:repeat;crossFadeDuration: 0.35;"
                );
                applyCustomTexture(this.el.getObject3D("mesh"), "red");
                dance = false;
            }
        });

        this.el.addEventListener("click", () => {
            if (moving || dance) return;
            el.emit("tapstart", "");
            dance = true;
            el.emit("lookreset", "");
            canStop = false;
            setTimeout(() => {
                canStop = true;
            }, 500);
            applyCustomTexture(this.el.getObject3D("mesh"), "purple");
            el.setAttribute(
                "animation-mixer",
                "clip:dance;loop:none;crossFadeDuration: 0.35;"
            );
        });
    },
};

// Manages where character is looking
const lookControllerComponent = {
    init() {
        const isFrozen = false;
        let moving = false;

        const { el } = this;

        el.addEventListener("move", () => {
            moving = true;
        });
        el.addEventListener("arrived", () => {
            moving = false;
        });

        el.addEventListener("look", (event) => {
            el.setAttribute("look-at-slerp", event.detail);
        });

        el.addEventListener("lookreset", () => {
            el.setAttribute("look-at-slerp", {
                target: "camera",
                tilt: false,
                axis: "0 0 -1",
            });
        });
    },
};

// Handles character look at logic
const lookAtSlerpComponent = {
    schema: {
        target: { default: "" }, // Target can be either an element ID or a position
        factor: { default: 0.008 }, // Controls how quickly the object will turn
        tilt: { default: false }, // Controls whether the object will tilt or just spin
        offset: { default: "0 0 0" }, // Relative position used to calculate position
        targetOffset: { default: "0 0 0" }, // Position on the target used to calculate the target
        axis: { default: "0 0 -1" }, // Local axis will be aimed towards the target
        looking: { default: true }, // Whether or not the object is allowed to rotate
    },
    init() {
        this.internalState = {
            desiredRotation: new THREE.Quaternion(),
            lookRotation: new THREE.Quaternion(),
            targetVector: new THREE.Vector3(),
            offsetVector: new THREE.Vector3(),
            targetOffsetVector: new THREE.Vector3(),
            axisVector: new THREE.Vector3(),
        };

        this.startLooking = () => {
            this.internalState.updateLooking = true;
        };

        this.stopLooking = () => {
            this.internalState.updateLooking = false;
        };

        this.el.addEventListener("lookstart", this.startLooking);
        this.el.addEventListener("lookstop", this.stopLooking);
    },
    update() {
        const state = this.internalState;
        state.updateLooking = this.data.looking;

        let hasTarget = false;
        if (this.data.target) {
            const parsedTarget = AFRAME.utils.coordinates.parse(
                this.data.target
            );
            if (parsedTarget.x) {
                state.targetVector.copy(parsedTarget);
                hasTarget = true;
                state.targetObject = null;
            } else {
                const targetEntity = document.getElementById(this.data.target);
                if (targetEntity) {
                    state.targetObject = targetEntity.object3D;
                    hasTarget = true;
                }
            }
        }

        state.hasTarget = hasTarget;

        state.offsetVector.copy(
            AFRAME.utils.coordinates.parse(this.data.offset)
        );
        state.targetOffsetVector.copy(
            AFRAME.utils.coordinates.parse(this.data.targetOffset)
        );
        state.axisVector
            .copy(AFRAME.utils.coordinates.parse(this.data.axis))
            .normalize();
        state.lookRotation.setFromUnitVectors(
            new THREE.Vector3(0, 0, -1),
            state.axisVector
        );
    },
    tick(time, timeDelta) {
        const state = this.internalState;
        if (state.updateLooking && state.hasTarget) {
            const offsetPosition = state.offsetVector
                .clone()
                .add(window.c8_getWorldPosition(this.el.object3D));

            let targetPosition;
            if (state.targetObject) {
                targetPosition = state.targetOffsetVector
                    .clone()
                    .applyQuaternion(
                        window.c8_getWorldQuaternion(state.targetObject)
                    )
                    .add(window.c8_getWorldPosition(state.targetObject));
            } else {
                targetPosition = this.internalState.targetVector.clone();
            }

            const toTarget = targetPosition.sub(offsetPosition);

            if (!this.data.tilt) {
                toTarget.y = 0;
            }

            const yaw = Math.atan2(toTarget.x, toTarget.z);
            let pitch = 0;
            if (this.data.tilt) {
                const groundDistance = Math.pow(
                    Math.pow(toTarget.x, 2) + Math.pow(toTarget.z, 2),
                    0.5
                );
                pitch = -Math.atan2(toTarget.y, groundDistance);
            }

            state.desiredRotation.setFromEuler(
                new THREE.Euler(pitch, yaw, 0, "YXZ")
            );
            state.desiredRotation.multiply(state.lookRotation);
            this.el.object3D.quaternion.slerp(
                state.desiredRotation,
                Math.min(this.data.factor * timeDelta, 1)
            );
        }
    },
    remove() {
        this.el.removeEventListener("lookstart", this.startLooking);
        this.el.removeEventListener("lookstop", this.stopLooking);
    },
};

// Component that gets commands through events for how to move over time
const moveControllerComponent = {
    schema: {
        moveY: { default: true },
    },
    init() {
        this.internalData = {
            moving: false,
        };
        const { el } = this;
        const { internalData } = this;

        this.el.addEventListener("move", (event) => {
            // Move command includes type, and duration
            const moveCommand = event.detail;

            internalData.moving = true;
            internalData.duration = moveCommand.duration;
            internalData.elapsed = 0;

            switch (moveCommand.type) {
                case "lerp":
                    const startPosition = el.object3D.position.clone();
                    internalData.equation = (p) =>
                        startPosition.clone().lerp(moveCommand.endPosition, p);
                    break;
                case "equation":
                    internalData.equation = moveCommand.equation;
                    break;
            }
        });
        this.el.addEventListener("stopmove", (event) => {
            internalData.moving = false;
        });
    },
    tick(tick, timeDelta) {
        if (this.internalData.moving) {
            const { internalData } = this;
            let newPosition;
            if (internalData.elapsed >= internalData.duration) {
                newPosition = internalData.equation(1);
                internalData.moving = false;
                this.el.emit("arrived", "", false);
            } else {
                newPosition = internalData.equation(
                    internalData.elapsed / internalData.duration
                );
                internalData.elapsed += timeDelta;
            }
            if (!this.data.moveY) {
                newPosition.y = this.el.object3D.position.y;
            }
            this.el.object3D.position.copy(newPosition);
        }
    },
};

export {
    shareNameComponent,
    nameFromParamComponent,
    clickMoveComponent,
    characterTapComponent,
    lookControllerComponent,
    lookAtSlerpComponent,
    moveControllerComponent,
};

// Improves performance
const updateMatrixWorldOnlyIfVisible = function (force) {
    if (!this.visible) return;

    // Copied source follows here.
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || force) {
        if (this.parent === null) {
            this.matrixWorld.copy(this.matrix);
        } else {
            this.matrixWorld.multiplyMatrices(
                this.parent.matrixWorld,
                this.matrix
            );
        }
        this.matrixWorldNeedsUpdate = false;
        force = true;
    }
    // update children
    const { children } = this;
    for (let i = 0, l = children.length; i < l; i++) {
        children[i].updateMatrixWorld(force);
    }
};

AFRAME.THREE.Object3D.prototype.updateMatrixWorld =
    updateMatrixWorldOnlyIfVisible;

window.c8_getWorldPosition = (object) => {
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(object.matrixWorld);
    return position;
};

window.c8_getWorldQuaternion = (object) => {
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const target = new THREE.Quaternion();
    object.matrixWorld.decompose(position, target, scale);
    return target;
};
