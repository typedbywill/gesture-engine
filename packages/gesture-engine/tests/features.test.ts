import { describe, expect, it } from "vitest";
import { extractHandFeatures } from "../src/core/features.js";
import { createClosedFist, createOpenPalm } from "./fixtures.js";

describe("Hand Feature Extraction", () => {
  it("extrai escala da mão e centro da palma proporcionalmente", () => {
    const hand1 = createOpenPalm(1.0, "Right");
    const hand2 = createOpenPalm(2.0, "Right");

    const feat1 = extractHandFeatures(hand1.landmarks, hand1.handedness);
    const feat2 = extractHandFeatures(hand2.landmarks, hand2.handedness);

    expect(feat2.handScale).toBeGreaterThan(feat1.handScale * 1.8);
    expect(feat1.palmCenter.x).toBeCloseTo(0.5, 1);
    expect(feat1.palmCenter.y).toBeCloseTo(0.5, 1);
  });

  it("identifica corretamente dedos estendidos em palma aberta", () => {
    const hand = createOpenPalm(1.0, "Right");
    const feat = extractHandFeatures(hand.landmarks, hand.handedness);

    expect(feat.fingers.thumb.extended).toBe(true);
    expect(feat.fingers.index.extended).toBe(true);
    expect(feat.fingers.middle.extended).toBe(true);
    expect(feat.fingers.ring.extended).toBe(true);
    expect(feat.fingers.pinky.extended).toBe(true);
    expect(feat.extendedCount).toBe(5);
  });

  it("identifica dedos flexionados em punho fechado", () => {
    const hand = createClosedFist(1.0, "Right");
    const feat = extractHandFeatures(hand.landmarks, hand.handedness);

    expect(feat.fingers.index.extended).toBe(false);
    expect(feat.fingers.middle.extended).toBe(false);
    expect(feat.fingers.ring.extended).toBe(false);
    expect(feat.fingers.pinky.extended).toBe(false);
    expect(feat.fingers.thumb.extended).toBe(false);
    expect(feat.extendedCount).toBe(0);
  });

  it("preserva métricas invariantes sob variação de escala", () => {
    const smallHand = createOpenPalm(0.5, "Left");
    const largeHand = createOpenPalm(2.0, "Left");

    const featSmall = extractHandFeatures(smallHand.landmarks, smallHand.handedness);
    const featLarge = extractHandFeatures(largeHand.landmarks, largeHand.handedness);

    expect(featSmall.extendedCount).toBe(5);
    expect(featLarge.extendedCount).toBe(5);
    expect(Math.abs(featSmall.fingers.index.extensionRatio - featLarge.fingers.index.extensionRatio)).toBeLessThan(0.15);
  });
});
