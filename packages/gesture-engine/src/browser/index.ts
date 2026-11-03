export {
  BrowserGestureEngine,
  createBrowserGestureEngine,
  type BrowserGestureEngineOptions,
} from "./browser-engine.js";

export {
  CameraAdapter,
  type CameraAdapterOptions,
} from "./camera-adapter.js";

export {
  MediaPipePipeline,
  type FrameCallback,
  type PipelineOptions,
  type DetectionResult,
} from "./pipeline.js";

// Re-exporta core constants e types para conveniência
export {
  BUILT_IN_GESTURES,
  GESTURE_EVENTS,
  GestureEngine,
  GestureEngineError,
  type BaseGestureEvent,
  type BuiltInGesture,
  type CameraErrorEvent,
  type CustomGestureCallback,
  type CustomGestureContext,
  type CustomGestureDefinition,
  type CustomGestureResult,
  type DerivedHandFeatures,
  type FingerState,
  type FrameHistoryEntry,
  type GestureCancellationReason,
  type GestureCancelledEvent,
  type GestureDetectedEvent,
  type GestureEndEvent,
  type GestureEngineOptions,
  type GestureEventMap,
  type GestureEventName,
  type GestureName,
  type GestureStartEvent,
  type GestureUpdateEvent,
  type HandDetectedEvent,
  type HandInput,
  type HandLostEvent,
  type HandTrackingEvent,
  type Handedness,
  type Landmark3D,
  type Point2D,
  type ProcessFrameInput,
  type ProcessFrameResult,
  type ReadyEvent,
  type TrackedHand,
} from "../core/index.js";
