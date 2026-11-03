/**
 * Constantes oficiais de eventos e gestos embutidos.
 * Exportados exatamente com os nomes fornecidos.
 */

export const GESTURE_EVENTS = {
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
  ERROR: "error",
  COMMAND_DETECTED: "command:detected",
  RECOGNITION_STATE: "recognition:state",
} as const;

export const BUILT_IN_GESTURES = {
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
  ROCK_ON: "ROCK_ON",
  OK_SIGN: "OK_SIGN",
  PINCH: "PINCH",
  SWIPE_LEFT: "SWIPE_LEFT",
  SWIPE_RIGHT: "SWIPE_RIGHT",
  SWIPE_UP: "SWIPE_UP",
  SWIPE_DOWN: "SWIPE_DOWN",
  UNKNOWN: "UNKNOWN",
} as const;

export type GestureEventName = typeof GESTURE_EVENTS[keyof typeof GESTURE_EVENTS];
export type BuiltInGesture = typeof BUILT_IN_GESTURES[keyof typeof BUILT_IN_GESTURES];
export type GestureName = BuiltInGesture | (string & {});

export type Handedness = "Left" | "Right";

export interface Point2D {
  x: number;
  y: number;
}

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export interface HandInput {
  landmarks: Landmark3D[]; // 21 landmarks normalizados [0, 1]
  handedness: Handedness;
  confidence?: number;
  score?: number;
  worldLandmarks?: Landmark3D[]; // coordenadas reais 3D opcionais
}

export interface ProcessFrameInput {
  timestamp: number; // em milissegundos
  hands: HandInput[];
}

export type GestureCancellationReason =
  | "hand_lost"
  | "camera_switch"
  | "recognition_paused"
  | "recognizer_unregistered"
  | "engine_stopped"
  | "engine_destroyed";

export interface FingerState {
  extended: boolean;
  extensionRatio: number; // 0 (completamente flexionado) a 1 (estendido)
  tipDirection: Landmark3D;
  primaryDirection: "UP" | "DOWN" | "LEFT" | "RIGHT" | "NONE";
}

export interface DerivedHandFeatures {
  handScale: number;
  palmCenter: Point2D;
  palmNormal: Landmark3D;
  fingers: {
    thumb: FingerState;
    index: FingerState;
    middle: FingerState;
    ring: FingerState;
    pinky: FingerState;
  };
  extendedFingers: ("thumb" | "index" | "middle" | "ring" | "pinky")[];
  extendedCount: number;
  pinchDistance: number; // normalizado pela escala da mão
  pinchIntensity: number; // 0 a 1
  isPinching: boolean;
  okContact: boolean;
  victorySeparation: number;
}

export interface TrackedHand {
  handId: string;
  handedness: Handedness;
  landmarks: Landmark3D[];
  worldLandmarks?: Landmark3D[];
  features: DerivedHandFeatures;
  confidence: number;
  lastSeenTimestamp: number;
  firstSeenTimestamp: number;
}

export interface FrameHistoryEntry {
  timestamp: number;
  palmCenter: Point2D;
  features: DerivedHandFeatures;
}

export interface CustomGestureContext {
  handId: string;
  handedness: Handedness;
  landmarks: Landmark3D[];
  worldLandmarks?: Landmark3D[];
  features: DerivedHandFeatures;
  history: FrameHistoryEntry[];
  timestamp: number;
}

export interface CustomGestureResult {
  matched: boolean;
  score?: number;
  data?: Record<string, unknown>;
}

export type CustomGestureCallback = (
  context: CustomGestureContext
) => CustomGestureResult | boolean | null;

export interface CustomGestureDefinition {
  name: string;
  recognize: CustomGestureCallback;
  description?: string;
}

/* Event Payloads */

export interface ReadyEvent {
  timestamp: number;
}

export interface HandDetectedEvent {
  handId: string;
  handedness: Handedness;
  timestamp: number;
  landmarks: Landmark3D[];
  confidence: number;
}

export interface HandTrackingEvent {
  handId: string;
  handedness: Handedness;
  timestamp: number;
  landmarks: Landmark3D[];
  worldLandmarks?: Landmark3D[];
  features: DerivedHandFeatures;
  confidence: number;
}

export interface HandLostEvent {
  handId: string;
  handedness: Handedness;
  timestamp: number;
}

export interface BaseGestureEvent {
  gesture: GestureName;
  handId: string;
  handedness: Handedness;
  score: number;
  timestamp: number;
  duration?: number;
  data?: Record<string, unknown>;
}

export interface GestureDetectedEvent extends BaseGestureEvent {}
export interface GestureStartEvent extends BaseGestureEvent {
  duration: number;
}
export interface GestureUpdateEvent extends BaseGestureEvent {
  duration: number;
}
export interface GestureEndEvent extends BaseGestureEvent {
  duration: number;
}
export interface GestureCancelledEvent extends BaseGestureEvent {
  reason: GestureCancellationReason;
}

export interface CameraErrorEvent {
  code: string;
  message: string;
  cause?: unknown;
  timestamp: number;
  recoverable: boolean;
}

export interface GestureEventMap {
  "command:detected": CommandDetectedEvent;
  "recognition:state": RecognitionStateEvent;
  "ready": ReadyEvent;
  "hand:detected": HandDetectedEvent;
  "hand:tracking": HandTrackingEvent;
  "hand:lost": HandLostEvent;
  "gesture:detected": GestureDetectedEvent;
  "gesture:start": GestureStartEvent;
  "gesture:update": GestureUpdateEvent;
  "gesture:end": GestureEndEvent;
  "gesture:cancelled": GestureCancelledEvent;
  "camera:error": CameraErrorEvent;
  "error": GestureEngineError;
}

/** Command safety settings. Raw gesture events remain available for diagnostics. */
export const RECOGNITION_MODES = {
  ALWAYS_ON: "ALWAYS_ON", ARMED: "ARMED", BYPASS: "BYPASS",
} as const;
export type RecognitionMode = typeof RECOGNITION_MODES[keyof typeof RECOGNITION_MODES];

/** Normalized camera coordinates, after horizontal mirroring when enabled. */
export interface ActivationRegion { x: number; y: number; width: number; height: number }
export interface RecognitionOptions {
  mode?: RecognitionMode;
  activationGesture?: GestureName;
  activationTimeMs?: number;
  armedTimeoutMs?: number;
  requireRelease?: boolean;
  releaseTimeMs?: number;
  /** Larger gaps reset pending confirmation (default 250 ms). */
  maxFrameGapMs?: number;
  region?: ActivationRegion | null;
  /** Priority order; first matching gesture wins, one command per hand/frame. */
  commandGestures?: GestureName[];
}
export interface RecognitionHandState {
  handId: string;
  status: "OUTSIDE_ROI" | "WAITING_ACTIVATION" | "ACTIVATING" | "WAITING_RELEASE" | "READY" | "STABILIZING";
  progress: number;
  armed: boolean;
  gesture?: GestureName;
}
export interface RecognitionStateEvent {
  timestamp: number;
  mode: RecognitionMode;
  enabled: boolean;
  hands: RecognitionHandState[];
}
export interface CommandDetectedEvent extends BaseGestureEvent {
  mode: RecognitionMode;
}

export interface GestureEngineOptions {
  recognition?: RecognitionOptions;
  maxHands?: number;
  gestures?: GestureName[];
  stabilizationTimeMs?: number; // confirmação de pose (padrão 150ms)
  absenceTimeoutMs?: number; // tolerância para perda da mão (padrão 250ms)
  endGracePeriodMs?: number; // tolerância para desativação de pose (padrão 150ms)
  mirrored?: boolean; // espelhamento de coordenadas/swipes
  swipeThreshold?: number; // deslocamento relativo mínimo para swipe
  swipeCooldownMs?: number; // cooldown entre swipes por mão (padrão 500ms)
}

export interface ProcessFrameResult {
  timestamp: number;
  trackedHands: TrackedHand[];
  activeGestures: {
    gesture: GestureName;
    handId: string;
    handedness: Handedness;
    score: number;
    duration: number;
    data?: Record<string, unknown>;
  }[];
}

export class GestureEngineError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
  override readonly cause?: unknown;

  constructor(options: {
    code: string;
    message: string;
    recoverable?: boolean;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "GestureEngineError";
    this.code = options.code;
    this.recoverable = options.recoverable ?? false;
    this.cause = options.cause;
  }
}
