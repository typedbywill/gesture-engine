import { describe, expect, it } from "vitest";
import { GestureEngine } from "../src/core/engine.js";
import { BUILT_IN_GESTURES } from "../src/core/types.js";
import {
  createClosedFist,
  createNumberFive,
  createNumberFour,
  createNumberOne,
  createNumberThree,
  createNumberTwo,
  createOkSign,
  createOpenPalm,
  createPinch,
  createPointingDown,
  createPointingLeft,
  createPointingRight,
  createPointingUp,
  createRockOn,
  createThumbLeft,
  createThumbRight,
  createThumbsDown,
  createThumbsUp,
  createVictory,
} from "./fixtures.js";

describe("Built-in Static Gestures Recognition", () => {
  async function testGesture(
    createHandFn: (scale?: number, handedness?: "Left" | "Right") => any,
    expectedGesture: string,
    scales = [0.6, 1.0, 1.8],
    handednesses: ("Left" | "Right")[] = ["Right", "Left"]
  ) {
    for (const h of handednesses) {
      for (const scale of scales) {
        const engine = new GestureEngine({
          stabilizationTimeMs: 0, // ativação imediata para testes de regra estática
        });
        await engine.init();
        await engine.start();

        const detected: string[] = [];
        engine.on("gesture:detected", ({ gesture }) => {
          detected.push(gesture);
        });

        const hand = createHandFn(scale, h);
        engine.processFrame({
          timestamp: 100,
          hands: [hand],
        });

        expect(
          detected,
          `Esperado '${expectedGesture}' para mão ${h} na escala ${scale}, recebido: [${detected.join(
            ", "
          )}]`
        ).toContain(expectedGesture);
      }
    }
  }

  it("reconhece OPEN_PALM para ambas as mãos e em várias escalas", async () => {
    await testGesture(createOpenPalm, BUILT_IN_GESTURES.OPEN_PALM);
  });

  it("reconhece CLOSED_FIST para ambas as mãos e em várias escalas", async () => {
    await testGesture(createClosedFist, BUILT_IN_GESTURES.CLOSED_FIST);
  });

  it("reconhece números explícitos: NUMBER_ONE a NUMBER_FIVE", async () => {
    await testGesture(createNumberOne, BUILT_IN_GESTURES.NUMBER_ONE);
    await testGesture(createNumberTwo, BUILT_IN_GESTURES.NUMBER_TWO);
    await testGesture(createNumberThree, BUILT_IN_GESTURES.NUMBER_THREE);
    await testGesture(createNumberFour, BUILT_IN_GESTURES.NUMBER_FOUR);
    await testGesture(createNumberFive, BUILT_IN_GESTURES.NUMBER_FIVE);
  });

  it("reconhece o sinal de V/vitória como NUMBER_TWO", async () => {
    await testGesture(createVictory, BUILT_IN_GESTURES.NUMBER_TWO);
  });

  it("reconhece ROCK_ON", async () => {
    await testGesture(createRockOn, BUILT_IN_GESTURES.ROCK_ON);
  });

  it("reconhece THUMBS_UP e THUMBS_DOWN", async () => {
    await testGesture(createThumbsUp, BUILT_IN_GESTURES.THUMBS_UP);
    await testGesture(createThumbsDown, BUILT_IN_GESTURES.THUMBS_DOWN);
  });

  it("reconhece orientações do polegar: THUMB_LEFT e THUMB_RIGHT", async () => {
    await testGesture(createThumbLeft, BUILT_IN_GESTURES.THUMB_LEFT);
    await testGesture(createThumbRight, BUILT_IN_GESTURES.THUMB_RIGHT);
  });

  it("reconhece orientações do indicador: POINTING_UP, DOWN, LEFT, RIGHT", async () => {
    await testGesture(createPointingUp, BUILT_IN_GESTURES.POINTING_UP);
    await testGesture(createPointingDown, BUILT_IN_GESTURES.POINTING_DOWN);
    await testGesture(createPointingLeft, BUILT_IN_GESTURES.POINTING_LEFT);
    await testGesture(createPointingRight, BUILT_IN_GESTURES.POINTING_RIGHT);
  });

  it("reconhece OK_SIGN com contato entre polegar e indicador e demais estendidos", async () => {
    await testGesture(createOkSign, BUILT_IN_GESTURES.OK_SIGN);
  });

  it("reconhece PINCH com aproximação de indicador e polegar independente dos demais dedos", async () => {
    await testGesture(createPinch, BUILT_IN_GESTURES.PINCH);
  });

  it("classifica como UNKNOWN quando a mão não bate com nenhuma pose estática", async () => {
    const engine = new GestureEngine({
      stabilizationTimeMs: 0,
      gestures: [BUILT_IN_GESTURES.UNKNOWN, BUILT_IN_GESTURES.CLOSED_FIST],
    });
    await engine.init();
    await engine.start();

    const detected: string[] = [];
    engine.on("gesture:detected", ({ gesture }) => {
      detected.push(gesture);
    });

    // Mão com apenas o dedo anelar estendido (não é nenhum gesto padrão)
    const oddHand = createClosedFist(1.0, "Right");
    // Altera apenas o anelar para cima
    oddHand.landmarks[16] = { x: 0.5, y: 0.1, z: 0 };
    oddHand.landmarks[15] = { x: 0.5, y: 0.2, z: 0 };
    oddHand.landmarks[14] = { x: 0.5, y: 0.3, z: 0 };

    engine.processFrame({
      timestamp: 100,
      hands: [oddHand],
    });

    expect(detected).toContain(BUILT_IN_GESTURES.UNKNOWN);
  });
});
