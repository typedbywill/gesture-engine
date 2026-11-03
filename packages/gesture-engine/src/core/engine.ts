import { CommandController } from "./command-controller.js";
import { TypedEventEmitter } from "./event-emitter.js";
import { STATIC_RECOGNIZERS } from "./recognizers/static-recognizers.js";
import { SwipeTracker } from "./recognizers/swipe-recognizer.js";
import { GestureStabilizer } from "./stabilizer.js";
import { HandTracker } from "./tracker.js";
import {
  BUILT_IN_GESTURES,
  type BuiltInGesture,
  type CustomGestureContext,
  type CustomGestureDefinition,
  type GestureCancellationReason,
  type GestureEngineOptions,
  GestureEngineError,
  type GestureEventMap,
  type GestureName,
  type RecognitionOptions,
  type RecognitionMode,
  type Handedness,
  type ProcessFrameInput,
  type ProcessFrameResult,
} from "./types.js";

type EngineState = "UNINITIALIZED" | "INITIALIZED" | "RUNNING" | "STOPPED" | "DESTROYED";

export class GestureEngine {
  private emitter = new TypedEventEmitter();
  private tracker: HandTracker;
  private stabilizer: GestureStabilizer;
  private swipeTracker: SwipeTracker;
  private commands: CommandController;

  private state: EngineState = "UNINITIALIZED";
  private recognitionEnabled = true;

  private enabledGestures: Set<GestureName> = new Set();
  private customGestures: Map<string, CustomGestureDefinition> = new Map();
  private options: GestureEngineOptions;

  constructor(options: GestureEngineOptions = {}) {
    this.options = { ...options };
    this.commands = new CommandController(options.recognition);

    this.tracker = new HandTracker({
      maxHands: options.maxHands ?? 2,
      absenceTimeoutMs: options.absenceTimeoutMs ?? 250,
    });

    this.stabilizer = new GestureStabilizer({
      stabilizationTimeMs: options.stabilizationTimeMs ?? 150,
      endGracePeriodMs: options.endGracePeriodMs ?? 150,
    });

    this.swipeTracker = new SwipeTracker({
      cooldownMs: options.swipeCooldownMs ?? 500,
      thresholdScale: options.swipeThreshold ?? 0.35,
      mirrored: options.mirrored ?? false,
    });

    // Inicializa lista de gestos habilitados
    if (options.gestures && options.gestures.length > 0) {
      for (const g of options.gestures) {
        this.enabledGestures.add(g);
      }
    } else {
      // Por padrão, todos os gestos embutidos são habilitados
      for (const g of Object.values(BUILT_IN_GESTURES)) {
        this.enabledGestures.add(g);
      }
    }
  }

  // Event Subscription
  on<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): () => void {
    return this.emitter.on(event, handler);
  }

  once<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): () => void {
    return this.emitter.once(event, handler);
  }

  off<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): void {
    this.emitter.off(event, handler);
  }

  // Lifecycle
  async init(): Promise<void> {
    if (this.state === "DESTROYED") {
      throw new GestureEngineError({
        code: "ALREADY_DESTROYED",
        message: "GestureEngine já foi destruído e não pode ser reinicializado.",
      });
    }

    if (this.state === "INITIALIZED" || this.state === "RUNNING") {
      return; // Idempotente
    }

    this.state = "INITIALIZED";
    this.emitter.emit("ready", { timestamp: Date.now() });
  }

  async start(): Promise<void> {
    if (this.state === "DESTROYED") {
      throw new GestureEngineError({
        code: "ALREADY_DESTROYED",
        message: "GestureEngine já foi destruído.",
      });
    }

    if (this.state === "RUNNING") {
      return; // Idempotente
    }

    if (this.state === "UNINITIALIZED") {
      await this.init();
    }

    this.state = "RUNNING";
    this.recognitionEnabled = true;
  }

  async stop(): Promise<void> {
    if (this.state === "STOPPED" || this.state === "UNINITIALIZED" || this.state === "DESTROYED") {
      return; // Idempotente
    }

    const now = Date.now();
    this.cancelAllGestures("engine_stopped", now);

    // Notifica perda de todas as mãos ativas
    const lostHands = this.tracker.clear();
    for (const h of lostHands) {
      this.emitter.emit("hand:lost", {
        handId: h.handId,
        handedness: h.handedness,
        timestamp: now,
      });
    }

    this.swipeTracker.clear();
    this.state = "STOPPED";
  }

  async destroy(): Promise<void> {
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

  startRecognition(): void {
    this.recognitionEnabled = true;
  }

  stopRecognition(): void {
    if (!this.recognitionEnabled) return;
    this.recognitionEnabled = false;

    // Cancela gestos em andamento preservando o rastreamento de mãos
    const now = Date.now();
    this.cancelAllGestures("recognition_paused", now);
  }

  isRecognitionEnabled(): boolean {
    return this.recognitionEnabled;
  }

  getState(): EngineState {
    return this.state;
  }

  configureRecognition(options: RecognitionOptions): void {
    this.commands.configure(options);
  }

  setRecognitionMode(mode: RecognitionMode): void {
    this.configureRecognition({ mode });
  }

  getRecognitionOptions(): RecognitionOptions { return this.commands.getOptions(); }
  getRecognitionState() { return this.commands.getState(); }
  getActiveGestures() { return this.stabilizer.getActiveGestures(); }

  setOptions(options: Pick<GestureEngineOptions, "stabilizationTimeMs" | "absenceTimeoutMs" | "endGracePeriodMs" | "swipeCooldownMs">): void {
    if (Object.values(options).some(v => v !== undefined && (!Number.isFinite(v) || v < 0))) {
      throw new GestureEngineError({ code: "INVALID_OPTIONS", message: "Tempos devem ser finitos e não negativos." });
    }
    Object.assign(this.options, options);
    this.stabilizer.setOptions(options);
    this.tracker.setOptions(options);
    if (options.swipeCooldownMs !== undefined) this.swipeTracker.setCooldown(options.swipeCooldownMs);
    this.commands.reset();
  }

  setMirrored(mirrored: boolean): void {
    this.commands.reset();
    this.options.mirrored = mirrored;
    this.swipeTracker.setMirrored(mirrored);
  }

  // Custom Gestures Registration
  registerGesture(definition: CustomGestureDefinition): void {
    if (!definition || !definition.name || typeof definition.recognize !== "function") {
      throw new GestureEngineError({
        code: "INVALID_GESTURE_DEFINITION",
        message: "A definição do gesto deve conter 'name' e callback 'recognize'.",
      });
    }

    const name = definition.name;

    // Verifica duplicação com gestos embutidos ou já registrados
    const isBuiltIn = Object.values(BUILT_IN_GESTURES).includes(name as BuiltInGesture);
    if (isBuiltIn || this.customGestures.has(name)) {
      throw new GestureEngineError({
        code: "DUPLICATE_GESTURE_NAME",
        message: `O gesto '${name}' já está registrado no GestureEngine.`,
      });
    }

    this.customGestures.set(name, definition);

    // Habilita automaticamente se a opção gestures não for restritiva
    if (!this.options.gestures || this.options.gestures.includes(name)) {
      this.enabledGestures.add(name);
    }
  }

  unregisterGesture(name: string): boolean {
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
  processFrame(input: ProcessFrameInput): ProcessFrameResult {
    if (this.state === "DESTROYED") {
      throw new GestureEngineError({
        code: "ALREADY_DESTROYED",
        message: "Não é possível processar frames com o motor destruído.",
      });
    }

    const timestamp = input.timestamp ?? Date.now();

    // Atualiza rastreamento de mãos
    const trackingResult = this.tracker.update(input.hands ?? [], timestamp);

    // Emite eventos de mãos detectadas
    for (const h of trackingResult.detectedHands) {
      this.emitter.emit("hand:detected", {
        handId: h.handId,
        handedness: h.handedness,
        timestamp,
        landmarks: h.landmarks,
        confidence: h.confidence,
      });
    }

    // Emite eventos de tracking contínuo para cada mão rastreada neste frame
    for (const h of trackingResult.updatedHands) {
      this.emitter.emit("hand:tracking", {
        handId: h.handId,
        handedness: h.handedness,
        timestamp,
        landmarks: h.landmarks,
        worldLandmarks: h.worldLandmarks,
        features: h.features,
        confidence: h.confidence,
      });
    }

    // Emite eventos de mãos perdidas e cancela gestos associados
    for (const lost of trackingResult.lostHands) {
      this.swipeTracker.resetHand(lost.handId);
      const cancelled = this.stabilizer.cancelForHand(lost.handId, "hand_lost", timestamp);
      for (const ev of cancelled) {
        this.emitter.emit("gesture:cancelled", ev);
      }
      this.emitter.emit("hand:lost", {
        handId: lost.handId,
        handedness: lost.handedness,
        timestamp,
      });
    }

    // Se o reconhecimento estiver suspenso ou motor parado, apenas retorna o tracking
    if (!this.recognitionEnabled || (this.state !== "RUNNING" && this.state !== "INITIALIZED")) {
      this.commands.process([], new Map(), timestamp, 0, false, false);
      this.emitter.emit("recognition:state", this.commands.getState());
      return {
        timestamp,
        trackedHands: trackingResult.trackedHands,
        activeGestures: [],
      };
    }

    // Raw gestures remain diagnostic; commands pass through the intent controller.
    const commandMatches = new Map<string, Map<GestureName, { score: number; data?: Record<string, unknown>; duration?: number }>>();

    // Avaliação de gestos para cada mão ativa
    const matchesByHand = new Map<
      string,
      {
        handedness: Handedness;
        matches: Map<GestureName, { score: number; data?: Record<string, unknown> }>;
      }
    >();

    const allCandidateGestures = Array.from(this.enabledGestures);
    const activationGesture = this.commands.getOptions().activationGesture!;
    const evaluationGestures = [...new Set([...allCandidateGestures, activationGesture])];

    for (const hand of trackingResult.updatedHands) {
      const handMatches = new Map<GestureName, { score: number; data?: Record<string, unknown> }>();
      let anyStaticMatched = false;

      const history = this.tracker.getHandHistory(hand.handId);
      const ctx: CustomGestureContext = {
        handId: hand.handId,
        handedness: hand.handedness,
        landmarks: hand.landmarks,
        worldLandmarks: hand.worldLandmarks,
        features: hand.features,
        history,
        timestamp,
      };

      // 1. Avalia gestos estáticos embutidos habilitados
      for (const gesture of evaluationGestures) {
        if (gesture === BUILT_IN_GESTURES.UNKNOWN) continue;
        if (
          gesture === BUILT_IN_GESTURES.SWIPE_LEFT ||
          gesture === BUILT_IN_GESTURES.SWIPE_RIGHT ||
          gesture === BUILT_IN_GESTURES.SWIPE_UP ||
          gesture === BUILT_IN_GESTURES.SWIPE_DOWN
        ) {
          continue; // Swipes são avaliados separadamente
        }

        const staticFn = STATIC_RECOGNIZERS[gesture as BuiltInGesture];
        if (staticFn) {
          try {
            const evalResult = staticFn(ctx);
            if (evalResult.matched) {
              handMatches.set(gesture, {
                score: evalResult.score,
                data: evalResult.data,
              });
              anyStaticMatched = true;
            }
          } catch (err) {
            this.emitter.emit(
              "error",
              new GestureEngineError({
                code: "RECOGNIZER_ERROR",
                message: `Erro ao avaliar gesto '${gesture}': ${(err as Error).message}`,
                cause: err,
                recoverable: true,
              })
            );
          }
        }
      }

      // 2. Avalia gestos personalizados registrados
      for (const [name, def] of this.customGestures.entries()) {
        if (!this.enabledGestures.has(name) && name !== activationGesture) continue;

        try {
          const evalResult = def.recognize(ctx);
          if (evalResult) {
            if (typeof evalResult === "boolean") {
              if (evalResult) {
                handMatches.set(name, { score: 1.0 });
                anyStaticMatched = true;
              }
            } else if (evalResult.matched) {
              handMatches.set(name, {
                score: evalResult.score ?? 1.0,
                data: evalResult.data,
              });
              anyStaticMatched = true;
            }
          }
        } catch (err) {
          this.emitter.emit(
            "error",
            new GestureEngineError({
              code: "RECOGNIZER_ERROR",
              message: `Erro ao executar callback do gesto customizado '${name}': ${
                (err as Error).message
              }`,
              cause: err,
              recoverable: true,
            })
          );
        }
      }

      // 3. Avalia UNKNOWN se habilitado e nenhuma pose estática foi reconhecida
      if (this.enabledGestures.has(BUILT_IN_GESTURES.UNKNOWN)) {
        if (!anyStaticMatched) {
          handMatches.set(BUILT_IN_GESTURES.UNKNOWN, { score: 1.0 });
        }
      }

      const rawMatches = new Map<GestureName, { score: number; data?: Record<string, unknown>; duration?: number }>(handMatches);
      commandMatches.set(hand.handId, rawMatches);
      // Activation can be evaluated even when excluded from diagnostic gestures.
      if (!this.enabledGestures.has(activationGesture)) handMatches.delete(activationGesture);

      // 4. Avalia gestos dinâmicos (Swipes)
      const swipeCandidate = this.swipeTracker.processPoint(
        hand.handId,
        hand.features.palmCenter,
        hand.features.handScale,
        timestamp
      );

      if (swipeCandidate && this.enabledGestures.has(swipeCandidate.gesture)) {
        rawMatches.set(swipeCandidate.gesture, { score: swipeCandidate.score, duration: swipeCandidate.duration, data: { direction: swipeCandidate.direction } });
        // Para swipes, emite detected, start e end no ciclo de confirmação
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
            distance: swipeCandidate.distance,
          },
        };

        this.emitter.emit("gesture:detected", {
          gesture: swipePayload.gesture,
          handId: swipePayload.handId,
          handedness: swipePayload.handedness,
          score: swipePayload.score,
          timestamp,
          data: swipePayload.data,
        });

        this.emitter.emit("gesture:start", swipePayload);
        this.emitter.emit("gesture:end", swipePayload);
      }

      matchesByHand.set(hand.handId, {
        handedness: hand.handedness,
        matches: handMatches,
      });
    }

    // Exclude non-enabled commands unless explicitly supplied in commandGestures.
    const allowedCommands = this.commands.getOptions().commandGestures;
    for (const raw of commandMatches.values()) {
      for (const gesture of raw.keys()) {
        if (gesture !== activationGesture && !(allowedCommands ?? allCandidateGestures).includes(gesture)) raw.delete(gesture);
      }
    }
    const commands = this.commands.process(trackingResult.updatedHands, commandMatches, timestamp,
      this.options.stabilizationTimeMs ?? 150, this.options.mirrored ?? false, true);
    this.emitter.emit("recognition:state", this.commands.getState());
    for (const command of commands) this.emitter.emit("command:detected", command);

    // Passa correspondências estáticas para estabilização temporal
    const emitted = this.stabilizer.processMatches(
      matchesByHand,
      allCandidateGestures,
      timestamp
    );

    // Despacha eventos confirmados
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
      activeGestures: this.stabilizer.getActiveGestures(),
    };
  }

  // Notifica cancelamento de todos os gestos por interrupção geral
  private cancelAllGestures(reason: GestureCancellationReason, timestamp: number): void {
    this.commands.reset();
    this.swipeTracker.clear();
    const cancelled = this.stabilizer.cancelAll(reason, timestamp);
    for (const ev of cancelled) {
      this.emitter.emit("gesture:cancelled", ev);
    }
  }
}
