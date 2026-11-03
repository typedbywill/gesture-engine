import { describe, expect, it } from "vitest";
import { GestureEngine } from "../src/core/engine.js";
import { BUILT_IN_GESTURES } from "../src/core/types.js";
import { createClosedFist, createNumberTwo, createOpenPalm, createVictory } from "./fixtures.js";

describe("Simultaneous Gestures and Temporal Lifecycle", () => {
  it("permite poses simultâneas como NUMBER_TWO e VICTORY ativas juntas", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 0,
      gestures: [BUILT_IN_GESTURES.NUMBER_TWO, BUILT_IN_GESTURES.VICTORY],
    });
    await engine.init();
    await engine.start();

    const activeDetected: string[] = [];
    engine.on("gesture:detected", ({ gesture }) => {
      activeDetected.push(gesture);
    });

    // Mão com indicador e médio em V (satisfaz tanto NUMBER_TWO quanto VICTORY)
    const hand = createVictory(1.0, "Right");
    const result = engine.processFrame({
      timestamp: 100,
      hands: [hand],
    });

    expect(activeDetected).toContain(BUILT_IN_GESTURES.NUMBER_TWO);
    expect(activeDetected).toContain(BUILT_IN_GESTURES.VICTORY);

    const activeNames = result.activeGestures.map((g) => g.gesture);
    expect(activeNames).toContain(BUILT_IN_GESTURES.NUMBER_TWO);
    expect(activeNames).toContain(BUILT_IN_GESTURES.VICTORY);
  });

  it("respeita a janela de estabilização de 150ms antes de confirmar", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 150,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM],
    });
    await engine.init();
    await engine.start();

    const detectedEvents: any[] = [];
    const startEvents: any[] = [];
    const updateEvents: any[] = [];

    engine.on("gesture:detected", (e) => detectedEvents.push(e));
    engine.on("gesture:start", (e) => startEvents.push(e));
    engine.on("gesture:update", (e) => updateEvents.push(e));

    const hand = createOpenPalm(1.0, "Right");

    // Frame 0ms: inicia pendência
    engine.processFrame({ timestamp: 0, hands: [hand] });
    expect(detectedEvents.length).toBe(0);
    expect(startEvents.length).toBe(0);

    // Frame 100ms (< 150ms): ainda não deve confirmar
    engine.processFrame({ timestamp: 100, hands: [hand] });
    expect(detectedEvents.length).toBe(0);
    expect(startEvents.length).toBe(0);

    // Frame 150ms: confirmação da estabilidade
    engine.processFrame({ timestamp: 150, hands: [hand] });
    expect(detectedEvents.length).toBe(1);
    expect(startEvents.length).toBe(1);
    expect(startEvents[0].gesture).toBe(BUILT_IN_GESTURES.OPEN_PALM);

    // Próximos frames: emite updates e NÃO repete detected/start
    engine.processFrame({ timestamp: 200, hands: [hand] });
    expect(detectedEvents.length).toBe(1);
    expect(startEvents.length).toBe(1);
    expect(updateEvents.length).toBe(1);
    expect(updateEvents[0].duration).toBe(200);
  });

  it("encerra o gesto após 150ms de tolerância sem correspondência", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 100,
      endGracePeriodMs: 150,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM, BUILT_IN_GESTURES.CLOSED_FIST],
    });
    await engine.init();
    await engine.start();

    const endEvents: any[] = [];
    engine.on("gesture:end", (e) => endEvents.push(e));

    const palm = createOpenPalm(1.0, "Right");
    const fist = createClosedFist(1.0, "Right");

    // Ativa OPEN_PALM
    engine.processFrame({ timestamp: 0, hands: [palm] });
    engine.processFrame({ timestamp: 120, hands: [palm] });

    // Muda para punho fechado (OPEN_PALM perde correspondência)
    // Frame 150ms: primeira ausência do OPEN_PALM
    engine.processFrame({ timestamp: 150, hands: [fist] });
    expect(endEvents.length).toBe(0); // Ainda em período de tolerância (150ms)

    // Frame 250ms (100ms sem correspondência < 150ms tolerância)
    engine.processFrame({ timestamp: 250, hands: [fist] });
    expect(endEvents.length).toBe(0);

    // Frame 310ms (160ms sem correspondência >= 150ms tolerância)
    engine.processFrame({ timestamp: 310, hands: [fist] });
    expect(endEvents.length).toBe(1);
    expect(endEvents[0].gesture).toBe(BUILT_IN_GESTURES.OPEN_PALM);
  });

  it("recupera da perda temporária se corresponder novamente antes da tolerância expirar", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 50,
      endGracePeriodMs: 150,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM],
    });
    await engine.init();
    await engine.start();

    const endEvents: any[] = [];
    const updateEvents: any[] = [];
    engine.on("gesture:end", (e) => endEvents.push(e));
    engine.on("gesture:update", (e) => updateEvents.push(e));

    const palm = createOpenPalm(1.0, "Right");
    const fist = createClosedFist(1.0, "Right");

    // Ativa
    engine.processFrame({ timestamp: 0, hands: [palm] });
    engine.processFrame({ timestamp: 60, hands: [palm] });

    // Falha pontual de detecção (ex: 80ms depois)
    engine.processFrame({ timestamp: 100, hands: [fist] });
    expect(endEvents.length).toBe(0);

    // Volta a corresponder no frame 180ms (80ms de perda < 150ms tolerância)
    engine.processFrame({ timestamp: 180, hands: [palm] });
    expect(endEvents.length).toBe(0);
    expect(updateEvents.length).toBeGreaterThan(0);
  });

  it("emite gesture:cancelled com motivo recognition_paused em stopRecognition()", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 0,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM],
    });
    await engine.init();
    await engine.start();

    const cancelledEvents: any[] = [];
    engine.on("gesture:cancelled", (e) => cancelledEvents.push(e));

    const palm = createOpenPalm(1.0, "Right");
    engine.processFrame({ timestamp: 100, hands: [palm] });

    engine.stopRecognition();

    expect(cancelledEvents.length).toBe(1);
    expect(cancelledEvents[0].reason).toBe("recognition_paused");
    expect(cancelledEvents[0].gesture).toBe(BUILT_IN_GESTURES.OPEN_PALM);
  });

  it("emite gesture:cancelled com motivo engine_stopped em stop()", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 0,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM],
    });
    await engine.init();
    await engine.start();

    const cancelledEvents: any[] = [];
    engine.on("gesture:cancelled", (e) => cancelledEvents.push(e));

    const palm = createOpenPalm(1.0, "Right");
    engine.processFrame({ timestamp: 100, hands: [palm] });

    await engine.stop();

    expect(cancelledEvents.length).toBe(1);
    expect(cancelledEvents[0].reason).toBe("engine_stopped");
  });

  it("emite gesture:cancelled com motivo engine_destroyed em destroy()", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 0,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM],
    });
    await engine.init();
    await engine.start();

    const cancelledEvents: any[] = [];
    engine.on("gesture:cancelled", (e) => cancelledEvents.push(e));

    const palm = createOpenPalm(1.0, "Right");
    engine.processFrame({ timestamp: 100, hands: [palm] });

    await engine.destroy();

    expect(cancelledEvents.length).toBe(1);
    expect(cancelledEvents[0].reason).toBe("engine_destroyed");
  });

  it("operações repetidas de start() e stop() são idempotentes", async () => {
    const engine = new GestureEngine();
    await engine.init();
    await engine.start();
    await engine.start(); // idempotente

    expect(engine.getState()).toBe("RUNNING");

    await engine.stop();
    await engine.stop(); // idempotente

    expect(engine.getState()).toBe("STOPPED");
  });
});
