import {
  BUILT_IN_GESTURES,
  createBrowserGestureEngine,
  type HandTrackingEvent,
  type GestureEventMap,
} from "gesture-engine/browser";
import { setupLiveHUD } from "./live-hud.js";
import { LandmarkDrawer } from "./drawer.js";
import { SimulatedCamera, type SimulationMode } from "./simulated-camera.js";

// DOM Elements
const videoEl = document.getElementById("webcamVideo") as HTMLVideoElement;
const canvasEl = document.getElementById("overlayCanvas") as HTMLCanvasElement;
const videoContainer = document.getElementById("videoContainer") as HTMLDivElement;

const btnStartStop = document.getElementById("btnStartStop") as HTMLButtonElement;
const btnPauseRecognition = document.getElementById("btnPauseRecognition") as HTMLButtonElement;
const chkMirror = document.getElementById("chkMirror") as HTMLInputElement;
const cameraSelect = document.getElementById("cameraSelect") as HTMLSelectElement;
const cameraSelectWrapper = document.getElementById("cameraSelectWrapper") as HTMLDivElement;

const btnRealCamera = document.getElementById("btnRealCamera") as HTMLButtonElement;
const btnSimulated = document.getElementById("btnSimulated") as HTMLButtonElement;
const simulationSelectWrapper = document.getElementById("simulationSelectWrapper") as HTMLDivElement;
const simulationSelect = document.getElementById("simulationSelect") as HTMLSelectElement;

const fpsBadge = document.getElementById("fpsBadge") as HTMLDivElement;
const handsBadge = document.getElementById("handsBadge") as HTMLDivElement;
const hudActiveGestures = document.getElementById("hudActiveGestures") as HTMLDivElement;

const logContainer = document.getElementById("logContainer") as HTMLDivElement;
const btnClearLog = document.getElementById("btnClearLog") as HTMLButtonElement;
const chkAutoScroll = document.getElementById("chkAutoScroll") as HTMLInputElement;

const sliderStabilization = document.getElementById("sliderStabilization") as HTMLInputElement;
const valStabilization = document.getElementById("valStabilization") as HTMLSpanElement;
const sliderAbsence = document.getElementById("sliderAbsence") as HTMLInputElement;
const valAbsence = document.getElementById("valAbsence") as HTMLSpanElement;
const sliderCooldown = document.getElementById("sliderCooldown") as HTMLInputElement;
const valCooldown = document.getElementById("valCooldown") as HTMLSpanElement;

const statusDot = document.getElementById("engineStatusIndicator") as HTMLDivElement;
const statusText = document.getElementById("engineStatusText") as HTMLSpanElement;

const txtCustomName = document.getElementById("txtCustomName") as HTMLInputElement;
const selCustomPreset = document.getElementById("selCustomPreset") as HTMLSelectElement;
const btnRegisterCustom = document.getElementById("btnRegisterCustom") as HTMLButtonElement;

// State
let isRunning = false;
let isSimulationMode = false;
let isMirrored = true;
let drawer: LandmarkDrawer;
let simulatedCamera: SimulatedCamera;

// FPS tracking
let frameCount = 0;
let lastFpsTime = performance.now();
let activeHandsMap = new Map<string, HandTrackingEvent>();
let renderFrameId: number | null = null;
const gesturePills = new Map<string, {
  element: HTMLDivElement;
  score: HTMLSpanElement;
  duration: HTMLSpanElement;
}>();

// 1. Instancia o BrowserGestureEngine
const engine = createBrowserGestureEngine({
  video: videoEl,
  maxHands: 2,
  stabilizationTimeMs: 150,
  absenceTimeoutMs: 250,
  swipeCooldownMs: 500,
  mirrored: true,
  recognition: {
    requireRelease: true,
    commandGestures: ["NUMBER_ONE", "NUMBER_TWO", "PINCH", "CLOSED_FIST", "THUMBS_UP", "THUMBS_DOWN"],
  },
  assets: {
    modelAssetPath: "/models/hand_landmarker.task",
    wasmRoot: "/mediapipe/wasm",
  },
});

drawer = new LandmarkDrawer(canvasEl);
simulatedCamera = new SimulatedCamera();
const liveHUD = setupLiveHUD(engine, async () => { if (isRunning) await stopCapture(); }, () => {
  updateSimulationPosition();
  scheduleRender();
});

function updateSimulationPosition() {
  const checked = (document.getElementById("simulationInsideRoi") as HTMLInputElement).checked;
  const region = engine.getRecognitionOptions().region;
  simulatedCamera.setPosition(checked && region
    ? { x: isMirrored ? 1 - (region.x + region.width / 2) : region.x + region.width / 2, y: region.y + region.height / 2 }
    : null);
}
document.getElementById("simulationInsideRoi")!.addEventListener("change", updateSimulationPosition);

// Event Logging
function appendLog(eventType: string, details: string, cssClass = "") {
  if (logContainer.querySelector(".log-placeholder")) {
    logContainer.innerHTML = "";
  }

  const timeStr = new Date().toLocaleTimeString("pt-BR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  const row = document.createElement("div");
  row.className = "log-row";
  row.innerHTML = `
    <span class="log-time">${timeStr}</span>
    <span class="log-event ${cssClass}">${eventType}</span>
    <span class="log-details">${details}</span>
  `;

  logContainer.appendChild(row);

  // Limite de 150 linhas
  while (logContainer.children.length > 150) {
    logContainer.removeChild(logContainer.firstChild!);
  }

  if (chkAutoScroll.checked) {
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

// Atualização de HUD de Gestos Ativos
function updateActiveGesturesHUD() {
  const activeGestures = engine.getActiveGestures();
  const activeKeys = new Set<string>();

  for (const g of activeGestures) {
    const key = JSON.stringify([g.handId, g.gesture]);
    activeKeys.add(key);
    let pill = gesturePills.get(key);

    if (!pill) {
      const element = document.createElement("div");
      element.className = "gesture-pill";
      const label = document.createElement("span");
      label.textContent = g.gesture;
      const score = document.createElement("span");
      const duration = document.createElement("span");
      score.className = duration.className = "score-badge";
      element.append(label, score, duration);
      hudActiveGestures.appendChild(element);
      pill = { element, score, duration };
      gesturePills.set(key, pill);
    }

    const scoreText = `${Math.round(g.score * 100)}%`;
    const durationText = `${(g.duration / 1000).toFixed(1)}s`;
    if (pill.score.textContent !== scoreText) pill.score.textContent = scoreText;
    if (pill.duration.textContent !== durationText) pill.duration.textContent = durationText;
  }

  for (const [key, pill] of gesturePills) {
    if (!activeKeys.has(key)) {
      pill.element.remove();
      gesturePills.delete(key);
    }
  }
}

// Agrupa eventos das duas mãos e renderiza após o processamento completo dos gestos.
function scheduleRender() {
  if (renderFrameId !== null) return;
  renderFrameId = requestAnimationFrame(() => {
    renderFrameId = null;
    const handsText = `Mãos: ${activeHandsMap.size}`;
    if (handsBadge.textContent !== handsText) handsBadge.textContent = handsText;
    const { width, height } = videoContainer.getBoundingClientRect();
    drawer.resize(width, height);
    drawer.drawHands(
      Array.from(activeHandsMap.values()),
      isMirrored,
      isSimulationMode ? undefined : { width: videoEl.videoWidth, height: videoEl.videoHeight },
    );
    drawer.drawRegion(engine.getRecognitionOptions().region,
      isSimulationMode ? undefined : { width: videoEl.videoWidth, height: videoEl.videoHeight });
    updateActiveGesturesHUD();
  });
}

new ResizeObserver(scheduleRender).observe(videoContainer);
videoEl.addEventListener("resize", scheduleRender);

engine.on("command:detected", ({ gesture, handId }) => {
  appendLog("command:detected", `${gesture} aceito para ${handId}`, "gesture-start");
});

// Inscrição em Eventos Tipados
engine.on("ready", () => {
  appendLog("ready", "Motor inicializado e pronto para processamento.");
});

engine.on("hand:detected", ({ handId, handedness }) => {
  appendLog("hand:detected", `Mão ${handedness} identificada com ID: ${handId}`, "hand-detected");
});

engine.on("hand:tracking", (hand) => {
  activeHandsMap.set(hand.handId, hand);

  // Atualiza FPS
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    fpsBadge.textContent = `FPS: ${fps}`;
    frameCount = 0;
    lastFpsTime = now;
  }

  scheduleRender();
});

engine.on("hand:lost", ({ handId, handedness }) => {
  activeHandsMap.delete(handId);
  scheduleRender();
  appendLog("hand:lost", `Mão ${handedness} (${handId}) perdida após ausência`, "hand-lost");
});

engine.on("gesture:detected", ({ gesture, handId, score, data }) => {
  const scorePct = Math.round(score * 100);
  const extra = data ? ` (${JSON.stringify(data)})` : "";
  appendLog("gesture:detected", `${gesture} na mão ${handId} [Score: ${scorePct}%]${extra}`, "gesture-detected");
});

engine.on("gesture:start", ({ gesture, handId }) => {
  appendLog("gesture:start", `${gesture} confirmado na mão ${handId}`, "gesture-start");
});

engine.on("gesture:end", ({ gesture, handId, duration }) => {
  const durSec = ((duration ?? 0) / 1000).toFixed(2);
  appendLog("gesture:end", `${gesture} finalizado na mão ${handId} após ${durSec}s`, "gesture-end");
});

engine.on("gesture:cancelled", ({ gesture, handId, reason }) => {
  scheduleRender();
  appendLog("gesture:cancelled", `${gesture} cancelado na mão ${handId} [Motivo: ${reason}]`, "gesture-cancelled");
});

engine.on("camera:error", ({ code, message }) => {
  appendLog("camera:error", `[${code}] ${message}`, "error");
  setStatus("error", `Erro: ${code}`);
});

engine.on("error", (err) => {
  appendLog("error", `[${err.code}] ${err.message}`, "error");
});

function setStatus(state: "ready" | "running" | "paused" | "error", text: string) {
  statusDot.className = `status-indicator ${state}`;
  statusText.textContent = text;
}

// Controles de Câmera
async function refreshCameraList() {
  try {
    const cameras = await engine.listCameras();
    cameraSelect.innerHTML = "";
    if (cameras.length === 0) {
      cameraSelect.innerHTML = "<option value=''>Nenhuma câmera encontrada</option>";
      return;
    }
    for (const cam of cameras) {
      const opt = document.createElement("option");
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Câmera ${cameraSelect.options.length + 1}`;
      cameraSelect.appendChild(opt);
    }
  } catch (err) {
    cameraSelect.innerHTML = "<option value=''>Erro ao listar câmeras</option>";
  }
}

cameraSelect.addEventListener("change", async () => {
  const deviceId = cameraSelect.value;
  if (!deviceId) return;
  try {
    await engine.switchCamera(deviceId);
    appendLog("camera:switch", `Câmera trocada para: ${deviceId}`);
  } catch (err) {
    appendLog("camera:error", `Falha ao trocar câmera: ${(err as Error).message}`, "error");
  }
});

// Start / Stop
btnStartStop.addEventListener("click", async () => {
  if (isRunning) {
    await stopCapture();
  } else {
    await startCapture();
  }
});

async function startCapture() {
  try {
    setStatus("running", "Inicializando...");
    btnStartStop.disabled = true;

    if (isSimulationMode) {
      await engine.getCoreEngine().init();
      await engine.getCoreEngine().start();
      simulatedCamera.start((hands, timestamp) => {
        engine.processFrame({ timestamp, hands });
      });
      isRunning = true;
      setStatus("running", "Mídia Simulada Ativa");
    } else {
      await engine.init();
      await engine.start();
      await refreshCameraList();
      isRunning = true;
      setStatus("running", "Capturando Câmera");
    }

    btnStartStop.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
      <span>Parar Captura</span>
    `;
    btnStartStop.classList.add("running");
  } catch (err) {
    setStatus("error", "Erro na inicialização");
    appendLog("error", (err as Error).message, "error");
  } finally {
    btnStartStop.disabled = false;
  }
}

async function stopCapture() {
  try {
    btnStartStop.disabled = true;
    if (isSimulationMode) {
      simulatedCamera.stop();
      await engine.getCoreEngine().stop();
    } else {
      await engine.stop();
    }

    isRunning = false;
    liveHUD.renderState({ ...engine.getRecognitionState(), enabled: false, hands: [] });
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
      renderFrameId = null;
    }
    drawer.clear();
    activeHandsMap.clear();
    handsBadge.textContent = "Mãos: 0";
    fpsBadge.textContent = "FPS: --";
    hudActiveGestures.innerHTML = "";
    gesturePills.clear();
    setStatus("ready", "Parado");

    btnStartStop.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span>Iniciar Captura</span>
    `;
    btnStartStop.classList.remove("running");
  } finally {
    btnStartStop.disabled = false;
  }
}

// Pause / Resume Recognition
btnPauseRecognition.addEventListener("click", () => {
  const isPaused = !engine.getCoreEngine().isRecognitionEnabled();
  if (isPaused) {
    engine.startRecognition();
    btnPauseRecognition.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
      <span>Pausar Reconhecimento</span>
    `;
    setStatus("running", "Reconhecimento Ativo");
  } else {
    engine.stopRecognition();
    btnPauseRecognition.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span>Retomar Reconhecimento</span>
    `;
    setStatus("paused", "Reconhecimento Pausado");
  }
  liveHUD.renderState({ ...engine.getRecognitionState(), enabled: engine.getCoreEngine().isRecognitionEnabled() });
  scheduleRender();
});

// Mirror Toggle
chkMirror.addEventListener("change", () => {
  isMirrored = chkMirror.checked;
  engine.setMirrored(isMirrored);
  updateSimulationPosition();
  if (isMirrored) {
    videoContainer.classList.add("mirrored");
  } else {
    videoContainer.classList.remove("mirrored");
  }
  scheduleRender();
});

// Mode switch: Real Camera vs Simulated Media
btnRealCamera.addEventListener("click", async () => {
  if (!isSimulationMode) return;
  if (isRunning) await stopCapture();
  isSimulationMode = false;
  btnRealCamera.classList.add("active");
  btnSimulated.classList.remove("active");
  cameraSelectWrapper.classList.remove("hidden");
  simulationSelectWrapper.classList.add("hidden");
  document.getElementById("simulationPositionWrapper")!.classList.add("hidden");
  appendLog("mode", "Modo alternado para Câmera Real");
});

btnSimulated.addEventListener("click", async () => {
  if (isSimulationMode) return;
  if (isRunning) await stopCapture();
  isSimulationMode = true;
  btnSimulated.classList.add("active");
  btnRealCamera.classList.remove("active");
  simulationSelectWrapper.classList.remove("hidden");
  document.getElementById("simulationPositionWrapper")!.classList.remove("hidden");
  cameraSelectWrapper.classList.add("hidden");
  appendLog("mode", "Modo alternado para Mídia Simulada (sem necessidade de webcam)");
});

simulationSelect.addEventListener("change", () => {
  const mode = simulationSelect.value as SimulationMode;
  simulatedCamera.setMode(mode);
  appendLog("simulation", `Pose simulada alterada para: ${mode}`);
});

// Sliders
sliderStabilization.addEventListener("input", () => {
  const val = Number(sliderStabilization.value);
  valStabilization.textContent = `${val} ms`;
  engine.setOptions({ stabilizationTimeMs: val });
});

sliderAbsence.addEventListener("input", () => {
  const val = Number(sliderAbsence.value);
  valAbsence.textContent = `${val} ms`;
  engine.setOptions({ absenceTimeoutMs: val });
});

sliderCooldown.addEventListener("input", () => {
  const val = Number(sliderCooldown.value);
  valCooldown.textContent = `${val} ms`;
  engine.setOptions({ swipeCooldownMs: val });
});

// Clear Log
btnClearLog.addEventListener("click", () => {
  logContainer.innerHTML = '<div class="log-placeholder">Log limpo.</div>';
});

// Custom Gesture Registration
btnRegisterCustom.addEventListener("click", () => {
  const name = txtCustomName.value.trim().toUpperCase();
  if (!name) {
    alert("Informe um nome para o gesto.");
    return;
  }

  const preset = selCustomPreset.value;

  try {
    engine.registerGesture({
      name,
      description: `Preset ${preset}`,
      recognize: (ctx) => {
        const f = ctx.features.fingers;

        if (preset === "ILY") {
          // Polegar, indicador e mínimo estendidos
          const matched =
            f.thumb.extended &&
            f.index.extended &&
            f.pinky.extended &&
            !f.middle.extended &&
            !f.ring.extended;
          return { matched, score: 0.95, data: { preset: "I_LOVE_YOU" } };
        }

        if (preset === "SHAKA") {
          // Polegar e mínimo estendidos
          const matched =
            f.thumb.extended &&
            f.pinky.extended &&
            !f.index.extended &&
            !f.middle.extended &&
            !f.ring.extended;
          return { matched, score: 0.9, data: { preset: "SHAKA" } };
        }

        if (preset === "SPOCK") {
          // Indicador e médio juntos, anelar e mínimo juntos, separados no meio
          const matched =
            f.index.extended &&
            f.middle.extended &&
            f.ring.extended &&
            f.pinky.extended &&
            ctx.features.victorySeparation > 0.25;
          return { matched, score: 0.9, data: { preset: "SPOCK" } };
        }

        return false;
      },
    });

    appendLog("custom:registered", `Gesto customizado '${name}' registrado com sucesso!`);
    alert(`Gesto '${name}' registrado! Faça o sinal para testar.`);
  } catch (err) {
    alert(`Erro ao registrar: ${(err as Error).message}`);
  }
});

// Mirror initial setting
videoContainer.classList.add("mirrored");
appendLog("init", "GestureEngine Playground pronto.");
