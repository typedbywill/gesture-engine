// src/core/event-emitter.ts
var TypedEventEmitter = class {
  listeners = /* @__PURE__ */ new Map();
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    const handlers = this.listeners.get(event);
    handlers.add(handler);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      this.off(event, handler);
    };
  }
  once(event, handler) {
    const wrapped = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }
  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    const snapshot = Array.from(handlers);
    for (const handler of snapshot) {
      try {
        handler(payload);
      } catch (err) {
        if (event !== "error") {
          this.emit("error", err);
        } else {
          console.error("Unhandled error in error event listener:", err);
        }
      }
    }
  }
  removeAllListeners() {
    this.listeners.clear();
  }
};

// src/core/types.ts
var GESTURE_EVENTS = {
  READY: "ready",
  HAND_DETECTED: "hand:detected",
  HAND_TRACKING: "hand:tracking",
  HAND_LOST: "hand:lost",
  GESTURE_DETECTED: "gesture:detected",
  GESTURE_START: "gesture:start",
  GESTURE_UPDATE: "gesture:update",
  GESTURE_END: "gesture:end",
  GESTURE_CANCELLED: "gesture:cancelled",
  CAMERA_ERROR: "camera:error",
  ERROR: "error"
};
var BUILT_IN_GESTURES = {
  NUMBER_ONE: "NUMBER_ONE",
  NUMBER_TWO: "NUMBER_TWO",
  NUMBER_THREE: "NUMBER_THREE",
  NUMBER_FOUR: "NUMBER_FOUR",
  NUMBER_FIVE: "NUMBER_FIVE",
  OPEN_PALM: "OPEN_PALM",
  CLOSED_FIST: "CLOSED_FIST",
  THUMBS_UP: "THUMBS_UP",
  THUMBS_DOWN: "THUMBS_DOWN",
  POINTING_UP: "POINTING_UP",
  POINTING_DOWN: "POINTING_DOWN",
  POINTING_LEFT: "POINTING_LEFT",
  POINTING_RIGHT: "POINTING_RIGHT",
  THUMB_LEFT: "THUMB_LEFT",
  THUMB_RIGHT: "THUMB_RIGHT",
  VICTORY: "VICTORY",
  ROCK_ON: "ROCK_ON",
  OK_SIGN: "OK_SIGN",
  PINCH: "PINCH",
  SWIPE_LEFT: "SWIPE_LEFT",
  SWIPE_RIGHT: "SWIPE_RIGHT",
  SWIPE_UP: "SWIPE_UP",
  SWIPE_DOWN: "SWIPE_DOWN",
  UNKNOWN: "UNKNOWN"
};
var GestureEngineError = class extends Error {
  code;
  recoverable;
  cause;
  constructor(options) {
    super(options.message);
    this.name = "GestureEngineError";
    this.code = options.code;
    this.recoverable = options.recoverable ?? false;
    this.cause = options.cause;
  }
};

// src/core/recognizers/static-recognizers.ts
var STATIC_RECOGNIZERS = {
  // OPEN_PALM: todos os 5 dedos estendidos
  [BUILT_IN_GESTURES.OPEN_PALM]: (ctx) => {
    const f = ctx.features.fingers;
    const allExtended = f.thumb.extended && f.index.extended && f.middle.extended && f.ring.extended && f.pinky.extended;
    if (!allExtended) return { matched: false, score: 0 };
    const avgScore = (f.thumb.extensionRatio + f.index.extensionRatio + f.middle.extensionRatio + f.ring.extensionRatio + f.pinky.extensionRatio) / 5;
    return { matched: true, score: Math.min(1, Math.max(0, avgScore)) };
  },
  // CLOSED_FIST: todos os dedos flexionados
  [BUILT_IN_GESTURES.CLOSED_FIST]: (ctx) => {
    const f = ctx.features.fingers;
    const anyExtended = f.index.extended || f.middle.extended || f.ring.extended || f.pinky.extended;
    if (anyExtended) return { matched: false, score: 0 };
    if (f.thumb.extended) return { matched: false, score: 0 };
    const score = 1 - (f.thumb.extensionRatio * 0.2 + f.index.extensionRatio * 0.2 + f.middle.extensionRatio * 0.2 + f.ring.extensionRatio * 0.2 + f.pinky.extensionRatio * 0.2);
    return { matched: true, score: Math.min(1, Math.max(0, score)) };
  },
  // NUMBER_ONE: apenas indicador estendido (combinação explícita)
  [BUILT_IN_GESTURES.NUMBER_ONE]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && !f.middle.extended && !f.ring.extended && !f.pinky.extended && !f.thumb.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },
  // NUMBER_TWO: indicador e médio estendidos
  [BUILT_IN_GESTURES.NUMBER_TWO]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.middle.extended && !f.ring.extended && !f.pinky.extended && !f.thumb.extended;
    if (!matched) return { matched: false, score: 0 };
    const score = (f.index.extensionRatio + f.middle.extensionRatio) / 2;
    return { matched: true, score };
  },
  // NUMBER_THREE: indicador, médio e anelar estendidos
  [BUILT_IN_GESTURES.NUMBER_THREE]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.middle.extended && f.ring.extended && !f.pinky.extended && !f.thumb.extended;
    if (!matched) return { matched: false, score: 0 };
    const score = (f.index.extensionRatio + f.middle.extensionRatio + f.ring.extensionRatio) / 3;
    return { matched: true, score };
  },
  // NUMBER_FOUR: quatro dedos estendidos sem polegar
  [BUILT_IN_GESTURES.NUMBER_FOUR]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.middle.extended && f.ring.extended && f.pinky.extended && !f.thumb.extended;
    if (!matched) return { matched: false, score: 0 };
    const score = (f.index.extensionRatio + f.middle.extensionRatio + f.ring.extensionRatio + f.pinky.extensionRatio) / 4;
    return { matched: true, score };
  },
  // NUMBER_FIVE: cinco dedos estendidos
  [BUILT_IN_GESTURES.NUMBER_FIVE]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.thumb.extended && f.index.extended && f.middle.extended && f.ring.extended && f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    const score = (f.thumb.extensionRatio + f.index.extensionRatio + f.middle.extensionRatio + f.ring.extensionRatio + f.pinky.extensionRatio) / 5;
    return { matched: true, score };
  },
  // VICTORY: indicador e médio estendidos em V, anelar e mínimo flexionados
  [BUILT_IN_GESTURES.VICTORY]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.middle.extended && !f.ring.extended && !f.pinky.extended && ctx.features.victorySeparation >= 0.2;
    if (!matched) return { matched: false, score: 0 };
    const score = (f.index.extensionRatio + f.middle.extensionRatio) / 2;
    return {
      matched: true,
      score,
      data: { victorySeparation: ctx.features.victorySeparation }
    };
  },
  // ROCK_ON: indicador e mínimo estendidos, médio e anelar flexionados
  [BUILT_IN_GESTURES.ROCK_ON]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.pinky.extended && !f.middle.extended && !f.ring.extended;
    if (!matched) return { matched: false, score: 0 };
    const score = (f.index.extensionRatio + f.pinky.extensionRatio) / 2;
    return { matched: true, score };
  },
  // THUMBS_UP: polegar estendido apontando para cima, demais dedos flexionados
  [BUILT_IN_GESTURES.THUMBS_UP]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.thumb.extended && f.thumb.primaryDirection === "UP" && !f.index.extended && !f.middle.extended && !f.ring.extended && !f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.thumb.extensionRatio };
  },
  // THUMBS_DOWN: polegar estendido apontando para baixo, demais dedos flexionados
  [BUILT_IN_GESTURES.THUMBS_DOWN]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.thumb.extended && f.thumb.primaryDirection === "DOWN" && !f.index.extended && !f.middle.extended && !f.ring.extended && !f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.thumb.extensionRatio };
  },
  // THUMB_LEFT: polegar estendido apontando para a esquerda
  [BUILT_IN_GESTURES.THUMB_LEFT]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.thumb.extended && f.thumb.primaryDirection === "LEFT" && !f.index.extended && !f.middle.extended && !f.ring.extended && !f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.thumb.extensionRatio };
  },
  // THUMB_RIGHT: polegar estendido apontando para a direita
  [BUILT_IN_GESTURES.THUMB_RIGHT]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.thumb.extended && f.thumb.primaryDirection === "RIGHT" && !f.index.extended && !f.middle.extended && !f.ring.extended && !f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.thumb.extensionRatio };
  },
  // POINTING_UP: indicador estendido apontando para cima
  [BUILT_IN_GESTURES.POINTING_UP]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.index.primaryDirection === "UP" && !f.middle.extended && !f.ring.extended && !f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },
  // POINTING_DOWN: indicador estendido apontando para baixo
  [BUILT_IN_GESTURES.POINTING_DOWN]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.index.primaryDirection === "DOWN" && !f.middle.extended && !f.ring.extended && !f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },
  // POINTING_LEFT: indicador estendido apontando para a esquerda
  [BUILT_IN_GESTURES.POINTING_LEFT]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.index.primaryDirection === "LEFT" && !f.middle.extended && !f.ring.extended && !f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },
  // POINTING_RIGHT: indicador estendido apontando para a direita
  [BUILT_IN_GESTURES.POINTING_RIGHT]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = f.index.extended && f.index.primaryDirection === "RIGHT" && !f.middle.extended && !f.ring.extended && !f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },
  // OK_SIGN: contato entre indicador e polegar com os demais 3 dedos estendidos
  [BUILT_IN_GESTURES.OK_SIGN]: (ctx) => {
    const f = ctx.features.fingers;
    const matched = ctx.features.okContact && f.middle.extended && f.ring.extended && f.pinky.extended;
    if (!matched) return { matched: false, score: 0 };
    const contactScore = Math.max(0, 1 - ctx.features.pinchDistance / 0.28);
    const fingersScore = (f.middle.extensionRatio + f.ring.extensionRatio + f.pinky.extensionRatio) / 3;
    const score = contactScore * 0.5 + fingersScore * 0.5;
    return {
      matched: true,
      score,
      data: {
        pinchDistance: ctx.features.pinchDistance,
        contact: true
      }
    };
  },
  // PINCH: aproximação entre indicador e polegar independente dos demais dedos
  [BUILT_IN_GESTURES.PINCH]: (ctx) => {
    if (!ctx.features.isPinching) return { matched: false, score: 0 };
    return {
      matched: true,
      score: ctx.features.pinchIntensity,
      data: {
        pinchDistance: ctx.features.pinchDistance,
        pinchIntensity: ctx.features.pinchIntensity
      }
    };
  },
  // UNKNOWN: placeholder, manipulado dinamicamente caso nenhuma pose seja detectada
  [BUILT_IN_GESTURES.UNKNOWN]: () => ({ matched: false, score: 0 }),
  // Swipes são dinâmicos e tratados no SwipeTracker
  [BUILT_IN_GESTURES.SWIPE_LEFT]: null,
  [BUILT_IN_GESTURES.SWIPE_RIGHT]: null,
  [BUILT_IN_GESTURES.SWIPE_UP]: null,
  [BUILT_IN_GESTURES.SWIPE_DOWN]: null
};

// src/core/recognizers/swipe-recognizer.ts
var SwipeTracker = class {
  historyByHand = /* @__PURE__ */ new Map();
  lastSwipeTimeByHand = /* @__PURE__ */ new Map();
  windowMinMs = 60;
  windowMaxMs = 400;
  cooldownMs;
  thresholdScale;
  mirrored;
  constructor(options) {
    this.cooldownMs = options?.cooldownMs ?? 500;
    this.thresholdScale = options?.thresholdScale ?? 0.35;
    this.mirrored = options?.mirrored ?? false;
  }
  setMirrored(mirrored) {
    this.mirrored = mirrored;
  }
  setCooldown(cooldownMs) {
    this.cooldownMs = cooldownMs;
  }
  resetHand(handId) {
    this.historyByHand.delete(handId);
    this.lastSwipeTimeByHand.delete(handId);
  }
  clear() {
    this.historyByHand.clear();
    this.lastSwipeTimeByHand.clear();
  }
  processPoint(handId, palmCenter, handScale, timestamp) {
    if (isNaN(timestamp) || timestamp < 0) {
      return null;
    }
    let history = this.historyByHand.get(handId);
    if (!history) {
      history = [];
      this.historyByHand.set(handId, history);
    }
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (timestamp <= last.timestamp) {
        this.historyByHand.set(handId, [{ x: palmCenter.x, y: palmCenter.y, timestamp }]);
        return null;
      }
    }
    const lastSwipeTime = this.lastSwipeTimeByHand.get(handId) ?? -Infinity;
    if (timestamp - lastSwipeTime < this.cooldownMs) {
      this.historyByHand.set(handId, [{ x: palmCenter.x, y: palmCenter.y, timestamp }]);
      return null;
    }
    history.push({ x: palmCenter.x, y: palmCenter.y, timestamp });
    const cutoff = timestamp - this.windowMaxMs;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }
    if (history.length < 2) {
      return null;
    }
    const current = history[history.length - 1];
    let candidateResult = null;
    for (let i = 0; i < history.length - 1; i++) {
      const start = history[i];
      const deltaT = current.timestamp - start.timestamp;
      if (deltaT < this.windowMinMs) continue;
      const rawDx = current.x - start.x;
      const rawDy = current.y - start.y;
      const normDx = rawDx / handScale;
      const normDy = rawDy / handScale;
      const dist = Math.hypot(normDx, normDy);
      if (dist < this.thresholdScale) {
        continue;
      }
      const velocity = dist / (deltaT / 1e3);
      const absDx = Math.abs(normDx);
      const absDy = Math.abs(normDy);
      let gesture = null;
      let direction = null;
      if (absDx > absDy * 1.25) {
        if (normDx < 0) {
          if (this.mirrored) {
            gesture = BUILT_IN_GESTURES.SWIPE_RIGHT;
            direction = "RIGHT";
          } else {
            gesture = BUILT_IN_GESTURES.SWIPE_LEFT;
            direction = "LEFT";
          }
        } else {
          if (this.mirrored) {
            gesture = BUILT_IN_GESTURES.SWIPE_LEFT;
            direction = "LEFT";
          } else {
            gesture = BUILT_IN_GESTURES.SWIPE_RIGHT;
            direction = "RIGHT";
          }
        }
      } else if (absDy > absDx * 1.25) {
        if (normDy < 0) {
          gesture = BUILT_IN_GESTURES.SWIPE_UP;
          direction = "UP";
        } else {
          gesture = BUILT_IN_GESTURES.SWIPE_DOWN;
          direction = "DOWN";
        }
      }
      if (gesture && direction) {
        const score = Math.min(1, Math.max(0.5, velocity / 3));
        candidateResult = {
          gesture,
          direction,
          velocity,
          distance: dist,
          duration: deltaT,
          score
        };
        break;
      }
    }
    if (candidateResult) {
      this.lastSwipeTimeByHand.set(handId, timestamp);
      this.historyByHand.set(handId, [{ x: palmCenter.x, y: palmCenter.y, timestamp }]);
      return candidateResult;
    }
    return null;
  }
};

// src/core/stabilizer.ts
var GestureStabilizer = class {
  // Chave: `${handId}:${gesture}`
  states = /* @__PURE__ */ new Map();
  stabilizationTimeMs;
  endGracePeriodMs;
  constructor(options) {
    this.stabilizationTimeMs = options?.stabilizationTimeMs ?? 150;
    this.endGracePeriodMs = options?.endGracePeriodMs ?? 150;
  }
  setOptions(options) {
    if (options.stabilizationTimeMs !== void 0) {
      this.stabilizationTimeMs = options.stabilizationTimeMs;
    }
    if (options.endGracePeriodMs !== void 0) {
      this.endGracePeriodMs = options.endGracePeriodMs;
    }
  }
  getActiveGestures() {
    const active = [];
    for (const state of this.states.values()) {
      if (state.status === "ACTIVE" || state.status === "PENDING_END") {
        active.push({
          gesture: state.gesture,
          handId: state.handId,
          handedness: state.handedness,
          score: state.score,
          duration: Math.max(0, state.lastMatchTimestamp - state.startTimestamp),
          data: state.data
        });
      }
    }
    return active;
  }
  processMatches(matchesByHand, allRegisteredGestures, timestamp) {
    const result = {
      detected: [],
      start: [],
      update: [],
      end: [],
      cancelled: []
    };
    for (const [handId, { handedness, matches }] of matchesByHand.entries()) {
      for (const gesture of allRegisteredGestures) {
        const key = `${handId}:${gesture}`;
        const matchInfo = matches.get(gesture);
        const state = this.states.get(key);
        if (matchInfo) {
          if (!state) {
            if (this.stabilizationTimeMs <= 0) {
              const newState = {
                gesture,
                handId,
                handedness,
                status: "ACTIVE",
                firstMatchTimestamp: timestamp,
                startTimestamp: timestamp,
                lastMatchTimestamp: timestamp,
                lossStartTimestamp: 0,
                score: matchInfo.score,
                data: matchInfo.data
              };
              this.states.set(key, newState);
              result.detected.push({
                gesture,
                handId,
                handedness,
                score: matchInfo.score,
                timestamp,
                data: matchInfo.data
              });
              result.start.push({
                gesture,
                handId,
                handedness,
                score: matchInfo.score,
                timestamp,
                duration: 0,
                data: matchInfo.data
              });
            } else {
              this.states.set(key, {
                gesture,
                handId,
                handedness,
                status: "PENDING_START",
                firstMatchTimestamp: timestamp,
                startTimestamp: timestamp,
                lastMatchTimestamp: timestamp,
                lossStartTimestamp: 0,
                score: matchInfo.score,
                data: matchInfo.data
              });
            }
          } else if (state.status === "PENDING_START") {
            state.lastMatchTimestamp = timestamp;
            state.score = matchInfo.score;
            state.data = matchInfo.data;
            if (timestamp - state.firstMatchTimestamp >= this.stabilizationTimeMs) {
              state.status = "ACTIVE";
              state.startTimestamp = state.firstMatchTimestamp;
              const duration = timestamp - state.startTimestamp;
              result.detected.push({
                gesture,
                handId,
                handedness,
                score: state.score,
                timestamp,
                data: state.data
              });
              result.start.push({
                gesture,
                handId,
                handedness,
                score: state.score,
                timestamp,
                duration,
                data: state.data
              });
            }
          } else if (state.status === "ACTIVE") {
            state.lastMatchTimestamp = timestamp;
            state.score = matchInfo.score;
            state.data = matchInfo.data;
            const duration = timestamp - state.startTimestamp;
            result.update.push({
              gesture,
              handId,
              handedness,
              score: state.score,
              timestamp,
              duration,
              data: state.data
            });
          } else if (state.status === "PENDING_END") {
            state.status = "ACTIVE";
            state.lastMatchTimestamp = timestamp;
            state.score = matchInfo.score;
            state.data = matchInfo.data;
            const duration = timestamp - state.startTimestamp;
            result.update.push({
              gesture,
              handId,
              handedness,
              score: state.score,
              timestamp,
              duration,
              data: state.data
            });
          }
        } else {
          if (!state) {
          } else if (state.status === "PENDING_START") {
            this.states.delete(key);
          } else if (state.status === "ACTIVE") {
            state.status = "PENDING_END";
            state.lossStartTimestamp = timestamp;
          } else if (state.status === "PENDING_END") {
            if (timestamp - state.lossStartTimestamp >= this.endGracePeriodMs) {
              const duration = Math.max(0, state.lastMatchTimestamp - state.startTimestamp);
              result.end.push({
                gesture,
                handId,
                handedness,
                score: state.score,
                timestamp,
                duration,
                data: state.data
              });
              this.states.delete(key);
            }
          }
        }
      }
    }
    return result;
  }
  cancelForHand(handId, reason, timestamp) {
    const cancelled = [];
    for (const [key, state] of this.states.entries()) {
      if (state.handId === handId) {
        if (state.status === "ACTIVE" || state.status === "PENDING_END") {
          cancelled.push({
            gesture: state.gesture,
            handId: state.handId,
            handedness: state.handedness,
            score: state.score,
            reason,
            timestamp,
            duration: Math.max(0, timestamp - state.startTimestamp),
            data: state.data
          });
        }
        this.states.delete(key);
      }
    }
    return cancelled;
  }
  cancelGesture(gesture, reason, timestamp) {
    const cancelled = [];
    for (const [key, state] of this.states.entries()) {
      if (state.gesture === gesture) {
        if (state.status === "ACTIVE" || state.status === "PENDING_END") {
          cancelled.push({
            gesture: state.gesture,
            handId: state.handId,
            handedness: state.handedness,
            score: state.score,
            reason,
            timestamp,
            duration: Math.max(0, timestamp - state.startTimestamp),
            data: state.data
          });
        }
        this.states.delete(key);
      }
    }
    return cancelled;
  }
  cancelAll(reason, timestamp) {
    const cancelled = [];
    for (const [, state] of this.states.entries()) {
      if (state.status === "ACTIVE" || state.status === "PENDING_END") {
        cancelled.push({
          gesture: state.gesture,
          handId: state.handId,
          handedness: state.handedness,
          score: state.score,
          reason,
          timestamp,
          duration: Math.max(0, timestamp - state.startTimestamp),
          data: state.data
        });
      }
    }
    this.states.clear();
    return cancelled;
  }
};

// src/core/features.ts
function dist3D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function normalizeVector(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-6) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function calculatePrimaryDirection(v) {
  const absX = Math.abs(v.x);
  const absY = Math.abs(v.y);
  if (absY > absX * 1.1) {
    return v.y < 0 ? "UP" : "DOWN";
  }
  if (absX > absY * 1.1) {
    return v.x < 0 ? "LEFT" : "RIGHT";
  }
  return "NONE";
}
function extractHandFeatures(landmarks, handedness) {
  if (landmarks.length < 21) {
    throw new Error(`Landmarks inv\xE1lidos: esperado 21 pontos, recebido ${landmarks.length}`);
  }
  const wrist = landmarks[0];
  const thumbCmc = landmarks[1];
  const thumbMcp = landmarks[2];
  const thumbIp = landmarks[3];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const indexPip = landmarks[6];
  const indexDip = landmarks[7];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleDip = landmarks[11];
  const middleTip = landmarks[12];
  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringDip = landmarks[15];
  const ringTip = landmarks[16];
  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyDip = landmarks[19];
  const pinkyTip = landmarks[20];
  const rawHandScale = dist3D(wrist, middleMcp);
  const handScale = rawHandScale > 5e-3 ? rawHandScale : 0.1;
  const palmPoints = [wrist, indexMcp, middleMcp, ringMcp, pinkyMcp];
  const palmCenter = {
    x: palmPoints.reduce((acc, p) => acc + p.x, 0) / palmPoints.length,
    y: palmPoints.reduce((acc, p) => acc + p.y, 0) / palmPoints.length
  };
  const mcpCenter = {
    x: (indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 4,
    y: (indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 4,
    z: (indexMcp.z + middleMcp.z + ringMcp.z + pinkyMcp.z) / 4
  };
  const palmNormal = normalizeVector({
    x: mcpCenter.x - wrist.x,
    y: mcpCenter.y - wrist.y,
    z: mcpCenter.z - wrist.z
  });
  const analyzeFinger = (mcp, pip, dip, tip) => {
    const tipToWrist = dist3D(tip, wrist);
    const pipToWrist = dist3D(pip, wrist);
    const dipToWrist = dist3D(dip, wrist);
    const tipToMcp = dist3D(tip, mcp);
    const fingerLength = dist3D(mcp, pip) + dist3D(pip, dip) + dist3D(dip, tip);
    const lengthRatio = fingerLength > 0 ? tipToMcp / fingerLength : 0;
    const extensionRatio = Math.max(0, Math.min(1, (lengthRatio - 0.42) / (0.82 - 0.42)));
    const isExtended = extensionRatio >= 0.6 && tipToWrist > pipToWrist * 1.05 && tipToWrist > dipToWrist;
    const dirVector = normalizeVector({
      x: tip.x - pip.x,
      y: tip.y - pip.y,
      z: tip.z - pip.z
    });
    const primaryDirection = calculatePrimaryDirection(dirVector);
    return {
      extended: isExtended,
      extensionRatio,
      tipDirection: dirVector,
      primaryDirection
    };
  };
  const analyzeThumb = () => {
    const thumbSegmentsLength = dist3D(thumbCmc, thumbMcp) + dist3D(thumbMcp, thumbIp) + dist3D(thumbIp, thumbTip);
    const tipToCmc = dist3D(thumbTip, thumbCmc);
    const straightness = thumbSegmentsLength > 0 ? tipToCmc / thumbSegmentsLength : 0;
    const tipToPinkyMcp = dist3D(thumbTip, pinkyMcp) / handScale;
    const tipToIndexMcp = dist3D(thumbTip, indexMcp) / handScale;
    const extensionRatio = Math.max(0, Math.min(1, (straightness - 0.5) / (0.88 - 0.5)));
    const isExtended = extensionRatio >= 0.55 && tipToPinkyMcp > 0.62;
    const dirVector = normalizeVector({
      x: thumbTip.x - thumbMcp.x,
      y: thumbTip.y - thumbMcp.y,
      z: thumbTip.z - thumbMcp.z
    });
    const primaryDirection = calculatePrimaryDirection(dirVector);
    return {
      extended: isExtended,
      extensionRatio,
      tipDirection: dirVector,
      primaryDirection
    };
  };
  const thumbState = analyzeThumb();
  const indexState = analyzeFinger(indexMcp, indexPip, indexDip, indexTip);
  const middleState = analyzeFinger(middleMcp, middlePip, middleDip, middleTip);
  const ringState = analyzeFinger(ringMcp, ringPip, ringDip, ringTip);
  const pinkyState = analyzeFinger(pinkyMcp, pinkyPip, pinkyDip, pinkyTip);
  const extendedFingers = [];
  if (thumbState.extended) extendedFingers.push("thumb");
  if (indexState.extended) extendedFingers.push("index");
  if (middleState.extended) extendedFingers.push("middle");
  if (ringState.extended) extendedFingers.push("ring");
  if (pinkyState.extended) extendedFingers.push("pinky");
  const rawPinchDist = dist3D(thumbTip, indexTip);
  const pinchDistance = rawPinchDist / handScale;
  const pinchThreshold = 0.38;
  const pinchIntensity = Math.max(0, Math.min(1, 1 - pinchDistance / 0.5));
  const isPinching = pinchDistance <= pinchThreshold;
  const okContact = pinchDistance <= 0.28;
  const rawVictorySeparation = dist3D(indexTip, middleTip);
  const victorySeparation = rawVictorySeparation / handScale;
  return {
    handScale,
    palmCenter,
    palmNormal,
    fingers: {
      thumb: thumbState,
      index: indexState,
      middle: middleState,
      ring: ringState,
      pinky: pinkyState
    },
    extendedFingers,
    extendedCount: extendedFingers.length,
    pinchDistance,
    pinchIntensity,
    isPinching,
    okContact,
    victorySeparation
  };
}

// src/core/tracker.ts
var HandTracker = class {
  activeHands = /* @__PURE__ */ new Map();
  maxHands;
  absenceTimeoutMs;
  nextHandIdCounter = 0;
  maxHistoryLength = 20;
  constructor(options) {
    this.maxHands = options?.maxHands ?? 2;
    this.absenceTimeoutMs = options?.absenceTimeoutMs ?? 250;
  }
  setOptions(options) {
    if (options.maxHands !== void 0) this.maxHands = options.maxHands;
    if (options.absenceTimeoutMs !== void 0) this.absenceTimeoutMs = options.absenceTimeoutMs;
  }
  getTrackedHands() {
    return Array.from(this.activeHands.values()).map((h) => this.toPublicTrackedHand(h));
  }
  getHand(handId) {
    const h = this.activeHands.get(handId);
    return h ? this.toPublicTrackedHand(h) : void 0;
  }
  getHandHistory(handId) {
    return this.activeHands.get(handId)?.history ?? [];
  }
  clear() {
    const lost = Array.from(this.activeHands.values()).map((h) => ({
      handId: h.handId,
      handedness: h.handedness
    }));
    this.activeHands.clear();
    return lost;
  }
  removeHand(handId) {
    const hand = this.activeHands.get(handId);
    if (!hand) return null;
    this.activeHands.delete(handId);
    return { handId: hand.handId, handedness: hand.handedness };
  }
  update(rawHands, timestamp) {
    const detectedHands = [];
    const updatedHands = [];
    const lostHands = [];
    const inputs = rawHands.slice(0, this.maxHands);
    const parsedInputs = inputs.map((input) => {
      const features = extractHandFeatures(input.landmarks, input.handedness);
      const confidence = input.confidence ?? input.score ?? 0.9;
      return {
        landmarks: input.landmarks,
        worldLandmarks: input.worldLandmarks,
        handedness: input.handedness,
        features,
        confidence,
        palmCenter: features.palmCenter
      };
    });
    const existingHands = Array.from(this.activeHands.values());
    const matchedExistingIds = /* @__PURE__ */ new Set();
    const matchedInputIndices = /* @__PURE__ */ new Set();
    const candidates = [];
    for (let i = 0; i < parsedInputs.length; i++) {
      const inp = parsedInputs[i];
      for (const ex of existingHands) {
        const dx = inp.palmCenter.x - ex.features.palmCenter.x;
        const dy = inp.palmCenter.y - ex.features.palmCenter.y;
        const spatialDist = Math.hypot(dx, dy);
        const handednessPenalty = inp.handedness === ex.handedness ? 0 : 0.8;
        const cost = spatialDist + handednessPenalty;
        if (cost < 0.65) {
          candidates.push({ inputIndex: i, handId: ex.handId, cost });
        }
      }
    }
    candidates.sort((a, b) => a.cost - b.cost);
    for (const c of candidates) {
      if (matchedInputIndices.has(c.inputIndex) || matchedExistingIds.has(c.handId)) {
        continue;
      }
      matchedInputIndices.add(c.inputIndex);
      matchedExistingIds.add(c.handId);
      const inp = parsedInputs[c.inputIndex];
      const ex = this.activeHands.get(c.handId);
      ex.landmarks = inp.landmarks;
      ex.worldLandmarks = inp.worldLandmarks;
      ex.features = inp.features;
      ex.handedness = inp.handedness;
      ex.confidence = inp.confidence;
      ex.lastSeenTimestamp = timestamp;
      ex.history.push({
        timestamp,
        palmCenter: inp.palmCenter,
        features: inp.features
      });
      if (ex.history.length > this.maxHistoryLength) {
        ex.history.shift();
      }
      const pub = this.toPublicTrackedHand(ex);
      updatedHands.push(pub);
    }
    for (let i = 0; i < parsedInputs.length; i++) {
      if (matchedInputIndices.has(i)) continue;
      if (this.activeHands.size >= this.maxHands) continue;
      const inp = parsedInputs[i];
      const newHandId = `hand_${this.nextHandIdCounter++}`;
      const newHand = {
        handId: newHandId,
        handedness: inp.handedness,
        landmarks: inp.landmarks,
        worldLandmarks: inp.worldLandmarks,
        features: inp.features,
        confidence: inp.confidence,
        firstSeenTimestamp: timestamp,
        lastSeenTimestamp: timestamp,
        history: [
          {
            timestamp,
            palmCenter: inp.palmCenter,
            features: inp.features
          }
        ]
      };
      this.activeHands.set(newHandId, newHand);
      const pub = this.toPublicTrackedHand(newHand);
      detectedHands.push(pub);
      updatedHands.push(pub);
    }
    for (const ex of existingHands) {
      if (!matchedExistingIds.has(ex.handId)) {
        const timeSinceLastSeen = timestamp - ex.lastSeenTimestamp;
        if (timeSinceLastSeen > this.absenceTimeoutMs) {
          this.activeHands.delete(ex.handId);
          lostHands.push({ handId: ex.handId, handedness: ex.handedness });
        }
      }
    }
    const trackedHands = Array.from(this.activeHands.values()).map(
      (h) => this.toPublicTrackedHand(h)
    );
    return {
      updatedHands,
      detectedHands,
      lostHands,
      trackedHands
    };
  }
  toPublicTrackedHand(internal) {
    return {
      handId: internal.handId,
      handedness: internal.handedness,
      landmarks: internal.landmarks,
      worldLandmarks: internal.worldLandmarks,
      features: internal.features,
      confidence: internal.confidence,
      lastSeenTimestamp: internal.lastSeenTimestamp,
      firstSeenTimestamp: internal.firstSeenTimestamp
    };
  }
};

// src/core/engine.ts
var GestureEngine = class {
  emitter = new TypedEventEmitter();
  tracker;
  stabilizer;
  swipeTracker;
  state = "UNINITIALIZED";
  recognitionEnabled = true;
  enabledGestures = /* @__PURE__ */ new Set();
  customGestures = /* @__PURE__ */ new Map();
  options;
  constructor(options = {}) {
    this.options = { ...options };
    this.tracker = new HandTracker({
      maxHands: options.maxHands ?? 2,
      absenceTimeoutMs: options.absenceTimeoutMs ?? 250
    });
    this.stabilizer = new GestureStabilizer({
      stabilizationTimeMs: options.stabilizationTimeMs ?? 150,
      endGracePeriodMs: options.endGracePeriodMs ?? 150
    });
    this.swipeTracker = new SwipeTracker({
      cooldownMs: options.swipeCooldownMs ?? 500,
      thresholdScale: options.swipeThreshold ?? 0.35,
      mirrored: options.mirrored ?? false
    });
    if (options.gestures && options.gestures.length > 0) {
      for (const g of options.gestures) {
        this.enabledGestures.add(g);
      }
    } else {
      for (const g of Object.values(BUILT_IN_GESTURES)) {
        this.enabledGestures.add(g);
      }
    }
  }
  // Event Subscription
  on(event, handler) {
    return this.emitter.on(event, handler);
  }
  once(event, handler) {
    return this.emitter.once(event, handler);
  }
  off(event, handler) {
    this.emitter.off(event, handler);
  }
  // Lifecycle
  async init() {
    if (this.state === "DESTROYED") {
      throw new GestureEngineError({
        code: "ALREADY_DESTROYED",
        message: "GestureEngine j\xE1 foi destru\xEDdo e n\xE3o pode ser reinicializado."
      });
    }
    if (this.state === "INITIALIZED" || this.state === "RUNNING") {
      return;
    }
    this.state = "INITIALIZED";
    this.emitter.emit("ready", { timestamp: Date.now() });
  }
  async start() {
    if (this.state === "DESTROYED") {
      throw new GestureEngineError({
        code: "ALREADY_DESTROYED",
        message: "GestureEngine j\xE1 foi destru\xEDdo."
      });
    }
    if (this.state === "RUNNING") {
      return;
    }
    if (this.state === "UNINITIALIZED") {
      await this.init();
    }
    this.state = "RUNNING";
    this.recognitionEnabled = true;
  }
  async stop() {
    if (this.state === "STOPPED" || this.state === "UNINITIALIZED" || this.state === "DESTROYED") {
      return;
    }
    const now = Date.now();
    this.cancelAllGestures("engine_stopped", now);
    const lostHands = this.tracker.clear();
    for (const h of lostHands) {
      this.emitter.emit("hand:lost", {
        handId: h.handId,
        handedness: h.handedness,
        timestamp: now
      });
    }
    this.swipeTracker.clear();
    this.state = "STOPPED";
  }
  async destroy() {
    if (this.state === "DESTROYED") {
      return;
    }
    const now = Date.now();
    this.cancelAllGestures("engine_destroyed", now);
    this.tracker.clear();
    this.swipeTracker.clear();
    this.state = "DESTROYED";
    this.emitter.removeAllListeners();
  }
  startRecognition() {
    this.recognitionEnabled = true;
  }
  stopRecognition() {
    if (!this.recognitionEnabled) return;
    this.recognitionEnabled = false;
    const now = Date.now();
    this.cancelAllGestures("recognition_paused", now);
  }
  isRecognitionEnabled() {
    return this.recognitionEnabled;
  }
  getState() {
    return this.state;
  }
  setMirrored(mirrored) {
    this.options.mirrored = mirrored;
    this.swipeTracker.setMirrored(mirrored);
  }
  // Custom Gestures Registration
  registerGesture(definition) {
    if (!definition || !definition.name || typeof definition.recognize !== "function") {
      throw new GestureEngineError({
        code: "INVALID_GESTURE_DEFINITION",
        message: "A defini\xE7\xE3o do gesto deve conter 'name' e callback 'recognize'."
      });
    }
    const name = definition.name;
    const isBuiltIn = Object.values(BUILT_IN_GESTURES).includes(name);
    if (isBuiltIn || this.customGestures.has(name)) {
      throw new GestureEngineError({
        code: "DUPLICATE_GESTURE_NAME",
        message: `O gesto '${name}' j\xE1 est\xE1 registrado no GestureEngine.`
      });
    }
    this.customGestures.set(name, definition);
    if (!this.options.gestures || this.options.gestures.includes(name)) {
      this.enabledGestures.add(name);
    }
  }
  unregisterGesture(name) {
    if (!this.customGestures.has(name)) {
      return false;
    }
    const now = Date.now();
    const cancelled = this.stabilizer.cancelGesture(name, "recognizer_unregistered", now);
    for (const event of cancelled) {
      this.emitter.emit("gesture:cancelled", event);
    }
    this.customGestures.delete(name);
    this.enabledGestures.delete(name);
    return true;
  }
  // Frame Processing
  processFrame(input) {
    if (this.state === "DESTROYED") {
      throw new GestureEngineError({
        code: "ALREADY_DESTROYED",
        message: "N\xE3o \xE9 poss\xEDvel processar frames com o motor destru\xEDdo."
      });
    }
    const timestamp = input.timestamp ?? Date.now();
    const trackingResult = this.tracker.update(input.hands ?? [], timestamp);
    for (const h of trackingResult.detectedHands) {
      this.emitter.emit("hand:detected", {
        handId: h.handId,
        handedness: h.handedness,
        timestamp,
        landmarks: h.landmarks,
        confidence: h.confidence
      });
    }
    for (const h of trackingResult.updatedHands) {
      this.emitter.emit("hand:tracking", {
        handId: h.handId,
        handedness: h.handedness,
        timestamp,
        landmarks: h.landmarks,
        worldLandmarks: h.worldLandmarks,
        features: h.features,
        confidence: h.confidence
      });
    }
    for (const lost of trackingResult.lostHands) {
      this.swipeTracker.resetHand(lost.handId);
      const cancelled = this.stabilizer.cancelForHand(lost.handId, "hand_lost", timestamp);
      for (const ev of cancelled) {
        this.emitter.emit("gesture:cancelled", ev);
      }
      this.emitter.emit("hand:lost", {
        handId: lost.handId,
        handedness: lost.handedness,
        timestamp
      });
    }
    if (!this.recognitionEnabled || this.state !== "RUNNING" && this.state !== "INITIALIZED") {
      return {
        timestamp,
        trackedHands: trackingResult.trackedHands,
        activeGestures: []
      };
    }
    const matchesByHand = /* @__PURE__ */ new Map();
    const allCandidateGestures = Array.from(this.enabledGestures);
    for (const hand of trackingResult.updatedHands) {
      const handMatches = /* @__PURE__ */ new Map();
      let anyStaticMatched = false;
      const history = this.tracker.getHandHistory(hand.handId);
      const ctx = {
        handId: hand.handId,
        handedness: hand.handedness,
        landmarks: hand.landmarks,
        worldLandmarks: hand.worldLandmarks,
        features: hand.features,
        history,
        timestamp
      };
      for (const gesture of allCandidateGestures) {
        if (gesture === BUILT_IN_GESTURES.UNKNOWN) continue;
        if (gesture === BUILT_IN_GESTURES.SWIPE_LEFT || gesture === BUILT_IN_GESTURES.SWIPE_RIGHT || gesture === BUILT_IN_GESTURES.SWIPE_UP || gesture === BUILT_IN_GESTURES.SWIPE_DOWN) {
          continue;
        }
        const staticFn = STATIC_RECOGNIZERS[gesture];
        if (staticFn) {
          try {
            const evalResult = staticFn(ctx);
            if (evalResult.matched) {
              handMatches.set(gesture, {
                score: evalResult.score,
                data: evalResult.data
              });
              anyStaticMatched = true;
            }
          } catch (err) {
            this.emitter.emit(
              "error",
              new GestureEngineError({
                code: "RECOGNIZER_ERROR",
                message: `Erro ao avaliar gesto '${gesture}': ${err.message}`,
                cause: err,
                recoverable: true
              })
            );
          }
        }
      }
      for (const [name, def] of this.customGestures.entries()) {
        if (!this.enabledGestures.has(name)) continue;
        try {
          const evalResult = def.recognize(ctx);
          if (evalResult) {
            if (typeof evalResult === "boolean") {
              if (evalResult) {
                handMatches.set(name, { score: 1 });
                anyStaticMatched = true;
              }
            } else if (evalResult.matched) {
              handMatches.set(name, {
                score: evalResult.score ?? 1,
                data: evalResult.data
              });
              anyStaticMatched = true;
            }
          }
        } catch (err) {
          this.emitter.emit(
            "error",
            new GestureEngineError({
              code: "RECOGNIZER_ERROR",
              message: `Erro ao executar callback do gesto customizado '${name}': ${err.message}`,
              cause: err,
              recoverable: true
            })
          );
        }
      }
      if (this.enabledGestures.has(BUILT_IN_GESTURES.UNKNOWN)) {
        if (!anyStaticMatched) {
          handMatches.set(BUILT_IN_GESTURES.UNKNOWN, { score: 1 });
        }
      }
      const swipeCandidate = this.swipeTracker.processPoint(
        hand.handId,
        hand.features.palmCenter,
        hand.features.handScale,
        timestamp
      );
      if (swipeCandidate && this.enabledGestures.has(swipeCandidate.gesture)) {
        const swipePayload = {
          gesture: swipeCandidate.gesture,
          handId: hand.handId,
          handedness: hand.handedness,
          score: swipeCandidate.score,
          timestamp,
          duration: swipeCandidate.duration,
          data: {
            direction: swipeCandidate.direction,
            velocity: swipeCandidate.velocity,
            distance: swipeCandidate.distance
          }
        };
        this.emitter.emit("gesture:detected", {
          gesture: swipePayload.gesture,
          handId: swipePayload.handId,
          handedness: swipePayload.handedness,
          score: swipePayload.score,
          timestamp,
          data: swipePayload.data
        });
        this.emitter.emit("gesture:start", swipePayload);
        this.emitter.emit("gesture:end", swipePayload);
      }
      matchesByHand.set(hand.handId, {
        handedness: hand.handedness,
        matches: handMatches
      });
    }
    const emitted = this.stabilizer.processMatches(
      matchesByHand,
      allCandidateGestures,
      timestamp
    );
    for (const ev of emitted.detected) {
      this.emitter.emit("gesture:detected", ev);
    }
    for (const ev of emitted.start) {
      this.emitter.emit("gesture:start", ev);
    }
    for (const ev of emitted.update) {
      this.emitter.emit("gesture:update", ev);
    }
    for (const ev of emitted.end) {
      this.emitter.emit("gesture:end", ev);
    }
    for (const ev of emitted.cancelled) {
      this.emitter.emit("gesture:cancelled", ev);
    }
    return {
      timestamp,
      trackedHands: trackingResult.trackedHands,
      activeGestures: this.stabilizer.getActiveGestures()
    };
  }
  // Notifica cancelamento de todos os gestos por interrupção geral
  cancelAllGestures(reason, timestamp) {
    const cancelled = this.stabilizer.cancelAll(reason, timestamp);
    for (const ev of cancelled) {
      this.emitter.emit("gesture:cancelled", ev);
    }
  }
};

// src/browser/camera-adapter.ts
var CameraAdapter = class {
  currentStream = null;
  currentDeviceId = null;
  videoElement = null;
  ownVideoElement = false;
  constructor(options) {
    if (options?.video) {
      this.videoElement = options.video;
    }
    if (options?.deviceId) {
      this.currentDeviceId = options.deviceId;
    }
  }
  getVideoElement() {
    return this.videoElement;
  }
  attachVideoElement(video) {
    this.videoElement = video;
    if (this.currentStream && this.videoElement.srcObject !== this.currentStream) {
      this.videoElement.srcObject = this.currentStream;
      this.videoElement.play().catch(() => {
      });
    }
  }
  getCurrentDeviceId() {
    return this.currentDeviceId;
  }
  getStream() {
    return this.currentStream;
  }
  async listCameras() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "videoinput");
    } catch (err) {
      throw this.wrapCameraError(err, "Falha ao listar dispositivos de c\xE2mera.");
    }
  }
  async start(options) {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new GestureEngineError({
        code: "CAMERA_NOT_SUPPORTED",
        message: "A API navigator.mediaDevices.getUserMedia n\xE3o est\xE1 dispon\xEDvel neste ambiente.",
        recoverable: false
      });
    }
    this.stopTracks();
    const deviceId = options?.deviceId ?? this.currentDeviceId;
    const facingMode = options?.facingMode ?? "user";
    const width = options?.width ?? { ideal: 1280 };
    const height = options?.height ?? { ideal: 720 };
    const fps = options?.idealFps ?? 30;
    const videoConstraints = {
      width,
      height,
      frameRate: { ideal: fps, max: 60 }
    };
    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId };
    } else if (facingMode) {
      videoConstraints.facingMode = facingMode;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
    } catch (err) {
      if (deviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
          });
        } catch {
          throw this.wrapCameraError(err, "Falha ao obter stream da c\xE2mera.");
        }
      } else {
        throw this.wrapCameraError(err, "Falha ao obter stream da c\xE2mera.");
      }
    }
    this.currentStream = stream;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings?.();
      if (settings?.deviceId) {
        this.currentDeviceId = settings.deviceId;
      }
    }
    if (this.videoElement) {
      this.videoElement.srcObject = stream;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      try {
        await this.videoElement.play();
      } catch {
      }
    }
    return stream;
  }
  async switchCamera(deviceId) {
    if (this.currentDeviceId === deviceId && this.currentStream?.active) {
      return this.currentStream;
    }
    this.currentDeviceId = deviceId;
    return this.start({ deviceId });
  }
  stop() {
    this.stopTracks();
    if (this.videoElement && this.videoElement.srcObject) {
      this.videoElement.srcObject = null;
    }
  }
  stopTracks() {
    if (this.currentStream) {
      for (const track of this.currentStream.getTracks()) {
        try {
          track.stop();
        } catch {
        }
      }
      this.currentStream = null;
    }
  }
  wrapCameraError(err, defaultMsg) {
    const error = err;
    const name = error?.name ?? "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return new GestureEngineError({
        code: "CAMERA_PERMISSION_DENIED",
        message: "Permiss\xE3o de acesso \xE0 c\xE2mera negada pelo usu\xE1rio ou sistema.",
        cause: err,
        recoverable: false
      });
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return new GestureEngineError({
        code: "CAMERA_NOT_FOUND",
        message: "Nenhuma c\xE2mera compat\xEDvel foi encontrada no dispositivo.",
        cause: err,
        recoverable: true
      });
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return new GestureEngineError({
        code: "CAMERA_IN_USE",
        message: "A c\xE2mera j\xE1 est\xE1 em uso por outro aplicativo ou processo.",
        cause: err,
        recoverable: true
      });
    }
    if (name === "OverconstrainedError") {
      return new GestureEngineError({
        code: "CAMERA_CONSTRAINTS_FAILED",
        message: "As restri\xE7\xF5es solicitadas para a c\xE2mera n\xE3o podem ser atendidas.",
        cause: err,
        recoverable: true
      });
    }
    return new GestureEngineError({
      code: "CAMERA_INIT_FAILED",
      message: error?.message ? `${defaultMsg} (${error.message})` : defaultMsg,
      cause: err,
      recoverable: true
    });
  }
};

// src/browser/pipeline.ts
var MediaPipePipeline = class {
  handLandmarker = null;
  isProcessing = false;
  isRunning = false;
  animationFrameId = null;
  rvfcId = null;
  lastFrameTime = 0;
  targetFrameIntervalMs;
  modelAssetPath;
  wasmRoot;
  maxHands;
  inferenceMode;
  videoElement = null;
  onFrameCallback = null;
  constructor(options) {
    this.modelAssetPath = options?.modelAssetPath ?? "/models/hand_landmarker.task";
    this.wasmRoot = options?.wasmRoot ?? "/mediapipe/wasm";
    this.maxHands = options?.maxHands ?? 2;
    this.inferenceMode = options?.inferenceMode ?? "auto";
    const fps = options?.targetFps ?? 30;
    this.targetFrameIntervalMs = 1e3 / Math.max(1, Math.min(60, fps));
  }
  async init() {
    if (this.handLandmarker) return;
    try {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(this.wasmRoot);
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.modelAssetPath,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: this.maxHands,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    } catch (gpuError) {
      try {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(this.wasmRoot);
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: this.modelAssetPath,
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numHands: this.maxHands,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      } catch (err) {
        throw new GestureEngineError({
          code: "MEDIAPIPE_LOAD_FAILED",
          message: `Falha ao carregar o modelo MediaPipe HandLandmarker de '${this.modelAssetPath}'.`,
          cause: err,
          recoverable: true
        });
      }
    }
  }
  start(video, onFrame) {
    this.videoElement = video;
    this.onFrameCallback = onFrame;
    this.isRunning = true;
    this.isProcessing = false;
    this.lastFrameTime = 0;
    this.scheduleNextFrame();
  }
  stop() {
    this.isRunning = false;
    this.isProcessing = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.rvfcId !== null && this.videoElement && "cancelVideoFrameCallback" in this.videoElement) {
      this.videoElement.cancelVideoFrameCallback(this.rvfcId);
      this.rvfcId = null;
    }
    this.videoElement = null;
    this.onFrameCallback = null;
  }
  destroy() {
    this.stop();
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch {
      }
      this.handLandmarker = null;
    }
  }
  scheduleNextFrame() {
    if (!this.isRunning || !this.videoElement) return;
    if ("requestVideoFrameCallback" in this.videoElement) {
      this.rvfcId = this.videoElement.requestVideoFrameCallback(
        (_now, metadata) => {
          this.onVideoFrame(metadata?.presentationTime ?? performance.now());
        }
      );
    } else {
      this.animationFrameId = requestAnimationFrame(() => {
        this.onVideoFrame(performance.now());
      });
    }
  }
  async onVideoFrame(frameTime) {
    if (!this.isRunning || !this.videoElement) return;
    const elapsed = frameTime - this.lastFrameTime;
    if (elapsed < this.targetFrameIntervalMs) {
      this.scheduleNextFrame();
      return;
    }
    if (this.isProcessing) {
      this.scheduleNextFrame();
      return;
    }
    if (this.videoElement.readyState < 2) {
      this.scheduleNextFrame();
      return;
    }
    this.isProcessing = true;
    this.lastFrameTime = frameTime;
    const timestamp = Math.round(performance.now());
    try {
      if (this.handLandmarker) {
        const result = this.handLandmarker.detectForVideo(this.videoElement, timestamp);
        const parsedHands = this.parseLandmarkerResult(result);
        if (this.onFrameCallback) {
          this.onFrameCallback({
            timestamp,
            hands: parsedHands
          });
        }
      }
    } catch {
    } finally {
      this.isProcessing = false;
      this.scheduleNextFrame();
    }
  }
  parseLandmarkerResult(result) {
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      return [];
    }
    const hands = [];
    for (let i = 0; i < result.landmarks.length; i++) {
      const rawLandmarks = result.landmarks[i];
      if (!rawLandmarks || rawLandmarks.length < 21) continue;
      const landmarks = rawLandmarks.map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z ?? 0
      }));
      let handedness = "Right";
      let confidence = 0.9;
      if (result.handednesses && result.handednesses[i] && result.handednesses[i][0]) {
        const cat = result.handednesses[i][0];
        handedness = cat.categoryName === "Left" ? "Left" : "Right";
        confidence = cat.score ?? 0.9;
      }
      let worldLandmarks;
      if (result.worldLandmarks && result.worldLandmarks[i]) {
        worldLandmarks = result.worldLandmarks[i].map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z ?? 0
        }));
      }
      hands.push({
        landmarks,
        worldLandmarks,
        handedness,
        confidence,
        score: confidence
      });
    }
    return hands;
  }
};

// src/browser/browser-engine.ts
var BrowserGestureEngine = class {
  engine;
  cameraAdapter;
  pipeline;
  options;
  isRunning = false;
  constructor(options = {}) {
    this.options = { ...options };
    this.engine = new GestureEngine(options);
    this.cameraAdapter = new CameraAdapter({
      video: options.video,
      ...options.camera
    });
    this.pipeline = new MediaPipePipeline({
      modelAssetPath: options.assets?.modelAssetPath,
      wasmRoot: options.assets?.wasmRoot,
      maxHands: options.maxHands ?? 2,
      inferenceMode: options.inferenceMode ?? "auto",
      targetFps: options.targetFps ?? 30
    });
  }
  // Delega eventos ao core
  on(event, handler) {
    return this.engine.on(event, handler);
  }
  once(event, handler) {
    return this.engine.once(event, handler);
  }
  off(event, handler) {
    this.engine.off(event, handler);
  }
  // Ciclo de vida
  async init() {
    try {
      await this.engine.init();
      await this.pipeline.init();
    } catch (err) {
      const error = err instanceof GestureEngineError ? err : new GestureEngineError({
        code: "BROWSER_INIT_FAILED",
        message: err.message,
        cause: err,
        recoverable: true
      });
      this.engine.emitter.emit("error", error);
      throw error;
    }
  }
  async start() {
    if (this.isRunning) return;
    try {
      await this.engine.start();
      let videoEl = this.cameraAdapter.getVideoElement();
      if (!videoEl && typeof document !== "undefined") {
        videoEl = document.createElement("video");
        videoEl.playsInline = true;
        videoEl.muted = true;
        videoEl.style.display = "none";
        document.body.appendChild(videoEl);
        this.cameraAdapter.attachVideoElement(videoEl);
      }
      try {
        await this.cameraAdapter.start(this.options.camera);
      } catch (camErr) {
        const error = camErr instanceof GestureEngineError ? camErr : new GestureEngineError({
          code: "CAMERA_INIT_FAILED",
          message: camErr.message,
          cause: camErr,
          recoverable: true
        });
        this.engine.emitter.emit("camera:error", {
          code: error.code,
          message: error.message,
          cause: error.cause,
          timestamp: Date.now(),
          recoverable: error.recoverable
        });
        this.engine.emitter.emit("error", error);
        throw error;
      }
      if (videoEl) {
        this.pipeline.start(videoEl, (detectionResult) => {
          this.engine.processFrame({
            timestamp: detectionResult.timestamp,
            hands: detectionResult.hands
          });
        });
      }
      this.isRunning = true;
    } catch (err) {
      this.cameraAdapter.stop();
      this.pipeline.stop();
      throw err;
    }
  }
  async stop() {
    this.isRunning = false;
    this.pipeline.stop();
    this.cameraAdapter.stop();
    await this.engine.stop();
  }
  async destroy() {
    this.isRunning = false;
    this.pipeline.destroy();
    this.cameraAdapter.stop();
    await this.engine.destroy();
  }
  startRecognition() {
    this.engine.startRecognition();
  }
  stopRecognition() {
    this.engine.stopRecognition();
  }
  processFrame(input) {
    return this.engine.processFrame(input);
  }
  registerGesture(definition) {
    this.engine.registerGesture(definition);
  }
  unregisterGesture(name) {
    return this.engine.unregisterGesture(name);
  }
  // Câmera e Adaptador de Vídeo
  async listCameras() {
    return this.cameraAdapter.listCameras();
  }
  async switchCamera(deviceId) {
    const now = Date.now();
    const cancelled = this.engine.stabilizer.cancelAll("camera_switch", now);
    for (const ev of cancelled) {
      this.engine.emitter.emit("gesture:cancelled", ev);
    }
    try {
      await this.cameraAdapter.switchCamera(deviceId);
    } catch (camErr) {
      const error = camErr instanceof GestureEngineError ? camErr : new GestureEngineError({
        code: "CAMERA_SWITCH_FAILED",
        message: camErr.message,
        cause: camErr,
        recoverable: true
      });
      this.engine.emitter.emit("camera:error", {
        code: error.code,
        message: error.message,
        cause: error.cause,
        timestamp: Date.now(),
        recoverable: error.recoverable
      });
      this.engine.emitter.emit("error", error);
      throw error;
    }
  }
  getCurrentCamera() {
    return this.cameraAdapter.getCurrentDeviceId();
  }
  getVideoElement() {
    return this.cameraAdapter.getVideoElement();
  }
  attachVideoElement(video) {
    this.cameraAdapter.attachVideoElement(video);
  }
  setMirrored(mirrored) {
    this.engine.setMirrored(mirrored);
  }
  getCoreEngine() {
    return this.engine;
  }
};
function createBrowserGestureEngine(options = {}) {
  return new BrowserGestureEngine(options);
}
export {
  BUILT_IN_GESTURES,
  BrowserGestureEngine,
  CameraAdapter,
  GESTURE_EVENTS,
  GestureEngine,
  GestureEngineError,
  GestureStabilizer,
  HandTracker,
  MediaPipePipeline,
  STATIC_RECOGNIZERS,
  SwipeTracker,
  TypedEventEmitter,
  createBrowserGestureEngine,
  extractHandFeatures
};
//# sourceMappingURL=index.js.map