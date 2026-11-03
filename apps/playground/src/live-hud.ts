import type { BrowserGestureEngine, RecognitionMode, ActivationRegion, RecognitionStateEvent } from "gesture-engine/browser";

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export function setupLiveHUD(engine: BrowserGestureEngine, onBypass: () => Promise<void>, onRegion: () => void) {
  const mode = element<HTMLSelectElement>("recognitionMode");
  const activation = element<HTMLSelectElement>("activationGesture");
  const timeout = element<HTMLSelectElement>("armedTimeout");
  const release = element<HTMLInputElement>("requireRelease");
  const region = element<HTMLSelectElement>("activationRegion");
  const keepCamera = element<HTMLInputElement>("keepCameraInBypass");
  const badge = element("recognitionBadge");
  const help = element("recognitionHelp");
  const hands = element("recognitionHands");
  const stage = element("stagePreview");
  const sceneNames = ["Aurora", "Pulse", "Eclipse"];
  let scene = 0, playing = false, blackout = false, volume = 50, count = 0;
  const labels: Record<string, string> = {
    OUTSIDE_ROI: "Mova a palma para a região marcada", WAITING_ACTIVATION: "Aguardando gesto de ativação",
    ACTIVATING: "Confirmando ativação", WAITING_RELEASE: "Libere a pose anterior",
    READY: "Pronto para um comando", STABILIZING: "Mantenha o gesto",
  };
  function renderStage() {
    element("sceneTitle").textContent = blackout ? "Blackout" : sceneNames[scene];
    element("transportState").textContent = playing ? "Em execução" : "Pausado";
    element("volumeState").textContent = `Intensidade: ${volume}%`;
    element("commandCount").textContent = `${count} comandos aceitos`;
    stage.dataset.scene = String(scene);
    stage.classList.toggle("playing", playing);
    stage.classList.toggle("blackout", blackout);
    stage.style.setProperty("--intensity", String(volume / 100));
    Array.from(element("sceneTabs").children).forEach((tab, i) => tab.classList.toggle("selected", scene === i));
  }
  function renderState(state: RecognitionStateEvent) {
    badge.textContent = `${state.mode}${!state.enabled ? " · PAUSADO" : ""}`;
    badge.dataset.mode = state.mode;
    help.textContent = !state.enabled ? "Reconhecimento pausado. Retome para aceitar comandos." : state.mode === "BYPASS"
      ? "Comandos bloqueados. A captura pode continuar para diagnóstico."
      : state.mode === "ARMED" ? "Ative, libere a pose e execute um comando antes da janela expirar."
      : "Comandos contínuos com as proteções selecionadas.";
    hands.replaceChildren();
    if (!state.hands.length) {
      const empty = document.createElement("p");
      empty.className = "form-help";
      empty.textContent = state.mode === "BYPASS" ? "Nenhuma ação será executada." : "Aguardando mão na captura.";
      hands.append(empty);
    }
    for (const hand of state.hands) {
      const row = document.createElement("div");
      row.className = "recognition-hand";
      const label = document.createElement("span");
      label.textContent = `${hand.handId} · ${labels[hand.status]}${hand.armed && state.mode === "ARMED" ? " · ARMADO" : ""}`;
      const progress = document.createElement("progress");
      progress.max = 1;
      progress.value = hand.progress;
      progress.setAttribute("aria-label", "Confirmação temporal do gesto");
      row.append(label, progress);
      hands.append(row);
    }
  }
  async function configure() {
    const regions: Record<string, ActivationRegion | null> = {
      OFF: null, TOP_RIGHT: { x: 0.55, y: 0, width: 0.45, height: 0.5 },
      TOP_LEFT: { x: 0, y: 0, width: 0.45, height: 0.5 }, CENTER: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    };
    engine.configureRecognition({ mode: mode.value as RecognitionMode, activationGesture: activation.value,
      armedTimeoutMs: Number(timeout.value), requireRelease: release.checked, region: regions[region.value] });
    renderState(engine.getRecognitionState());
    onRegion();
    if (mode.value === "BYPASS" && !keepCamera.checked) await onBypass();
  }
  for (const control of [mode, activation, timeout, release, region, keepCamera]) control.addEventListener("change", () => { void configure(); });
  engine.on("recognition:state", renderState);
  engine.on("command:detected", ({ gesture }) => {
    let action = "";
    if (gesture === "NUMBER_ONE") { scene = (scene + 2) % 3; blackout = false; action = "Cena anterior"; }
    if (gesture === "NUMBER_TWO") { scene = (scene + 1) % 3; blackout = false; action = "Próxima cena"; }
    if (gesture === "PINCH") { playing = !playing; action = playing ? "Tocar" : "Pausar"; }
    if (gesture === "CLOSED_FIST") { blackout = !blackout; action = "Alternar blackout"; }
    if (gesture === "THUMBS_UP") { volume = Math.min(100, volume + 10); action = "Aumentar intensidade"; }
    if (gesture === "THUMBS_DOWN") { volume = Math.max(0, volume - 10); action = "Reduzir intensidade"; }
    count++;
    element("lastCommand").textContent = `${gesture} → ${action || "Sem ação nesta demo"}`;
    renderStage();
  });
  element("resetLiveDemo").addEventListener("click", () => {
    scene = 0; playing = false; blackout = false; volume = 50; count = 0;
    element("lastCommand").textContent = "Aguardando o primeiro comando.";
    renderStage();
  });
  renderStage();
  return { renderState };
}
