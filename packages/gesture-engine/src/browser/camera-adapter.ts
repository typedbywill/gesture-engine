import { GestureEngineError } from "../core/types.js";

export interface CameraAdapterOptions {
  video?: HTMLVideoElement;
  deviceId?: string;
  facingMode?: string | MediaTrackConstraintSet;
  width?: number | ConstrainULong;
  height?: number | ConstrainULong;
  idealFps?: number;
}

export class CameraAdapter {
  private currentStream: MediaStream | null = null;
  private currentDeviceId: string | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private ownVideoElement = false;

  constructor(options?: CameraAdapterOptions) {
    if (options?.video) {
      this.videoElement = options.video;
    }
    if (options?.deviceId) {
      this.currentDeviceId = options.deviceId;
    }
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  attachVideoElement(video: HTMLVideoElement): void {
    this.videoElement = video;
    if (this.currentStream && this.videoElement.srcObject !== this.currentStream) {
      this.videoElement.srcObject = this.currentStream;
      this.videoElement.play().catch(() => {});
    }
  }

  getCurrentDeviceId(): string | null {
    return this.currentDeviceId;
  }

  getStream(): MediaStream | null {
    return this.currentStream;
  }

  async listCameras(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "videoinput");
    } catch (err) {
      throw this.wrapCameraError(err, "Falha ao listar dispositivos de câmera.");
    }
  }

  async start(options?: CameraAdapterOptions): Promise<MediaStream> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new GestureEngineError({
        code: "CAMERA_NOT_SUPPORTED",
        message: "A API navigator.mediaDevices.getUserMedia não está disponível neste ambiente.",
        recoverable: false,
      });
    }

    // Para stream anterior se houver
    this.stopTracks();

    const deviceId = options?.deviceId ?? this.currentDeviceId;
    const facingMode = options?.facingMode ?? "user";
    const width = options?.width ?? { ideal: 1280 };
    const height = options?.height ?? { ideal: 720 };
    const fps = options?.idealFps ?? 30;

    const videoConstraints: MediaTrackConstraints = {
      width,
      height,
      frameRate: { ideal: fps, max: 60 },
    };

    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId };
    } else if (facingMode) {
      videoConstraints.facingMode = facingMode;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
    } catch (err) {
      // Se falhar com exact deviceId, tenta fallback genérico antes de desistir
      if (deviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        } catch {
          throw this.wrapCameraError(err, "Falha ao obter stream da câmera.");
        }
      } else {
        throw this.wrapCameraError(err, "Falha ao obter stream da câmera.");
      }
    }

    this.currentStream = stream;

    // Detecta deviceId real da track selecionada
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings?.();
      if (settings?.deviceId) {
        this.currentDeviceId = settings.deviceId;
      }
    }

    // Acopla ao video element se disponível
    if (this.videoElement) {
      this.videoElement.srcObject = stream;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      try {
        await this.videoElement.play();
      } catch {
        // Pode exigir interação do usuário, não falha fatalmente
      }
    }

    return stream;
  }

  async switchCamera(deviceId: string): Promise<MediaStream> {
    if (this.currentDeviceId === deviceId && this.currentStream?.active) {
      return this.currentStream;
    }

    this.currentDeviceId = deviceId;
    return this.start({ deviceId });
  }

  stop(): void {
    this.stopTracks();
    if (this.videoElement && this.videoElement.srcObject) {
      this.videoElement.srcObject = null;
    }
  }

  private stopTracks(): void {
    if (this.currentStream) {
      for (const track of this.currentStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignora falhas ao fechar track já inativa
        }
      }
      this.currentStream = null;
    }
  }

  private wrapCameraError(err: unknown, defaultMsg: string): GestureEngineError {
    const error = err as { name?: string; message?: string };
    const name = error?.name ?? "";

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return new GestureEngineError({
        code: "CAMERA_PERMISSION_DENIED",
        message: "Permissão de acesso à câmera negada pelo usuário ou sistema.",
        cause: err,
        recoverable: false,
      });
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return new GestureEngineError({
        code: "CAMERA_NOT_FOUND",
        message: "Nenhuma câmera compatível foi encontrada no dispositivo.",
        cause: err,
        recoverable: true,
      });
    }

    if (name === "NotReadableError" || name === "TrackStartError") {
      return new GestureEngineError({
        code: "CAMERA_IN_USE",
        message: "A câmera já está em uso por outro aplicativo ou processo.",
        cause: err,
        recoverable: true,
      });
    }

    if (name === "OverconstrainedError") {
      return new GestureEngineError({
        code: "CAMERA_CONSTRAINTS_FAILED",
        message: "As restrições solicitadas para a câmera não podem ser atendidas.",
        cause: err,
        recoverable: true,
      });
    }

    return new GestureEngineError({
      code: "CAMERA_INIT_FAILED",
      message: error?.message ? `${defaultMsg} (${error.message})` : defaultMsg,
      cause: err,
      recoverable: true,
    });
  }
}
