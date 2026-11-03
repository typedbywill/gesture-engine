import type { HandInput, Handedness } from "gesture-engine/core";
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
  createRockOn,
  createThumbsDown,
  createThumbsUp,
  createVictory,
} from "./synthetic-hands.js";

export type SimulationMode =
  | "NO_HAND"
  | "AUTO_TOUR"
  | "OPEN_PALM"
  | "CLOSED_FIST"
  | "NUMBER_ONE"
  | "NUMBER_TWO"
  | "NUMBER_THREE"
  | "NUMBER_FOUR"
  | "NUMBER_FIVE"
  | "VICTORY"
  | "ROCK_ON"
  | "THUMBS_UP"
  | "THUMBS_DOWN"
  | "OK_SIGN"
  | "PINCH"
  | "SWIPE_TEST";

export class SimulatedCamera {
  private isRunning = false;
  private animId: number | null = null;
  private currentMode: SimulationMode = "AUTO_TOUR";
  private onFrameCallback: ((hands: HandInput[], timestamp: number) => void) | null = null;

  private position: { x: number; y: number } | null = null;
  setPosition(position: { x: number; y: number } | null): void { this.position = position; }

  private startTime = 0;
  private tourIndex = 0;
  private tourIntervalMs = 2500;
  private lastTourSwitch = 0;

  private tourGestures: { name: string; createFn: () => HandInput }[] = [
    { name: "OPEN_PALM", createFn: () => createOpenPalm(1.0, "Right") },
    { name: "CLOSED_FIST", createFn: () => createClosedFist(1.0, "Right") },
    { name: "NUMBER_ONE", createFn: () => createNumberOne(1.0, "Right") },
    { name: "NUMBER_TWO", createFn: () => createNumberTwo(1.0, "Right") },
    { name: "NUMBER_THREE", createFn: () => createNumberThree(1.0, "Right") },
    { name: "NUMBER_FOUR", createFn: () => createNumberFour(1.0, "Right") },
    { name: "NUMBER_FIVE", createFn: () => createNumberFive(1.0, "Right") },
    { name: "VICTORY", createFn: () => createVictory(1.0, "Right") },
    { name: "ROCK_ON", createFn: () => createRockOn(1.0, "Right") },
    { name: "THUMBS_UP", createFn: () => createThumbsUp(1.0, "Right") },
    { name: "THUMBS_DOWN", createFn: () => createThumbsDown(1.0, "Right") },
    { name: "OK_SIGN", createFn: () => createOkSign(1.0, "Right") },
    { name: "PINCH", createFn: () => createPinch(1.0, "Right") },
  ];

  start(onFrame: (hands: HandInput[], timestamp: number) => void): void {
    this.onFrameCallback = onFrame;
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastTourSwitch = this.startTime;
    this.tourIndex = 0;

    const loop = (now: number) => {
      if (!this.isRunning) return;

      const hands = this.generateFrame(now);
      if (this.position) {
        for (const hand of hands) for (const p of hand.landmarks) {
          p.x += this.position.x - 0.5;
          p.y += this.position.y - 0.55;
        }
      }
      if (this.onFrameCallback) {
        this.onFrameCallback(hands, Math.round(now));
      }

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  setMode(mode: SimulationMode): void {
    this.currentMode = mode;
  }

  private generateFrame(now: number): HandInput[] {
    if (this.currentMode === "NO_HAND") return [];
    const elapsed = now - this.startTime;

    if (this.currentMode === "SWIPE_TEST") {
      // Simula movimento oscilante da palma esquerda para direita para testar swipe
      const cycle = (elapsed % 2000) / 2000; // 0 a 1 em 2 segundos
      let posX = 0.2 + 0.6 * Math.sin(cycle * Math.PI * 2);
      posX = Math.max(0.15, Math.min(0.85, posX));

      const hand = createOpenPalm(1.0, "Right");
      const deltaX = posX - 0.5;
      for (const p of hand.landmarks) {
        p.x += deltaX;
      }
      return [hand];
    }

    if (this.currentMode === "AUTO_TOUR") {
      if (now - this.lastTourSwitch >= this.tourIntervalMs) {
        this.tourIndex = (this.tourIndex + 1) % this.tourGestures.length;
        this.lastTourSwitch = now;
      }
      const item = this.tourGestures[this.tourIndex];
      const hand = item.createFn();

      // Adiciona leve respiração/flutuação orgânica à mão
      const floatY = Math.sin(elapsed / 400) * 0.015;
      for (const p of hand.landmarks) {
        p.y += floatY;
      }
      return [hand];
    }

    // Poses específicas
    const generatorMap: Record<string, () => HandInput> = {
      OPEN_PALM: () => createOpenPalm(1.0, "Right"),
      CLOSED_FIST: () => createClosedFist(1.0, "Right"),
      NUMBER_ONE: () => createNumberOne(1.0, "Right"),
      NUMBER_TWO: () => createNumberTwo(1.0, "Right"),
      NUMBER_THREE: () => createNumberThree(1.0, "Right"),
      NUMBER_FOUR: () => createNumberFour(1.0, "Right"),
      NUMBER_FIVE: () => createNumberFive(1.0, "Right"),
      VICTORY: () => createVictory(1.0, "Right"),
      ROCK_ON: () => createRockOn(1.0, "Right"),
      THUMBS_UP: () => createThumbsUp(1.0, "Right"),
      THUMBS_DOWN: () => createThumbsDown(1.0, "Right"),
      OK_SIGN: () => createOkSign(1.0, "Right"),
      PINCH: () => createPinch(1.0, "Right"),
    };

    const gen = generatorMap[this.currentMode] ?? generatorMap.OPEN_PALM;
    return [gen()];
  }
}
