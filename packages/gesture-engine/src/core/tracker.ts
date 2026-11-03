import { extractHandFeatures } from "./features.js";
import type {
  DerivedHandFeatures,
  FrameHistoryEntry,
  HandInput,
  Handedness,
  Landmark3D,
  Point2D,
  TrackedHand,
} from "./types.js";

interface InternalTrackedHand {
  handId: string;
  handedness: Handedness;
  landmarks: Landmark3D[];
  worldLandmarks?: Landmark3D[];
  features: DerivedHandFeatures;
  confidence: number;
  lastSeenTimestamp: number;
  firstSeenTimestamp: number;
  history: FrameHistoryEntry[];
}

export interface TrackingUpdateResult {
  updatedHands: TrackedHand[];
  detectedHands: TrackedHand[];
  lostHands: { handId: string; handedness: Handedness }[];
  trackedHands: TrackedHand[];
}

export class HandTracker {
  private activeHands: Map<string, InternalTrackedHand> = new Map();
  private maxHands: number;
  private absenceTimeoutMs: number;
  private nextHandIdCounter = 0;
  private maxHistoryLength = 20;

  constructor(options?: { maxHands?: number; absenceTimeoutMs?: number }) {
    this.maxHands = options?.maxHands ?? 2;
    this.absenceTimeoutMs = options?.absenceTimeoutMs ?? 250;
  }

  setOptions(options: { maxHands?: number; absenceTimeoutMs?: number }): void {
    if (options.maxHands !== undefined) this.maxHands = options.maxHands;
    if (options.absenceTimeoutMs !== undefined) this.absenceTimeoutMs = options.absenceTimeoutMs;
  }

  getTrackedHands(): TrackedHand[] {
    return Array.from(this.activeHands.values()).map((h) => this.toPublicTrackedHand(h));
  }

  getHand(handId: string): TrackedHand | undefined {
    const h = this.activeHands.get(handId);
    return h ? this.toPublicTrackedHand(h) : undefined;
  }

  getHandHistory(handId: string): FrameHistoryEntry[] {
    return this.activeHands.get(handId)?.history ?? [];
  }

  clear(): { handId: string; handedness: Handedness }[] {
    const lost = Array.from(this.activeHands.values()).map((h) => ({
      handId: h.handId,
      handedness: h.handedness,
    }));
    this.activeHands.clear();
    return lost;
  }

  removeHand(handId: string): { handId: string; handedness: Handedness } | null {
    const hand = this.activeHands.get(handId);
    if (!hand) return null;
    this.activeHands.delete(handId);
    return { handId: hand.handId, handedness: hand.handedness };
  }

  update(rawHands: HandInput[], timestamp: number): TrackingUpdateResult {
    const detectedHands: TrackedHand[] = [];
    const updatedHands: TrackedHand[] = [];
    const lostHands: { handId: string; handedness: Handedness }[] = [];

    // Limita entrada ao maxHands
    const inputs = rawHands.slice(0, this.maxHands);

    // Extrai features dos inputs
    const parsedInputs = inputs.map((input) => {
      const features = extractHandFeatures(input.landmarks, input.handedness);
      const confidence = input.confidence ?? input.score ?? 0.9;
      return {
        landmarks: input.landmarks,
        worldLandmarks: input.worldLandmarks,
        handedness: input.handedness,
        features,
        confidence,
        palmCenter: features.palmCenter,
      };
    });

    const existingHands = Array.from(this.activeHands.values());
    const matchedExistingIds = new Set<string>();
    const matchedInputIndices = new Set<number>();

    // Matriz de custo para associação espacial e por handedness
    interface MatchCandidate {
      inputIndex: number;
      handId: string;
      cost: number;
    }

    const candidates: MatchCandidate[] = [];

    for (let i = 0; i < parsedInputs.length; i++) {
      const inp = parsedInputs[i];
      for (const ex of existingHands) {
        const dx = inp.palmCenter.x - ex.features.palmCenter.x;
        const dy = inp.palmCenter.y - ex.features.palmCenter.y;
        const spatialDist = Math.hypot(dx, dy);

        // Penalidade alta para handedness divergente
        const handednessPenalty = inp.handedness === ex.handedness ? 0 : 0.8;
        const cost = spatialDist + handednessPenalty;

        // Limiar aceitável de correspondência (distância máxima ~0.45 da tela)
        if (cost < 0.65) {
          candidates.push({ inputIndex: i, handId: ex.handId, cost });
        }
      }
    }

    // Ordena do menor custo para o maior (greedy matching)
    candidates.sort((a, b) => a.cost - b.cost);

    for (const c of candidates) {
      if (matchedInputIndices.has(c.inputIndex) || matchedExistingIds.has(c.handId)) {
        continue;
      }
      matchedInputIndices.add(c.inputIndex);
      matchedExistingIds.add(c.handId);

      // Atualiza mão existente
      const inp = parsedInputs[c.inputIndex];
      const ex = this.activeHands.get(c.handId)!;

      ex.landmarks = inp.landmarks;
      ex.worldLandmarks = inp.worldLandmarks;
      ex.features = inp.features;
      ex.handedness = inp.handedness;
      ex.confidence = inp.confidence;
      ex.lastSeenTimestamp = timestamp;

      ex.history.push({
        timestamp,
        palmCenter: inp.palmCenter,
        features: inp.features,
      });
      if (ex.history.length > this.maxHistoryLength) {
        ex.history.shift();
      }

      const pub = this.toPublicTrackedHand(ex);
      updatedHands.push(pub);
    }

    // Processa mãos de entrada não pareadas (novas mãos)
    for (let i = 0; i < parsedInputs.length; i++) {
      if (matchedInputIndices.has(i)) continue;
      if (this.activeHands.size >= this.maxHands) continue;

      const inp = parsedInputs[i];
      const newHandId = `hand_${this.nextHandIdCounter++}`;

      const newHand: InternalTrackedHand = {
        handId: newHandId,
        handedness: inp.handedness,
        landmarks: inp.landmarks,
        worldLandmarks: inp.worldLandmarks,
        features: inp.features,
        confidence: inp.confidence,
        firstSeenTimestamp: timestamp,
        lastSeenTimestamp: timestamp,
        history: [
          {
            timestamp,
            palmCenter: inp.palmCenter,
            features: inp.features,
          },
        ],
      };

      this.activeHands.set(newHandId, newHand);
      const pub = this.toPublicTrackedHand(newHand);
      detectedHands.push(pub);
      updatedHands.push(pub);
    }

    // Verifica mãos existentes que não foram vistas neste frame
    for (const ex of existingHands) {
      if (!matchedExistingIds.has(ex.handId)) {
        const timeSinceLastSeen = timestamp - ex.lastSeenTimestamp;
        if (timeSinceLastSeen > this.absenceTimeoutMs) {
          // Excedeu a tolerância de ausência: mão perdida
          this.activeHands.delete(ex.handId);
          lostHands.push({ handId: ex.handId, handedness: ex.handedness });
        }
      }
    }

    const trackedHands = Array.from(this.activeHands.values()).map((h) =>
      this.toPublicTrackedHand(h)
    );

    return {
      updatedHands,
      detectedHands,
      lostHands,
      trackedHands,
    };
  }

  private toPublicTrackedHand(internal: InternalTrackedHand): TrackedHand {
    return {
      handId: internal.handId,
      handedness: internal.handedness,
      landmarks: internal.landmarks,
      worldLandmarks: internal.worldLandmarks,
      features: internal.features,
      confidence: internal.confidence,
      lastSeenTimestamp: internal.lastSeenTimestamp,
      firstSeenTimestamp: internal.firstSeenTimestamp,
    };
  }
}
