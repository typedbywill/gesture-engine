import { describe, expect, it } from "vitest";
import { BUILT_IN_GESTURES, GESTURE_EVENTS, GestureEngine } from "../src/core/index.js";
import { createOpenPalm } from "./fixtures.js";

describe("Pure Node.js Core Import & Execution (No DOM)", () => {
  it("executa completamente em ambiente Node.js sem variáveis globais de DOM", async () => {
    // Garante que não há DOM presente
    expect((globalThis as any).window).toBeUndefined();
    expect((globalThis as any).document).toBeUndefined();

    // Exporta exatamente as constantes nomeadas
    expect(GESTURE_EVENTS).toBeDefined();
    expect(GESTURE_EVENTS.READY).toBe("ready");
    expect(GESTURE_EVENTS.GESTURE_DETECTED).toBe("gesture:detected");
    expect(BUILT_IN_GESTURES).toBeDefined();
    expect(BUILT_IN_GESTURES.OPEN_PALM).toBe("OPEN_PALM");
    expect(BUILT_IN_GESTURES.PINCH).toBe("PINCH");

    // Instanciação e ciclo de vida completo no Node
    const engine = new GestureEngine({
      stabilizationTimeMs: 0,
      gestures: [BUILT_IN_GESTURES.OPEN_PALM],
    });

    const events: string[] = [];
    engine.on("ready", () => events.push("ready"));
    engine.on("hand:detected", () => events.push("hand:detected"));
    engine.on("hand:tracking", () => events.push("hand:tracking"));
    engine.on("gesture:detected", () => events.push("gesture:detected"));

    await engine.init();
    await engine.start();

    expect(events).toContain("ready");

    const hand = createOpenPalm(1.0, "Right");
    const result = engine.processFrame({
      timestamp: 1000,
      hands: [hand],
    });

    expect(events).toContain("hand:detected");
    expect(events).toContain("hand:tracking");
    expect(events).toContain("gesture:detected");
    expect(result.trackedHands.length).toBe(1);
    expect(result.activeGestures[0]?.gesture).toBe("OPEN_PALM");

    await engine.stop();
    await engine.destroy();
  });
});
