import type {
  GestureCancellationReason,
  GestureCancelledEvent,
  GestureDetectedEvent,
  GestureEndEvent,
  GestureName,
  GestureStartEvent,
  GestureUpdateEvent,
  Handedness,
} from "./types.js";

interface GestureState {
  gesture: GestureName;
  handId: string;
  handedness: Handedness;
  status: "PENDING_START" | "ACTIVE" | "PENDING_END";
  firstMatchTimestamp: number;
  startTimestamp: number;
  lastMatchTimestamp: number;
  lossStartTimestamp: number;
  score: number;
  data?: Record<string, unknown>;
}

export interface EmittedGestureEvents {
  detected: GestureDetectedEvent[];
  start: GestureStartEvent[];
  update: GestureUpdateEvent[];
  end: GestureEndEvent[];
  cancelled: GestureCancelledEvent[];
}

export class GestureStabilizer {
  // Chave: `${handId}:${gesture}`
  private states: Map<string, GestureState> = new Map();
  private stabilizationTimeMs: number;
  private endGracePeriodMs: number;

  constructor(options?: { stabilizationTimeMs?: number; endGracePeriodMs?: number }) {
    this.stabilizationTimeMs = options?.stabilizationTimeMs ?? 150;
    this.endGracePeriodMs = options?.endGracePeriodMs ?? 150;
  }

  setOptions(options: { stabilizationTimeMs?: number; endGracePeriodMs?: number }): void {
    if (options.stabilizationTimeMs !== undefined) {
      this.stabilizationTimeMs = options.stabilizationTimeMs;
    }
    if (options.endGracePeriodMs !== undefined) {
      this.endGracePeriodMs = options.endGracePeriodMs;
    }
  }

  getActiveGestures(): {
    gesture: GestureName;
    handId: string;
    handedness: Handedness;
    score: number;
    duration: number;
    data?: Record<string, unknown>;
  }[] {
    const active: {
      gesture: GestureName;
      handId: string;
      handedness: Handedness;
      score: number;
      duration: number;
      data?: Record<string, unknown>;
    }[] = [];

    for (const state of this.states.values()) {
      if (state.status === "ACTIVE" || state.status === "PENDING_END") {
        active.push({
          gesture: state.gesture,
          handId: state.handId,
          handedness: state.handedness,
          score: state.score,
          duration: Math.max(0, state.lastMatchTimestamp - state.startTimestamp),
          data: state.data,
        });
      }
    }

    return active;
  }

  processMatches(
    matchesByHand: Map<
      string,
      {
        handedness: Handedness;
        matches: Map<GestureName, { score: number; data?: Record<string, unknown> }>;
      }
    >,
    allRegisteredGestures: GestureName[],
    timestamp: number
  ): EmittedGestureEvents {
    const result: EmittedGestureEvents = {
      detected: [],
      start: [],
      update: [],
      end: [],
      cancelled: [],
    };

    // Para cada mão presente na avaliação
    for (const [handId, { handedness, matches }] of matchesByHand.entries()) {
      for (const gesture of allRegisteredGestures) {
        const key = `${handId}:${gesture}`;
        const matchInfo = matches.get(gesture);
        const state = this.states.get(key);

        if (matchInfo) {
          // Gesto correspondeu no frame atual
          if (!state) {
            // Inicia PENDING_START
            if (this.stabilizationTimeMs <= 0) {
              // Imediato caso tempo de estabilização seja 0
              const newState: GestureState = {
                gesture,
                handId,
                handedness,
                status: "ACTIVE",
                firstMatchTimestamp: timestamp,
                startTimestamp: timestamp,
                lastMatchTimestamp: timestamp,
                lossStartTimestamp: 0,
                score: matchInfo.score,
                data: matchInfo.data,
              };
              this.states.set(key, newState);
              result.detected.push({
                gesture,
                handId,
                handedness,
                score: matchInfo.score,
                timestamp,
                data: matchInfo.data,
              });
              result.start.push({
                gesture,
                handId,
                handedness,
                score: matchInfo.score,
                timestamp,
                duration: 0,
                data: matchInfo.data,
              });
            } else {
              this.states.set(key, {
                gesture,
                handId,
                handedness,
                status: "PENDING_START",
                firstMatchTimestamp: timestamp,
                startTimestamp: timestamp,
                lastMatchTimestamp: timestamp,
                lossStartTimestamp: 0,
                score: matchInfo.score,
                data: matchInfo.data,
              });
            }
          } else if (state.status === "PENDING_START") {
            state.lastMatchTimestamp = timestamp;
            state.score = matchInfo.score;
            state.data = matchInfo.data;

            if (timestamp - state.firstMatchTimestamp >= this.stabilizationTimeMs) {
              // Estabilidade confirmada: transita para ACTIVE
              state.status = "ACTIVE";
              state.startTimestamp = state.firstMatchTimestamp;
              const duration = timestamp - state.startTimestamp;

              result.detected.push({
                gesture,
                handId,
                handedness,
                score: state.score,
                timestamp,
                data: state.data,
              });
              result.start.push({
                gesture,
                handId,
                handedness,
                score: state.score,
                timestamp,
                duration,
                data: state.data,
              });
            }
          } else if (state.status === "ACTIVE") {
            // Continuação de gesto ativo
            state.lastMatchTimestamp = timestamp;
            state.score = matchInfo.score;
            state.data = matchInfo.data;
            const duration = timestamp - state.startTimestamp;

            result.update.push({
              gesture,
              handId,
              handedness,
              score: state.score,
              timestamp,
              duration,
              data: state.data,
            });
          } else if (state.status === "PENDING_END") {
            // Recuperou antes do encerramento da tolerância
            state.status = "ACTIVE";
            state.lastMatchTimestamp = timestamp;
            state.score = matchInfo.score;
            state.data = matchInfo.data;
            const duration = timestamp - state.startTimestamp;

            result.update.push({
              gesture,
              handId,
              handedness,
              score: state.score,
              timestamp,
              duration,
              data: state.data,
            });
          }
        } else {
          // Gesto NÃO correspondeu no frame atual
          if (!state) {
            // Nada a fazer
          } else if (state.status === "PENDING_START") {
            // Perda durante estabilização: cancela sem emitir start
            this.states.delete(key);
          } else if (state.status === "ACTIVE") {
            // Inicia período de tolerância para encerramento
            state.status = "PENDING_END";
            state.lossStartTimestamp = timestamp;
          } else if (state.status === "PENDING_END") {
            // Verifica se a tolerância de término expirou
            if (timestamp - state.lossStartTimestamp >= this.endGracePeriodMs) {
              const duration = Math.max(0, state.lastMatchTimestamp - state.startTimestamp);
              result.end.push({
                gesture,
                handId,
                handedness,
                score: state.score,
                timestamp,
                duration,
                data: state.data,
              });
              this.states.delete(key);
            }
          }
        }
      }
    }

    return result;
  }

  cancelForHand(
    handId: string,
    reason: GestureCancellationReason,
    timestamp: number
  ): GestureCancelledEvent[] {
    const cancelled: GestureCancelledEvent[] = [];

    for (const [key, state] of this.states.entries()) {
      if (state.handId === handId) {
        if (state.status === "ACTIVE" || state.status === "PENDING_END") {
          cancelled.push({
            gesture: state.gesture,
            handId: state.handId,
            handedness: state.handedness,
            score: state.score,
            reason,
            timestamp,
            duration: Math.max(0, timestamp - state.startTimestamp),
            data: state.data,
          });
        }
        this.states.delete(key);
      }
    }

    return cancelled;
  }

  cancelGesture(
    gesture: GestureName,
    reason: GestureCancellationReason,
    timestamp: number
  ): GestureCancelledEvent[] {
    const cancelled: GestureCancelledEvent[] = [];

    for (const [key, state] of this.states.entries()) {
      if (state.gesture === gesture) {
        if (state.status === "ACTIVE" || state.status === "PENDING_END") {
          cancelled.push({
            gesture: state.gesture,
            handId: state.handId,
            handedness: state.handedness,
            score: state.score,
            reason,
            timestamp,
            duration: Math.max(0, timestamp - state.startTimestamp),
            data: state.data,
          });
        }
        this.states.delete(key);
      }
    }

    return cancelled;
  }

  cancelAll(
    reason: GestureCancellationReason,
    timestamp: number
  ): GestureCancelledEvent[] {
    const cancelled: GestureCancelledEvent[] = [];

    for (const [, state] of this.states.entries()) {
      if (state.status === "ACTIVE" || state.status === "PENDING_END") {
        cancelled.push({
          gesture: state.gesture,
          handId: state.handId,
          handedness: state.handedness,
          score: state.score,
          reason,
          timestamp,
          duration: Math.max(0, timestamp - state.startTimestamp),
          data: state.data,
        });
      }
    }

    this.states.clear();
    return cancelled;
  }
}
