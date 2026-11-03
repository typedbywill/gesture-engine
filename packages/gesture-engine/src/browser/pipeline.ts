import { GestureEngineError, type HandInput, type Handedness, type Landmark3D } from "../core/types.js";

export interface PipelineOptions {
  modelAssetPath?: string;
  wasmRoot?: string;
  maxHands?: number;
  inferenceMode?: "worker" | "main" | "auto";
  targetFps?: number;
}

export interface DetectionResult {
  timestamp: number;
  hands: HandInput[];
}

export type FrameCallback = (result: DetectionResult) => void;

export class MediaPipePipeline {
  private handLandmarker: any = null;
  private isProcessing = false;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private rvfcId: number | null = null;
  private lastFrameTime = 0;
  private targetFrameIntervalMs: number;

  private modelAssetPath: string;
  private wasmRoot: string;
  private maxHands: number;
  private inferenceMode: "worker" | "main" | "auto";

  private videoElement: HTMLVideoElement | null = null;
  private onFrameCallback: FrameCallback | null = null;

  constructor(options?: PipelineOptions) {
    this.modelAssetPath = options?.modelAssetPath ?? "/models/hand_landmarker.task";
    this.wasmRoot = options?.wasmRoot ?? "/mediapipe/wasm";
    this.maxHands = options?.maxHands ?? 2;
    this.inferenceMode = options?.inferenceMode ?? "auto";
    const fps = options?.targetFps ?? 30;
    this.targetFrameIntervalMs = 1000 / Math.max(1, Math.min(60, fps));
  }

  async init(): Promise<void> {
    if (this.handLandmarker) return;

    try {
      // Carrega MediaPipe sob demanda
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");

      const vision = await FilesetResolver.forVisionTasks(this.wasmRoot);

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.modelAssetPath,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: this.maxHands,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch (gpuError) {
      // Tenta fallback com delegate CPU caso GPU falhe
      try {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(this.wasmRoot);
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: this.modelAssetPath,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: this.maxHands,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (err) {
        throw new GestureEngineError({
          code: "MEDIAPIPE_LOAD_FAILED",
          message: `Falha ao carregar o modelo MediaPipe HandLandmarker de '${this.modelAssetPath}'.`,
          cause: err,
          recoverable: true,
        });
      }
    }
  }

  start(video: HTMLVideoElement, onFrame: FrameCallback): void {
    this.videoElement = video;
    this.onFrameCallback = onFrame;
    this.isRunning = true;
    this.isProcessing = false;
    this.lastFrameTime = 0;

    this.scheduleNextFrame();
  }

  stop(): void {
    this.isRunning = false;
    this.isProcessing = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.rvfcId !== null && this.videoElement && "cancelVideoFrameCallback" in this.videoElement) {
      (this.videoElement as any).cancelVideoFrameCallback(this.rvfcId);
      this.rvfcId = null;
    }

    this.videoElement = null;
    this.onFrameCallback = null;
  }

  destroy(): void {
    this.stop();
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch {
        // Ignora erros ao fechar landmarker
      }
      this.handLandmarker = null;
    }
  }

  private scheduleNextFrame(): void {
    if (!this.isRunning || !this.videoElement) return;

    if ("requestVideoFrameCallback" in this.videoElement) {
      this.rvfcId = (this.videoElement as any).requestVideoFrameCallback(
        (_now: DOMHighResTimeStamp, metadata: any) => {
          this.onVideoFrame(metadata?.presentationTime ?? performance.now());
        }
      );
    } else {
      this.animationFrameId = requestAnimationFrame(() => {
        this.onVideoFrame(performance.now());
      });
    }
  }

  private async onVideoFrame(frameTime: number): Promise<void> {
    if (!this.isRunning || !this.videoElement) return;

    // Throttle para respeitar target FPS
    const elapsed = frameTime - this.lastFrameTime;
    if (elapsed < this.targetFrameIntervalMs) {
      this.scheduleNextFrame();
      return;
    }

    // Regra de descarte: se o processamento anterior ainda estiver em execução, descarta o frame excedente
    if (this.isProcessing) {
      this.scheduleNextFrame();
      return;
    }

    if (this.videoElement.readyState < 2) {
      // Vídeo ainda não tem dados suficientes
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
            hands: parsedHands,
          });
        }
      }
    } catch {
      // Ignora erro momentâneo de frame (ex: frame corrompido durante troca de câmera)
    } finally {
      this.isProcessing = false;
      this.scheduleNextFrame();
    }
  }

  private parseLandmarkerResult(result: any): HandInput[] {
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      return [];
    }

    const hands: HandInput[] = [];

    for (let i = 0; i < result.landmarks.length; i++) {
      const rawLandmarks = result.landmarks[i];
      if (!rawLandmarks || rawLandmarks.length < 21) continue;

      const landmarks: Landmark3D[] = rawLandmarks.map((p: any) => ({
        x: p.x,
        y: p.y,
        z: p.z ?? 0,
      }));

      // Handedness do MediaPipe
      let handedness: Handedness = "Right";
      let confidence = 0.9;

      if (result.handednesses && result.handednesses[i] && result.handednesses[i][0]) {
        const cat = result.handednesses[i][0];
        // Nota: MediaPipe espelha a categoria por convenção de selfie
        handedness = cat.categoryName === "Left" ? "Left" : "Right";
        confidence = cat.score ?? 0.9;
      }

      let worldLandmarks: Landmark3D[] | undefined;
      if (result.worldLandmarks && result.worldLandmarks[i]) {
        worldLandmarks = result.worldLandmarks[i].map((p: any) => ({
          x: p.x,
          y: p.y,
          z: p.z ?? 0,
        }));
      }

      hands.push({
        landmarks,
        worldLandmarks,
        handedness,
        confidence,
        score: confidence,
      });
    }

    return hands;
  }
}
