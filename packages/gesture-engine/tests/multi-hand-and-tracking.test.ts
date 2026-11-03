import { describe, expect, it } from "vitest";
import { GestureEngine } from "../src/core/engine.js";
import { BUILT_IN_GESTURES } from "../src/core/types.js";
import { createClosedFist, createOpenPalm, createSyntheticHand } from "./fixtures.js";

describe("Multi-hand Tracking & Spatial Association", () => {
  it("rastreia até duas mãos simultâneas com IDs estáveis e estados independentes", async () => {
    const engine = new GestureEngine({
      maxHands: 2,
      stabilizationTimeMs: 0,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM, BUILT_IN_GESTURES.CLOSED_FIST],
    });
    await engine.init();
    await engine.start();

    const handDetectedEvents: any[] = [];
    const gestureDetectedEvents: any[] = [];

    engine.on("hand:detected", (e) => handDetectedEvents.push(e));
    engine.on("gesture:detected", (e) => gestureDetectedEvents.push(e));

    // Mão esquerda com punho fechado, mão direita com palma aberta
    const leftHand = createClosedFist(1.0, "Left");
    leftHand.landmarks[0] = { x: 0.2, y: 0.7, z: 0 }; // Lado esquerdo

    const rightHand = createOpenPalm(1.0, "Right");
    rightHand.landmarks[0] = { x: 0.8, y: 0.7, z: 0 }; // Lado direito

    const result = engine.processFrame({
      timestamp: 100,
      hands: [leftHand, rightHand],
    });

    expect(result.trackedHands.length).toBe(2);
    expect(handDetectedEvents.length).toBe(2);

    const leftTracked = result.trackedHands.find((h) => h.handedness === "Left")!;
    const rightTracked = result.trackedHands.find((h) => h.handedness === "Right")!;

    expect(leftTracked).toBeDefined();
    expect(rightTracked).toBeDefined();
    expect(leftTracked.handId).not.toBe(rightTracked.handId);

    // Gestos independentes por mão
    const leftGesture = result.activeGestures.find((g) => g.handId === leftTracked.handId);
    const rightGesture = result.activeGestures.find((g) => g.handId === rightTracked.handId);

    expect(leftGesture?.gesture).toBe(BUILT_IN_GESTURES.CLOSED_FIST);
    expect(rightGesture?.gesture).toBe(BUILT_IN_GESTURES.OPEN_PALM);
  });

  it("mantém IDs estáveis mesmo com reordenação do array de entrada", async () => {
    const engine = new GestureEngine({ maxHands: 2 });
    await engine.init();
    await engine.start();

    const hand1 = createSyntheticHand({ center: { x: 0.2, y: 0.5 }, handedness: "Left" });
    const hand2 = createSyntheticHand({ center: { x: 0.8, y: 0.5 }, handedness: "Right" });

    // Frame 1: [hand1, hand2]
    const res1 = engine.processFrame({ timestamp: 100, hands: [hand1, hand2] });
    const idLeft1 = res1.trackedHands.find((h) => h.handedness === "Left")!.handId;
    const idRight1 = res1.trackedHands.find((h) => h.handedness === "Right")!.handId;

    // Frame 2: ordem invertida [hand2, hand1]
    const res2 = engine.processFrame({ timestamp: 150, hands: [hand2, hand1] });
    const idLeft2 = res2.trackedHands.find((h) => h.handedness === "Left")!.handId;
    const idRight2 = res2.trackedHands.find((h) => h.handedness === "Right")!.handId;

    expect(idLeft2).toBe(idLeft1);
    expect(idRight2).toBe(idRight1);
  });

  it("retem a mão em perda temporária de tracking e emite hand:lost após tolerância", async () => {
    const engine = new GestureEngine({
      absenceTimeoutMs: 200,
      stabilizationTimeMs: 0,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM],
    });
    await engine.init();
    await engine.start();

    const handLostEvents: any[] = [];
    const gestureCancelledEvents: any[] = [];

    engine.on("hand:lost", (e) => handLostEvents.push(e));
    engine.on("gesture:cancelled", (e) => gestureCancelledEvents.push(e));

    const hand = createOpenPalm(1.0, "Right");

    // Frame 100ms: mão detectada
    engine.processFrame({ timestamp: 100, hands: [hand] });

    // Frame 200ms (100ms sem ver a mão < 200ms tolerância): retenção temporária
    engine.processFrame({ timestamp: 200, hands: [] });
    expect(handLostEvents.length).toBe(0);
    expect(gestureCancelledEvents.length).toBe(0);

    // Frame 350ms (250ms sem ver a mão >= 200ms tolerância): perda definitiva
    engine.processFrame({ timestamp: 350, hands: [] });
    expect(handLostEvents.length).toBe(1);
    expect(gestureCancelledEvents.length).toBe(1);
    expect(gestureCancelledEvents[0].reason).toBe("hand_lost");
  });
});
