import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserGestureEngine, createBrowserGestureEngine } from "../src/browser/browser-engine.js";
import { CameraAdapter } from "../src/browser/camera-adapter.js";
import { GestureEngineError } from "../src/core/types.js";

describe("Browser & Camera Adapter with Mocks", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "navigator", originalDescriptor);
    }
    vi.restoreAllMocks();
  });

  function mockMediaDevices(mockImpl: Partial<MediaDevices>) {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn(),
          enumerateDevices: vi.fn(),
          ...mockImpl,
        },
      },
      configurable: true,
      writable: true,
    });
  }

  function createMockTrack() {
    return {
      stop: vi.fn(),
      getSettings: vi.fn().mockReturnValue({ deviceId: "mock-device-id" }),
    };
  }

  function createMockStream(tracks = [createMockTrack()]) {
    return {
      getTracks: vi.fn().mockReturnValue(tracks),
      getVideoTracks: vi.fn().mockReturnValue(tracks),
      active: true,
    } as unknown as MediaStream;
  }

  it("lista câmeras disponíveis corretamente", async () => {
    mockMediaDevices({
      enumerateDevices: vi.fn().mockResolvedValue([
        { deviceId: "cam-1", kind: "videoinput", label: "Front Camera" },
        { deviceId: "mic-1", kind: "audioinput", label: "Mic" },
        { deviceId: "cam-2", kind: "videoinput", label: "Back Camera" },
      ] as MediaDeviceInfo[]),
    });

    const adapter = new CameraAdapter();
    const cameras = await adapter.listCameras();

    expect(cameras.length).toBe(2);
    expect(cameras[0].deviceId).toBe("cam-1");
    expect(cameras[1].deviceId).toBe("cam-2");
  });

  it("trata erro de permissão negada com código CAMERA_PERMISSION_DENIED", async () => {
    const permError = new Error("Permission denied");
    permError.name = "NotAllowedError";

    mockMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(permError),
    });

    const adapter = new CameraAdapter();
    await expect(adapter.start()).rejects.toMatchObject({
      code: "CAMERA_PERMISSION_DENIED",
      recoverable: false,
    });
  });

  it("trata dispositivo não encontrado com código CAMERA_NOT_FOUND", async () => {
    const notFoundError = new Error("No camera found");
    notFoundError.name = "NotFoundError";

    mockMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(notFoundError),
    });

    const adapter = new CameraAdapter();
    await expect(adapter.start()).rejects.toMatchObject({
      code: "CAMERA_NOT_FOUND",
      recoverable: true,
    });
  });

  it("trata câmera ocupada com código CAMERA_IN_USE", async () => {
    const inUseError = new Error("Camera in use");
    inUseError.name = "NotReadableError";

    mockMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(inUseError),
    });

    const adapter = new CameraAdapter();
    await expect(adapter.start()).rejects.toMatchObject({
      code: "CAMERA_IN_USE",
      recoverable: true,
    });
  });

  it("libera tracks antigas ao trocar de câmera ou parar", async () => {
    const track1 = createMockTrack();
    const stream1 = createMockStream([track1]);

    const track2 = createMockTrack();
    const stream2 = createMockStream([track2]);

    mockMediaDevices({
      getUserMedia: vi
        .fn()
        .mockResolvedValueOnce(stream1)
        .mockResolvedValueOnce(stream2),
    });

    const adapter = new CameraAdapter();
    await adapter.start();

    // Troca de câmera
    await adapter.switchCamera("cam-2");
    expect(track1.stop).toHaveBeenCalled();

    // Parada
    adapter.stop();
    expect(track2.stop).toHaveBeenCalled();
  });

  it("cancela gestos ativos com motivo camera_switch ao trocar de câmera no BrowserEngine", async () => {
    const track1 = createMockTrack();
    const stream1 = createMockStream([track1]);
    const track2 = createMockTrack();
    const stream2 = createMockStream([track2]);

    mockMediaDevices({
      getUserMedia: vi
        .fn()
        .mockResolvedValueOnce(stream1)
        .mockResolvedValueOnce(stream2),
    });

    const browserEngine = createBrowserGestureEngine({
      stabilizationTimeMs: 0,
      gestures: ["OPEN_PALM"],
    });
    await browserEngine.getCoreEngine().init();
    await browserEngine.getCoreEngine().start();

    const cancelled: any[] = [];
    browserEngine.on("gesture:cancelled", (e) => cancelled.push(e));

    // Simula frame processado com gesto ativo
    const { createOpenPalm } = await import("./fixtures.js");
    browserEngine.processFrame({ timestamp: 100, hands: [createOpenPalm()] });

    // Troca de câmera
    await browserEngine.switchCamera("cam-2");

    expect(cancelled.length).toBe(1);
    expect(cancelled[0].reason).toBe("camera_switch");
    expect(cancelled[0].gesture).toBe("OPEN_PALM");
  });

  it("emite camera:error e error quando a inicialização falha e libera recursos", async () => {
    const track = createMockTrack();
    const stream = createMockStream([track]);

    const permError = new Error("Permission denied");
    permError.name = "NotAllowedError";

    mockMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(permError),
    });

    const browserEngine = createBrowserGestureEngine();

    const cameraErrors: any[] = [];
    const errors: any[] = [];

    browserEngine.on("camera:error", (e) => cameraErrors.push(e));
    browserEngine.on("error", (e) => errors.push(e));

    await expect(browserEngine.start()).rejects.toBeDefined();

    expect(cameraErrors.length).toBe(1);
    expect(cameraErrors[0].code).toBe("CAMERA_PERMISSION_DENIED");
    expect(errors.length).toBe(1);
  });
});
