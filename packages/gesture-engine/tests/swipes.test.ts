import { describe, expect, it } from "vitest";
import { GestureEngine } from "../src/core/engine.js";
import { BUILT_IN_GESTURES } from "../src/core/types.js";
import { createSyntheticHand } from "./fixtures.js";

describe("Dynamic Swipes Detection", () => {
  it("detecta swipe para a esquerda (SWIPE_LEFT)", async () => {
    const engine = new GestureEngine({
      gestures: [BUILT_IN_GESTURES.SWIPE_LEFT],
      mirrored: false,
    });
    await engine.init();
    await engine.start();

    const detected: any[] = [];
    const started: any[] = [];
    const ended: any[] = [];

    engine.on("gesture:detected", (e) => detected.push(e));
    engine.on("gesture:start", (e) => started.push(e));
    engine.on("gesture:end", (e) => ended.push(e));

    // Palma se desloca da direita (X=0.8) para a esquerda (X=0.2)
    engine.processFrame({
      timestamp: 100,
      hands: [createSyntheticHand({ center: { x: 0.8, y: 0.5 }, scale: 1.0 })],
    });
    engine.processFrame({
      timestamp: 160,
      hands: [createSyntheticHand({ center: { x: 0.5, y: 0.5 }, scale: 1.0 })],
    });
    engine.processFrame({
      timestamp: 220,
      hands: [createSyntheticHand({ center: { x: 0.2, y: 0.5 }, scale: 1.0 })],
    });

    expect(detected.length).toBe(1);
    expect(detected[0].gesture).toBe(BUILT_IN_GESTURES.SWIPE_LEFT);
    expect(started.length).toBe(1);
    expect(ended.length).toBe(1);
    expect(ended[0].data.direction).toBe("LEFT");
  });

  it("detecta swipe para a direita (SWIPE_RIGHT)", async () => {
    const engine = new GestureEngine({
      gestures: [BUILT_IN_GESTURES.SWIPE_RIGHT],
      mirrored: false,
    });
    await engine.init();
    await engine.start();

    const detected: any[] = [];
    engine.on("gesture:detected", (e) => detected.push(e));

    engine.processFrame({
      timestamp: 100,
      hands: [createSyntheticHand({ center: { x: 0.2, y: 0.5 }, scale: 1.0 })],
    });
    engine.processFrame({
      timestamp: 220,
      hands: [createSyntheticHand({ center: { x: 0.8, y: 0.5 }, scale: 1.0 })],
    });

    expect(detected.length).toBe(1);
    expect(detected[0].gesture).toBe(BUILT_IN_GESTURES.SWIPE_RIGHT);
  });

  it("detecta swipe para cima (SWIPE_UP) e para baixo (SWIPE_DOWN)", async () => {
    // SWIPE_UP: Y diminui (sobe na tela)
    const engineUp = new GestureEngine({ gestures: [BUILT_IN_GESTURES.SWIPE_UP] });
    await engineUp.init();
    await engineUp.start();

    const detectedUp: any[] = [];
    engineUp.on("gesture:detected", (e) => detectedUp.push(e));

    engineUp.processFrame({
      timestamp: 100,
      hands: [createSyntheticHand({ center: { x: 0.5, y: 0.8 }, scale: 1.0 })],
    });
    engineUp.processFrame({
      timestamp: 220,
      hands: [createSyntheticHand({ center: { x: 0.5, y: 0.2 }, scale: 1.0 })],
    });

    expect(detectedUp.length).toBe(1);
    expect(detectedUp[0].gesture).toBe(BUILT_IN_GESTURES.SWIPE_UP);

    // SWIPE_DOWN: Y aumenta (desce na tela)
    const engineDown = new GestureEngine({ gestures: [BUILT_IN_GESTURES.SWIPE_DOWN] });
    await engineDown.init();
    await engineDown.start();

    const detectedDown: any[] = [];
    engineDown.on("gesture:detected", (e) => detectedDown.push(e));

    engineDown.processFrame({
      timestamp: 100,
      hands: [createSyntheticHand({ center: { x: 0.5, y: 0.2 }, scale: 1.0 })],
    });
    engineDown.processFrame({
      timestamp: 220,
      hands: [createSyntheticHand({ center: { x: 0.5, y: 0.8 }, scale: 1.0 })],
    });

    expect(detectedDown.length).toBe(1);
    expect(detectedDown[0].gesture).toBe(BUILT_IN_GESTURES.SWIPE_DOWN);
  });

  it("ignora movimento insuficiente abaixo do threshold", async () => {
    const engine = new GestureEngine({
      gestures: [BUILT_IN_GESTURES.SWIPE_LEFT, BUILT_IN_GESTURES.SWIPE_RIGHT],
    });
    await engine.init();
    await engine.start();

    const detected: any[] = [];
    engine.on("gesture:detected", (e) => detected.push(e));

    // Pequena oscilação de 0.02 (muito abaixo do threshold da escala da mão)
    engine.processFrame({
      timestamp: 100,
      hands: [createSyntheticHand({ center: { x: 0.5, y: 0.5 }, scale: 1.0 })],
    });
    engine.processFrame({
      timestamp: 200,
      hands: [createSyntheticHand({ center: { x: 0.52, y: 0.5 }, scale: 1.0 })],
    });

    expect(detected.length).toBe(0);
  });

  it("respeita o cooldown de 500ms entre swipes sucessivos na mesma mão", async () => {
    const engine = new GestureEngine({
      swipeCooldownMs: 500,
      gestures: [BUILT_IN_GESTURES.SWIPE_LEFT, BUILT_IN_GESTURES.SWIPE_RIGHT],
    });
    await engine.init();
    await engine.start();

    const detected: any[] = [];
    engine.on("gesture:detected", (e) => detected.push(e));

    // Primeiro swipe no t=200ms
    engine.processFrame({
      timestamp: 100,
      hands: [createSyntheticHand({ center: { x: 0.8, y: 0.5 }, scale: 1.0 })],
    });
    engine.processFrame({
      timestamp: 200,
      hands: [createSyntheticHand({ center: { x: 0.2, y: 0.5 }, scale: 1.0 })],
    });
    expect(detected.length).toBe(1);

    // Tentativa de segundo swipe imediato em t=350ms (apenas 150ms depois, < 500ms cooldown)
    engine.processFrame({
      timestamp: 250,
      hands: [createSyntheticHand({ center: { x: 0.2, y: 0.5 }, scale: 1.0 })],
    });
    engine.processFrame({
      timestamp: 350,
      hands: [createSyntheticHand({ center: { x: 0.8, y: 0.5 }, scale: 1.0 })],
    });
    expect(detected.length).toBe(1); // Não disparou novo swipe devido ao cooldown

    // Tentativa após o cooldown expirar (t=800ms, > 500ms após t=200ms)
    engine.processFrame({
      timestamp: 750,
      hands: [createSyntheticHand({ center: { x: 0.2, y: 0.5 }, scale: 1.0 })],
    });
    engine.processFrame({
      timestamp: 850,
      hands: [createSyntheticHand({ center: { x: 0.8, y: 0.5 }, scale: 1.0 })],
    });
    expect(detected.length).toBe(2);
  });

  it("inverte a direção horizontal quando mirrored: true", async () => {
    const engine = new GestureEngine({
      gestures: [BUILT_IN_GESTURES.SWIPE_LEFT, BUILT_IN_GESTURES.SWIPE_RIGHT],
      mirrored: true,
    });
    await engine.init();
    await engine.start();

    const detected: any[] = [];
    engine.on("gesture:detected", (e) => detected.push(e));

    // Movimento para a esquerda na imagem (X=0.8 para X=0.2)
    // Com espelhamento, deve corresponder a SWIPE_RIGHT visual
    engine.processFrame({
      timestamp: 100,
      hands: [createSyntheticHand({ center: { x: 0.8, y: 0.5 }, scale: 1.0 })],
    });
    engine.processFrame({
      timestamp: 220,
      hands: [createSyntheticHand({ center: { x: 0.2, y: 0.5 }, scale: 1.0 })],
    });

    expect(detected.length).toBe(1);
    expect(detected[0].gesture).toBe(BUILT_IN_GESTURES.SWIPE_RIGHT);
  });

  it("trata timestamps não-monotônicos ou inválidos sem quebrar o motor", async () => {
    const engine = new GestureEngine({
      gestures: [BUILT_IN_GESTURES.SWIPE_LEFT, BUILT_IN_GESTURES.SWIPE_RIGHT],
    });
    await engine.init();
    await engine.start();

    const detected: any[] = [];
    engine.on("gesture:detected", (e) => detected.push(e));

    engine.processFrame({
      timestamp: 500,
      hands: [createSyntheticHand({ center: { x: 0.5, y: 0.5 }, scale: 1.0 })],
    });

    // Frame com timestamp regressivo
    engine.processFrame({
      timestamp: 400,
      hands: [createSyntheticHand({ center: { x: 0.2, y: 0.5 }, scale: 1.0 })],
    });

    expect(detected.length).toBe(0);
  });
});
