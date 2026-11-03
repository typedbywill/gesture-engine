import { GestureEngine } from "../core/engine.js";
import {
  type CustomGestureDefinition,
  type GestureCancellationReason,
  GestureEngineError,
  type GestureEngineOptions,
  type GestureEventMap,
  type GestureEventName,
  type ProcessFrameInput,
  type ProcessFrameResult,
} from "../core/types.js";
import { CameraAdapter, type CameraAdapterOptions } from "./camera-adapter.js";
import { MediaPipePipeline, type PipelineOptions } from "./pipeline.js";

export interface BrowserGestureEngineOptions extends GestureEngineOptions {
  video?: HTMLVideoElement;
  camera?: CameraAdapterOptions;
  assets?: {
    modelAssetPath?: string;
    wasmRoot?: string;
  };
  inferenceMode?: "worker" | "main" | "auto";
  targetFps?: number;
}

export class BrowserGestureEngine {
  private engine: GestureEngine;
  private cameraAdapter: CameraAdapter;
  private pipeline: MediaPipePipeline;
  private options: BrowserGestureEngineOptions;
  private isRunning = false;

  constructor(options: BrowserGestureEngineOptions = {}) {
    this.options = { ...options };

    this.engine = new GestureEngine(options);

    this.cameraAdapter = new CameraAdapter({
      video: options.video,
      ...options.camera,
    });

    this.pipeline = new MediaPipePipeline({
      modelAssetPath: options.assets?.modelAssetPath,
      wasmRoot: options.assets?.wasmRoot,
      maxHands: options.maxHands ?? 2,
      inferenceMode: options.inferenceMode ?? "auto",
      targetFps: options.targetFps ?? 30,
    });
  }

  // Delega eventos ao core
  on<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): () => void {
    return this.engine.on(event, handler);
  }

  once<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): () => void {
    return this.engine.once(event, handler);
  }

  off<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): void {
    this.engine.off(event, handler);
  }

  // Ciclo de vida
  async init(): Promise<void> {
    try {
      await this.engine.init();
      await this.pipeline.init();
    } catch (err) {
      const error =
        err instanceof GestureEngineError
          ? err
          : new GestureEngineError({
              code: "BROWSER_INIT_FAILED",
              message: (err as Error).message,
              cause: err,
              recoverable: true,
            });
      (this.engine as any).emitter.emit("error", error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      await this.engine.start();

      let videoEl = this.cameraAdapter.getVideoElement();
      if (!videoEl && typeof document !== "undefined") {
        // Cria elemento de vídeo interno invisível se nenhum foi passado
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
        const error =
          camErr instanceof GestureEngineError
            ? camErr
            : new GestureEngineError({
                code: "CAMERA_INIT_FAILED",
                message: (camErr as Error).message,
                cause: camErr,
                recoverable: true,
              });

        (this.engine as any).emitter.emit("camera:error", {
          code: error.code,
          message: error.message,
          cause: error.cause,
          timestamp: Date.now(),
          recoverable: error.recoverable,
        });
        (this.engine as any).emitter.emit("error", error);
        throw error;
      }

      if (videoEl) {
        this.pipeline.start(videoEl, (detectionResult) => {
          this.engine.processFrame({
            timestamp: detectionResult.timestamp,
            hands: detectionResult.hands,
          });
        });
      }

      this.isRunning = true;
    } catch (err) {
      // Liberação de recursos em inicializações incompletas
      this.cameraAdapter.stop();
      this.pipeline.stop();
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.pipeline.stop();
    this.cameraAdapter.stop();
    await this.engine.stop();
  }

  async destroy(): Promise<void> {
    this.isRunning = false;
    this.pipeline.destroy();
    this.cameraAdapter.stop();
    await this.engine.destroy();
  }

  startRecognition(): void {
    this.engine.startRecognition();
  }

  stopRecognition(): void {
    this.engine.stopRecognition();
  }

  processFrame(input: ProcessFrameInput): ProcessFrameResult {
    return this.engine.processFrame(input);
  }

  registerGesture(definition: CustomGestureDefinition): void {
    this.engine.registerGesture(definition);
  }

  unregisterGesture(name: string): boolean {
    return this.engine.unregisterGesture(name);
  }

  // Câmera e Adaptador de Vídeo
  async listCameras(): Promise<MediaDeviceInfo[]> {
    return this.cameraAdapter.listCameras();
  }

  async switchCamera(deviceId: string): Promise<void> {
    // Interrompe gestos ativos por troca de câmera
    const now = Date.now();
    const cancelled = (this.engine as any).stabilizer.cancelAll("camera_switch", now);
    for (const ev of cancelled) {
      (this.engine as any).emitter.emit("gesture:cancelled", ev);
    }

    try {
      await this.cameraAdapter.switchCamera(deviceId);
    } catch (camErr) {
      const error =
        camErr instanceof GestureEngineError
          ? camErr
          : new GestureEngineError({
              code: "CAMERA_SWITCH_FAILED",
              message: (camErr as Error).message,
              cause: camErr,
              recoverable: true,
            });

      (this.engine as any).emitter.emit("camera:error", {
        code: error.code,
        message: error.message,
        cause: error.cause,
        timestamp: Date.now(),
        recoverable: error.recoverable,
      });
      (this.engine as any).emitter.emit("error", error);
      throw error;
    }
  }

  getCurrentCamera(): string | null {
    return this.cameraAdapter.getCurrentDeviceId();
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.cameraAdapter.getVideoElement();
  }

  attachVideoElement(video: HTMLVideoElement): void {
    this.cameraAdapter.attachVideoElement(video);
  }

  setMirrored(mirrored: boolean): void {
    this.engine.setMirrored(mirrored);
  }

  getCoreEngine(): GestureEngine {
    return this.engine;
  }
}

export function createBrowserGestureEngine(
  options: BrowserGestureEngineOptions = {}
): BrowserGestureEngine {
  return new BrowserGestureEngine(options);
}
