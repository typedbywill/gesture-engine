import { describe, expect, it, vi } from "vitest";
import { LandmarkDrawer } from "../../../apps/playground/src/drawer.js";
import { createOpenPalm } from "../../../apps/playground/src/synthetic-hands.js";
import { extractHandFeatures } from "../src/core/features.js";
import type { HandTrackingEvent } from "../src/core/types.js";

function setup() {
  const ctx = {
    setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(),
    fill: vi.fn(), roundRect: vi.fn(), fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 80 })),
  };
  const canvas = { width: 300, height: 150, getContext: () => ctx };
  const drawer = new LandmarkDrawer(canvas as unknown as HTMLCanvasElement);
  const input = createOpenPalm();
  // Referência fora do centro para verificar recorte e espelhamento.
  input.landmarks[0] = { x: 0.2, y: 0.7, z: 0 };
  const hand: HandTrackingEvent = {
    ...input, handId: "hand_0", timestamp: 100, confidence: 1,
    features: extractHandFeatures(input.landmarks, input.handedness),
  };
  return { ctx, canvas, drawer, hand };
}

describe("Projeção do esqueleto no playground", () => {
  it("acompanha o recorte vertical de uma câmera 4:3 em viewport 16:9", () => {
    const { drawer, ctx, hand } = setup();
    drawer.resize(1600, 900, 1);
    drawer.drawHands([hand], false, { width: 640, height: 480 });
    expect(ctx.arc).toHaveBeenNthCalledWith(1, 320, 690, 4, 0, Math.PI * 2);
    const palm = hand.features.palmCenter;
    expect(ctx.arc).toHaveBeenLastCalledWith(palm.x * 1600, palm.y * 1200 - 150, 7, 0, Math.PI * 2);
  });

  it("espelha após o recorte horizontal de um vídeo em viewport quadrado", () => {
    const { drawer, ctx, hand } = setup();
    drawer.resize(600, 600, 1);
    drawer.drawHands([hand], true, { width: 1200, height: 600 });
    expect(ctx.arc).toHaveBeenNthCalledWith(1, 660, 420, 4, 0, Math.PI * 2);
  });

  it("usa pixels CSS para a geometria e buffer físico para telas de alta densidade", () => {
    const { drawer, ctx, canvas, hand } = setup();
    drawer.resize(800, 450, 2);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
    drawer.drawHands([hand], false);
    expect(ctx.clearRect).toHaveBeenLastCalledWith(0, 0, 800, 450);
    expect(ctx.arc).toHaveBeenNthCalledWith(1, 160, 315, 4, 0, Math.PI * 2);
  });

  it("desenha as duas mãos em uma única limpeza e ignora coordenadas inválidas", () => {
    const { drawer, ctx, hand } = setup();
    drawer.resize(800, 450, 1);
    hand.landmarks[8].x = Number.NaN;
    drawer.drawHands([hand, { ...hand, handId: "hand_1", handedness: "Left" }], false);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
    for (const args of [...ctx.arc.mock.calls, ...ctx.moveTo.mock.calls, ...ctx.lineTo.mock.calls]) {
      expect(args.every(Number.isFinite)).toBe(true);
    }
    drawer.drawHands([], false);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
  });
});
