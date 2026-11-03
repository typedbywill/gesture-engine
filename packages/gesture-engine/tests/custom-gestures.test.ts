import { describe, expect, it } from "vitest";
import { GestureEngine } from "../src/core/engine.js";
import { BUILT_IN_GESTURES, GestureEngineError } from "../src/core/types.js";
import { createOpenPalm, createSyntheticHand } from "./fixtures.js";

describe("Custom Gestures Registration and Execution", () => {
  it("registra um gesto customizado e o reconhece com ciclo de estabilização", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 100,
    });
    await engine.init();
    await engine.start();

    // Gesto customizado "I_LOVE_YOU": polegar, indicador e mínimo estendidos
    engine.registerGesture({
      name: "I_LOVE_YOU",
      recognize: (ctx) => {
        const f = ctx.features.fingers;
        const matched =
          f.thumb.extended &&
          f.index.extended &&
          f.pinky.extended &&
          !f.middle.extended &&
          !f.ring.extended;

        return {
          matched,
          score: 0.95,
          data: { customField: "love_sign" },
        };
      },
    });

    const detected: any[] = [];
    const started: any[] = [];
    engine.on("gesture:detected", (e) => detected.push(e));
    engine.on("gesture:start", (e) => started.push(e));

    const ilyHand = createSyntheticHand({
      thumbExtended: true,
      indexExtended: true,
      pinkyExtended: true,
      middleExtended: false,
      ringExtended: false,
    });

    // Frame 0ms
    engine.processFrame({ timestamp: 0, hands: [ilyHand] });
    expect(detected.length).toBe(0);

    // Frame 120ms (estabilizado > 100ms)
    engine.processFrame({ timestamp: 120, hands: [ilyHand] });
    const detectedGestures = detected.map((e) => e.gesture);
    expect(detectedGestures).toContain("I_LOVE_YOU");
    const ilyEvent = detected.find((e) => e.gesture === "I_LOVE_YOU");
    expect(ilyEvent?.data?.customField).toBe("love_sign");
    expect(started.some((e) => e.gesture === "I_LOVE_YOU")).toBe(true);
  });

  it("rejeita nomes duplicados de gestos com GestureEngineError", async () => {
    const engine = new GestureEngine();

    // Tentar registrar com nome de gesto embutido
    expect(() => {
      engine.registerGesture({
        name: BUILT_IN_GESTURES.OPEN_PALM,
        recognize: () => true,
      });
    }).toThrowError(GestureEngineError);

    // Tentar registrar nome customizado duas vezes
    engine.registerGesture({
      name: "MY_GESTURE",
      recognize: () => true,
    });

    expect(() => {
      engine.registerGesture({
        name: "MY_GESTURE",
        recognize: () => true,
      });
    }).toThrowError(GestureEngineError);
  });

  it("remove gesto customizado e cancela ativações com recognizer_unregistered", async () => {
    const engine = new GestureEngine({ stabilizationTimeMs: 0 });
    await engine.init();
    await engine.start();

    engine.registerGesture({
      name: "TEMPORARY_GESTURE",
      recognize: () => true,
    });

    const cancelled: any[] = [];
    engine.on("gesture:cancelled", (e) => cancelled.push(e));

    const hand = createOpenPalm(1.0, "Right");
    engine.processFrame({ timestamp: 100, hands: [hand] });

    const unregistered = engine.unregisterGesture("TEMPORARY_GESTURE");
    expect(unregistered).toBe(true);

    expect(cancelled.length).toBe(1);
    expect(cancelled[0].gesture).toBe("TEMPORARY_GESTURE");
    expect(cancelled[0].reason).toBe("recognizer_unregistered");

    // Desregistrar nome não existente retorna false
    expect(engine.unregisterGesture("NON_EXISTING")).toBe(false);
  });

  it("captura erros em callbacks customizados sem quebrar o motor", async () => {
    const engine = new GestureEngine({ stabilizationTimeMs: 0 });
    await engine.init();
    await engine.start();

    const errors: any[] = [];
    engine.on("error", (err) => errors.push(err));

    engine.registerGesture({
      name: "FAULTY_GESTURE",
      recognize: () => {
        throw new Error("Falha intencional de teste no callback");
      },
    });

    const hand = createOpenPalm(1.0, "Right");
    const result = engine.processFrame({ timestamp: 100, hands: [hand] });

    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe("RECOGNIZER_ERROR");
    // Motor continua funcionando normalmente e reconhece outros gestos
    expect(result.activeGestures.some((g) => g.gesture === BUILT_IN_GESTURES.OPEN_PALM)).toBe(true);
  });
});
