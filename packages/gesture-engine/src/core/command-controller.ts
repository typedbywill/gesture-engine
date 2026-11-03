import {
  GestureEngineError,
  type CommandDetectedEvent, type GestureName, type RecognitionOptions,
  type RecognitionStateEvent, type TrackedHand,
} from "./types.js";

type Match = { score: number; data?: Record<string, unknown>; duration?: number };
interface HandState {
  eligibleSince: number;
  candidate?: GestureName;
  since: number;
  armedUntil: number;
  locked: Set<GestureName>;
  releasedSince?: number;
}

/** Evaluates intent separately from raw pose diagnostics. No DOM or clock dependency. */
export class CommandController {
  private options: Required<Omit<RecognitionOptions, "commandGestures">> & Pick<RecognitionOptions, "commandGestures">;
  private states = new Map<string, HandState>();
  private lastTimestamp = -Infinity;
  private snapshot: RecognitionStateEvent = { timestamp: 0, mode: "ALWAYS_ON", enabled: true, hands: [] };

  constructor(options: RecognitionOptions = {}) {
    this.options = {
      mode: "ALWAYS_ON", activationGesture: "OPEN_PALM", activationTimeMs: 500,
      armedTimeoutMs: 5000, requireRelease: true, releaseTimeMs: 150, region: null,
    };
    this.configure(options);
  }

  configure(options: RecognitionOptions): void {
    const next = { ...this.options, ...options };
    const roi = next.region;
    if (!["ALWAYS_ON", "ARMED", "BYPASS"].includes(next.mode) ||
        !next.activationGesture || next.activationGesture.startsWith("SWIPE_") || next.activationGesture === "UNKNOWN" ||
        ![next.activationTimeMs, next.armedTimeoutMs, next.releaseTimeMs].every(v => Number.isFinite(v) && v >= 0) ||
        next.armedTimeoutMs === 0 ||
        (roi && (![roi.x, roi.y, roi.width, roi.height].every(Number.isFinite) ||
          roi.x < 0 || roi.y < 0 || roi.width <= 0 || roi.height <= 0 || roi.x + roi.width > 1 || roi.y + roi.height > 1))) {
      throw new GestureEngineError({ code: "INVALID_RECOGNITION_OPTIONS", message: "Configuração de reconhecimento inválida." });
    }
    this.options = { ...next, region: roi ? { ...roi } : null, commandGestures: next.commandGestures?.slice() };
    this.reset();
  }

  getOptions(): RecognitionOptions {
    return { ...this.options, region: this.options.region ? { ...this.options.region } : null, commandGestures: this.options.commandGestures?.slice() };
  }

  reset(): void {
    this.states.clear();
    this.lastTimestamp = -Infinity;
    this.snapshot = { ...this.snapshot, mode: this.options.mode, hands: [] };
  }

  getState(): RecognitionStateEvent {
    return { ...this.snapshot, hands: this.snapshot.hands.map(h => ({ ...h })) };
  }

  process(
    hands: TrackedHand[], matches: Map<string, Map<GestureName, Match>>,
    timestamp: number, stabilizationTimeMs: number, mirrored: boolean, enabled: boolean,
  ): CommandDetectedEvent[] {
    const commands: CommandDetectedEvent[] = [];
    const { mode, region, activationGesture, activationTimeMs, armedTimeoutMs, requireRelease, releaseTimeMs } = this.options;
    this.snapshot = { timestamp, mode, enabled, hands: [] };
    // Broken frame continuity must never count towards confirmation.
    if (!Number.isFinite(timestamp) || timestamp <= this.lastTimestamp || timestamp - this.lastTimestamp > 250) {
      for (const state of this.states.values()) {
        state.candidate = undefined;
        state.eligibleSince = timestamp;
        state.armedUntil = -Infinity;
        state.releasedSince = undefined;
      }
    }
    this.lastTimestamp = timestamp;
    if (!enabled || mode === "BYPASS" || !Number.isFinite(timestamp)) {
      this.states.clear();
      return commands;
    }
    const present = new Set(hands.map(h => h.handId));
    for (const id of this.states.keys()) {
      if (!present.has(id)) {
        const state = this.states.get(id)!;
        state.candidate = undefined;
        state.eligibleSince = timestamp;
        state.armedUntil = -Infinity;
        state.releasedSince ??= timestamp;
        if (timestamp - state.releasedSince >= releaseTimeMs) this.states.delete(id);
      }
    }
    for (const hand of hands) {
      const raw = matches.get(hand.handId) ?? new Map<GestureName, Match>();
      let state = this.states.get(hand.handId);
      if (!state) {
        state = { eligibleSince: timestamp, since: timestamp, armedUntil: -Infinity, locked: new Set() };
        this.states.set(hand.handId, state);
      }
      const view = { handId: hand.handId, status: "READY" as RecognitionStateEvent["hands"][number]["status"], progress: 0, armed: mode === "ALWAYS_ON" || timestamp < state.armedUntil, gesture: undefined as GestureName | undefined };
      this.snapshot.hands.push(view);
      const x = mirrored ? 1 - hand.features.palmCenter.x : hand.features.palmCenter.x;
      const y = hand.features.palmCenter.y;
      if (region && !(x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height)) {
        state.candidate = undefined;
        state.eligibleSince = timestamp;
        state.armedUntil = -Infinity;
        view.armed = false;
        view.status = "OUTSIDE_ROI";
        continue;
      }
      if (state.locked.size) {
        view.status = "WAITING_RELEASE";
        // A swipe must settle (no swipe candidates) before another command.
        const holding = [...state.locked].some(g => raw.has(g) || (g === "__SWIPE__" && [...raw.keys()].some(k => k.startsWith("SWIPE_"))));
        if (holding) state.releasedSince = undefined;
        else state.releasedSince ??= timestamp;
        if (state.releasedSince === undefined || timestamp - state.releasedSince < releaseTimeMs) continue;
        state.locked.clear();
        state.releasedSince = undefined;
        state.candidate = undefined;
      }
      const waiting = mode === "ARMED" && timestamp >= state.armedUntil;
      const candidates = waiting ? [activationGesture] : (this.options.commandGestures ?? [...raw.keys()]);
      const gesture = candidates.find(g => raw.has(g) && g !== "UNKNOWN" && (waiting || mode !== "ARMED" || g !== activationGesture));
      if (!gesture) {
        state.candidate = undefined;
        view.status = waiting ? "WAITING_ACTIVATION" : "READY";
        continue;
      }
      if (state.candidate !== gesture) { state.candidate = gesture; state.since = timestamp; }
      const match = raw.get(gesture)!;
      if (gesture.startsWith("SWIPE_") && timestamp - state.eligibleSince < (match.duration ?? 0)) continue;
      const required = waiting ? activationTimeMs : stabilizationTimeMs;
      const elapsed = gesture.startsWith("SWIPE_") ? (match.duration ?? 0) : timestamp - state.since;
      view.status = waiting ? "ACTIVATING" : "STABILIZING";
      view.gesture = gesture;
      view.progress = required <= 0 ? 1 : Math.min(1, elapsed / required);
      if (elapsed < required) continue;
      state.candidate = undefined;
      if (waiting) {
        state.armedUntil = timestamp + armedTimeoutMs;
        // Activation never doubles as a command; all overlapping aliases must release.
        state.locked = new Set([...raw.keys()].filter(g => !g.startsWith("SWIPE_") && g !== "UNKNOWN"));
        view.armed = true;
        view.status = "WAITING_RELEASE";
        continue;
      }
      commands.push({ gesture, handId: hand.handId, handedness: hand.handedness, score: match.score, timestamp, duration: elapsed, data: match.data, mode });
      if (requireRelease) {
        state.locked = new Set([...raw.keys()].filter(g => !g.startsWith("SWIPE_") && g !== "UNKNOWN"));
        if (gesture.startsWith("SWIPE_")) state.locked.add("__SWIPE__");
      }
      if (mode === "ARMED") state.armedUntil = -Infinity; // one activation, one command
      view.armed = mode === "ALWAYS_ON";
      view.status = state.locked.size ? "WAITING_RELEASE" : (mode === "ARMED" ? "WAITING_ACTIVATION" : "READY");
    }
    return commands;
  }
}
