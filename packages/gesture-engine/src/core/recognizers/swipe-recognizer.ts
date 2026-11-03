import { BUILT_IN_GESTURES, type BuiltInGesture, type Point2D } from "../types.js";

interface HistorySample {
  x: number;
  y: number;
  timestamp: number;
}

export interface SwipeDetectionResult {
  gesture: BuiltInGesture;
  direction: "LEFT" | "RIGHT" | "UP" | "DOWN";
  velocity: number;
  distance: number;
  duration: number;
  score: number;
}

export class SwipeTracker {
  private historyByHand: Map<string, HistorySample[]> = new Map();
  private lastSwipeTimeByHand: Map<string, number> = new Map();

  private windowMinMs = 60;
  private windowMaxMs = 400;
  private cooldownMs: number;
  private thresholdScale: number;
  private mirrored: boolean;

  constructor(options?: {
    cooldownMs?: number;
    thresholdScale?: number;
    mirrored?: boolean;
  }) {
    this.cooldownMs = options?.cooldownMs ?? 500;
    this.thresholdScale = options?.thresholdScale ?? 0.35;
    this.mirrored = options?.mirrored ?? false;
  }

  setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored;
  }

  setCooldown(cooldownMs: number): void {
    this.cooldownMs = cooldownMs;
  }

  resetHand(handId: string): void {
    this.historyByHand.delete(handId);
    this.lastSwipeTimeByHand.delete(handId);
  }

  clear(): void {
    this.historyByHand.clear();
    this.lastSwipeTimeByHand.clear();
  }

  processPoint(
    handId: string,
    palmCenter: Point2D,
    handScale: number,
    timestamp: number
  ): SwipeDetectionResult | null {
    if (isNaN(timestamp) || timestamp < 0) {
      return null;
    }

    let history = this.historyByHand.get(handId);
    if (!history) {
      history = [];
      this.historyByHand.set(handId, history);
    }

    // Validação de timestamp não-monotônico
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (timestamp <= last.timestamp) {
        // Timestamp inválido ou fora de ordem: reinicia histórico da mão
        this.historyByHand.set(handId, [{ x: palmCenter.x, y: palmCenter.y, timestamp }]);
        return null;
      }
    }

    // Cooldown após swipe anterior
    const lastSwipeTime = this.lastSwipeTimeByHand.get(handId) ?? -Infinity;
    if (timestamp - lastSwipeTime < this.cooldownMs) {
      // Em cooldown: mantém histórico limpo para não disparar em cauda de movimento
      this.historyByHand.set(handId, [{ x: palmCenter.x, y: palmCenter.y, timestamp }]);
      return null;
    }

    // Adiciona amostra atual
    history.push({ x: palmCenter.x, y: palmCenter.y, timestamp });

    // Remove amostras mais antigas que a janela máxima
    const cutoff = timestamp - this.windowMaxMs;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }

    if (history.length < 2) {
      return null;
    }

    // Procura o ponto inicial válido na janela
    const current = history[history.length - 1];
    let candidateResult: SwipeDetectionResult | null = null;

    for (let i = 0; i < history.length - 1; i++) {
      const start = history[i];
      const deltaT = current.timestamp - start.timestamp;
      if (deltaT < this.windowMinMs) continue;

      const rawDx = current.x - start.x;
      const rawDy = current.y - start.y;

      const normDx = rawDx / handScale;
      const normDy = rawDy / handScale;
      const dist = Math.hypot(normDx, normDy);

      if (dist < this.thresholdScale) {
        continue;
      }

      const velocity = dist / (deltaT / 1000); // deslocamento normalizado por segundo

      const absDx = Math.abs(normDx);
      const absDy = Math.abs(normDy);

      let gesture: BuiltInGesture | null = null;
      let direction: "LEFT" | "RIGHT" | "UP" | "DOWN" | null = null;

      if (absDx > absDy * 1.25) {
        // Movimento predominantemente horizontal
        if (normDx < 0) {
          // Para a esquerda na imagem bruta
          if (this.mirrored) {
            gesture = BUILT_IN_GESTURES.SWIPE_RIGHT;
            direction = "RIGHT";
          } else {
            gesture = BUILT_IN_GESTURES.SWIPE_LEFT;
            direction = "LEFT";
          }
        } else {
          // Para a direita na imagem bruta
          if (this.mirrored) {
            gesture = BUILT_IN_GESTURES.SWIPE_LEFT;
            direction = "LEFT";
          } else {
            gesture = BUILT_IN_GESTURES.SWIPE_RIGHT;
            direction = "RIGHT";
          }
        }
      } else if (absDy > absDx * 1.25) {
        // Movimento predominantemente vertical (Y cresce para baixo)
        if (normDy < 0) {
          gesture = BUILT_IN_GESTURES.SWIPE_UP;
          direction = "UP";
        } else {
          gesture = BUILT_IN_GESTURES.SWIPE_DOWN;
          direction = "DOWN";
        }
      }

      if (gesture && direction) {
        const score = Math.min(1, Math.max(0.5, velocity / 3.0));
        candidateResult = {
          gesture,
          direction,
          velocity,
          distance: dist,
          duration: deltaT,
          score,
        };
        break;
      }
    }

    if (candidateResult) {
      // Confirmação do swipe: registra timestamp de cooldown e limpa histórico da mão
      this.lastSwipeTimeByHand.set(handId, timestamp);
      this.historyByHand.set(handId, [{ x: palmCenter.x, y: palmCenter.y, timestamp }]);
      return candidateResult;
    }

    return null;
  }
}
