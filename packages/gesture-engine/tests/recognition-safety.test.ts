import { describe, expect, it } from "vitest";
import { GestureEngine } from "../src/core/engine.js";
import type { CommandDetectedEvent, GestureEngineOptions, HandInput } from "../src/core/types.js";
import { createClosedFist, createNumberOne, createOpenPalm, createVictory } from "./fixtures.js";

async function setup(options: GestureEngineOptions = {}) {
  const engine = new GestureEngine({ stabilizationTimeMs: 100, ...options });
  await engine.start();
  const commands: CommandDetectedEvent[] = [];
  engine.on("command:detected", e => commands.push(e));
  const frame = (timestamp: number, hands: HandInput[] = [createClosedFist()]) => engine.processFrame({ timestamp, hands });
  return { engine, commands, frame };
}

// These exercise the public SDK with real recognizers, not mocked pose results.
describe("Protected commands", () => {
  it("requires continuous stability and resets confirmation on a missing frame", async () => {
    const { frame, commands } = await setup({ gestures: ["CLOSED_FIST"] });
    frame(0); frame(70); frame(80, []); frame(100); frame(170);
    expect(commands).toHaveLength(0);
    frame(200);
    expect(commands.map(c => c.gesture)).toEqual(["CLOSED_FIST"]);
  });

  it("requires sustained release, including brief tracking dropouts", async () => {
    const { frame, commands } = await setup({ gestures: ["CLOSED_FIST"] });
    frame(0); frame(100); frame(200); frame(220, []); frame(250); frame(350);
    expect(commands).toHaveLength(1);
    frame(400, [createNumberOne()]); frame(500, [createNumberOne()]); frame(550, [createNumberOne()]);
    frame(600); frame(700);
    expect(commands).toHaveLength(2);
  });

  it("allows deliberate continuous repeats when release is disabled", async () => {
    const { frame, commands } = await setup({ gestures: ["CLOSED_FIST"], recognition: { requireRelease: false } });
    frame(0); frame(100); frame(150); frame(250);
    expect(commands).toHaveLength(2);
  });

  it("BYPASS blocks commands while retaining tracking and diagnostic gestures", async () => {
    const { engine, frame, commands } = await setup({ recognition: { mode: "BYPASS" } });
    let diagnostics = 0, tracking = 0;
    engine.on("gesture:detected", () => diagnostics++);
    engine.on("hand:tracking", () => tracking++);
    frame(0); frame(100); frame(200);
    expect(commands).toHaveLength(0);
    expect(diagnostics).toBeGreaterThan(0);
    expect(tracking).toBe(3);
    engine.setRecognitionMode("ALWAYS_ON");
    frame(220); frame(320);
    expect(commands).toHaveLength(1);
  });

  it("ARMED requires activation, release, and reactivation after one command", async () => {
    const { engine, commands, frame } = await setup({ gestures: ["CLOSED_FIST"], recognition: { mode: "ARMED", activationTimeMs: 200 } });
    frame(0); frame(100);
    expect(commands).toHaveLength(0);
    frame(150, [createOpenPalm()]); frame(250, [createOpenPalm()]); frame(350, [createOpenPalm()]);
    expect(engine.getRecognitionState().hands[0]).toMatchObject({ armed: true, status: "WAITING_RELEASE" });
    frame(450, [createOpenPalm()]);
    expect(commands).toHaveLength(0);
    frame(500); frame(600); frame(650); frame(750);
    expect(commands.map(c => c.gesture)).toEqual(["CLOSED_FIST"]);
    frame(850, [createNumberOne()]); frame(1000, [createNumberOne()]); frame(1100); frame(1200);
    expect(commands).toHaveLength(1);
    expect(engine.getRecognitionState().hands[0].status).toBe("WAITING_ACTIVATION");
  });

  it("expires activation and never lets another hand borrow it", async () => {
    const { engine, commands, frame } = await setup({ recognition: { mode: "ARMED", activationTimeMs: 100, armedTimeoutMs: 400 } });
    frame(0, [createOpenPalm()]); frame(100, [createOpenPalm()]);
    frame(150, [createOpenPalm(), createClosedFist(1, "Left")]);
    frame(250, [createOpenPalm(), createClosedFist(1, "Left")]);
    expect(commands).toHaveLength(0);
    frame(350, [createOpenPalm()]); frame(500, [createOpenPalm()]); frame(550); frame(700); frame(800);
    expect(commands).toHaveLength(0);
    expect(engine.getRecognitionState().hands[0].armed).toBe(false);
  });

  it("ROI gates both activation and commands in mirrored camera coordinates", async () => {
    const { engine, commands, frame } = await setup({ gestures: ["CLOSED_FIST"], mirrored: true,
      recognition: { region: { x: 0.55, y: 0, width: 0.45, height: 1 } } });
    const shifted = createClosedFist();
    shifted.landmarks.forEach(p => p.x -= 0.2);
    frame(0); frame(100);
    expect(commands).toHaveLength(0);
    expect(engine.getRecognitionState().hands[0].status).toBe("OUTSIDE_ROI");
    frame(150, [shifted]); frame(250, [shifted]);
    expect(commands).toHaveLength(1);
    engine.configureRecognition({ mode: "ARMED", activationTimeMs: 100 });
    frame(300, [createOpenPalm()]); frame(400, [createOpenPalm()]);
    expect(engine.getRecognitionState().hands[0].armed).toBe(false);
  });

  it("ROI exit cancels pending stability and requires fresh in-region evidence", async () => {
    const { engine, commands, frame } = await setup({ recognition: { region: { x: 0, y: 0, width: 0.6, height: 1 } } });
    const outside = createClosedFist();
    outside.landmarks.forEach(p => p.x += 0.2);
    frame(0); frame(80, [outside]); frame(120); frame(170);
    expect(commands).toHaveLength(0);
    frame(220);
    expect(commands).toHaveLength(1);
    expect(engine.getRecognitionState().hands[0].status).toBe("WAITING_RELEASE");
  });

  it("chooses one command according to priority for overlapping aliases", async () => {
    const { commands, frame } = await setup({ stabilizationTimeMs: 0,
      recognition: { commandGestures: ["VICTORY", "NUMBER_TWO"] } });
    frame(0, [createVictory()]); frame(100, [createVictory()]);
    expect(commands.map(c => c.gesture)).toEqual(["VICTORY"]);
  });

  it("pause, stop, mode changes and long frame gaps discard pending confirmations", async () => {
    const { engine, frame, commands } = await setup();
    frame(0); engine.stopRecognition(); frame(100); engine.startRecognition(); frame(150); frame(200);
    expect(commands).toHaveLength(0);
    frame(500); // gap > 250ms
    expect(commands).toHaveLength(0);
    engine.setRecognitionMode("BYPASS"); frame(600); engine.setRecognitionMode("ALWAYS_ON"); frame(650); frame(750);
    expect(commands).toHaveLength(1);
    await engine.stop(); await engine.start(); frame(800);
    expect(commands).toHaveLength(1);
  });

  it("supports a custom activation gesture outside the diagnostic gesture allowlist", async () => {
    const { engine, commands, frame } = await setup({ gestures: ["CLOSED_FIST"], recognition: { mode: "ARMED", activationGesture: "ACTIVATE", activationTimeMs: 100 } });
    engine.registerGesture({ name: "ACTIVATE", recognize: ctx => ctx.features.extendedCount === 5 });
    frame(0, [createOpenPalm()]); frame(100, [createOpenPalm()]);
    frame(200); frame(350); frame(450);
    expect(commands.map(c => c.gesture)).toEqual(["CLOSED_FIST"]);
  });

  it("validates configuration atomically and protects option snapshots from mutation", async () => {
    const { engine } = await setup();
    expect(() => engine.configureRecognition({ region: { x: 0.9, y: 0, width: 0.5, height: 1 } })).toThrow();
    expect(() => engine.configureRecognition({ activationTimeMs: NaN })).toThrow();
    expect(() => engine.configureRecognition({ activationGesture: "SWIPE_LEFT" })).toThrow();
    expect(engine.getRecognitionOptions().mode).toBe("ALWAYS_ON");
    engine.configureRecognition({ region: { x: 0, y: 0, width: 0.5, height: 1 } });
    engine.getRecognitionOptions().region!.x = 1;
    expect(engine.getRecognitionOptions().region!.x).toBe(0);
  });

  it("rejects invalid and duplicate timestamps even with zero stabilization", async () => {
    const { frame, commands } = await setup({ stabilizationTimeMs: 0, recognition: { requireRelease: false } });
    frame(-1); frame(NaN); frame(Infinity);
    expect(commands).toHaveLength(0);
    frame(100); frame(100); frame(90);
    expect(commands).toHaveLength(1);
    frame(110);
    expect(commands).toHaveLength(2);
  });

  it("exposes runtime options and allows an explicit slow-source continuity limit", async () => {
    const { engine, frame, commands } = await setup({ stabilizationTimeMs: 300, recognition: { maxFrameGapMs: 500 } });
    frame(0); frame(300);
    expect(commands).toHaveLength(1);
    engine.setOptions({ stabilizationTimeMs: 50 });
    expect(engine.getRecognitionState().hands).toEqual([]);
    frame(350); frame(400);
    expect(commands).toHaveLength(2);
    expect(() => engine.setOptions({ stabilizationTimeMs: -1 })).toThrow();
    expect(() => engine.configureRecognition({ maxFrameGapMs: 0 })).toThrow();
    engine.stopRecognition();
    expect(engine.getRecognitionState().enabled).toBe(false);
    engine.startRecognition();
    expect(engine.getRecognitionState().enabled).toBe(true);
    await engine.stop();
    expect(engine.getRecognitionState().enabled).toBe(false);
  });

  it("accepts temporal swipes without requiring a static hold", async () => {
    const { frame, commands } = await setup({ gestures: ["SWIPE_RIGHT"], stabilizationTimeMs: 300 });
    const moved = createOpenPalm();
    moved.landmarks.forEach(p => p.x += 0.15);
    frame(0, [createOpenPalm()]); frame(80, [moved]);
    expect(commands.map(c => c.gesture)).toEqual(["SWIPE_RIGHT"]);
    expect(commands[0].duration).toBe(80);
    frame(180, [moved]);
    expect(commands).toHaveLength(1);
  });

  it("rejects a swipe that starts outside the ROI", async () => {
    const { frame, commands } = await setup({ gestures: ["SWIPE_LEFT"], stabilizationTimeMs: 0,
      recognition: { region: { x: 0, y: 0, width: 0.6, height: 1 } } });
    const outside = createOpenPalm();
    outside.landmarks.forEach(p => p.x += 0.2);
    frame(0, [outside]); frame(80, [createOpenPalm()]);
    expect(commands).toHaveLength(0);
  });

  it("does not change UNKNOWN diagnostics when privately evaluating activation", async () => {
    const { engine, frame } = await setup({ gestures: ["UNKNOWN"], stabilizationTimeMs: 0 });
    const diagnostics: string[] = [];
    engine.on("gesture:detected", event => diagnostics.push(event.gesture));
    frame(0, [createOpenPalm()]);
    expect(diagnostics).toEqual(["UNKNOWN"]);
  });

  it("resets an armed session when the camera source is interrupted", async () => {
    const { engine, frame, commands } = await setup({ recognition: { mode: "ARMED", activationTimeMs: 100 } });
    frame(0, [createOpenPalm()]); frame(100, [createOpenPalm()]);
    expect(engine.getRecognitionState().hands[0].armed).toBe(true);
    engine.resetRecognition("camera_switch");
    frame(150); frame(300); frame(400);
    expect(commands).toHaveLength(0);
    expect(engine.getRecognitionState().hands[0].status).toBe("WAITING_ACTIVATION");
  });

});
