import type { HandInput, Handedness, Landmark3D } from "gesture-engine/core";

/**
 * Cria uma mão sintética parametrizável com 21 landmarks MediaPipe.
 * Ponto de referência: Pulso em (0.5, 0.7, 0)
 * MCPs em torno de Y ~ 0.5
 * Dedos estendidos apontam para cima (Y ~ 0.25 - 0.15)
 */
export function createSyntheticHand(options: {
  handedness?: Handedness;
  scale?: number;
  center?: { x: number; y: number };
  thumbExtended?: boolean;
  thumbDirection?: "UP" | "DOWN" | "LEFT" | "RIGHT";
  indexExtended?: boolean;
  indexDirection?: "UP" | "DOWN" | "LEFT" | "RIGHT";
  middleExtended?: boolean;
  ringExtended?: boolean;
  pinkyExtended?: boolean;
  pinchContact?: boolean;
  victorySpread?: boolean;
  confidence?: number;
}): HandInput {
  const handedness = options.handedness ?? "Right";
  const scale = options.scale ?? 1.0;
  const center = options.center ?? { x: 0.5, y: 0.5 };
  const conf = options.confidence ?? 0.95;

  const isRight = handedness === "Right";
  const signX = isRight ? 1 : -1;

  // Base: pulso e MCPs
  const wrist: Landmark3D = { x: center.x, y: center.y + 0.2 * scale, z: 0 };
  const thumbCmc: Landmark3D = { x: center.x - 0.05 * signX * scale, y: center.y + 0.12 * scale, z: 0 };
  const thumbMcp: Landmark3D = { x: center.x - 0.08 * signX * scale, y: center.y + 0.06 * scale, z: 0 };

  const indexMcp: Landmark3D = { x: center.x - 0.05 * signX * scale, y: center.y, z: 0 };
  const middleMcp: Landmark3D = { x: center.x - 0.01 * signX * scale, y: center.y - 0.01 * scale, z: 0 };
  const ringMcp: Landmark3D = { x: center.x + 0.03 * signX * scale, y: center.y, z: 0 };
  const pinkyMcp: Landmark3D = { x: center.x + 0.07 * signX * scale, y: center.y + 0.02 * scale, z: 0 };

  // Thumb
  let thumbIp: Landmark3D;
  let thumbTip: Landmark3D;

  if (options.thumbExtended) {
    if (options.thumbDirection === "UP") {
      thumbIp = { x: thumbMcp.x - 0.04 * signX * scale, y: thumbMcp.y - 0.08 * scale, z: 0 };
      thumbTip = { x: thumbMcp.x - 0.06 * signX * scale, y: thumbMcp.y - 0.16 * scale, z: 0 };
    } else if (options.thumbDirection === "DOWN") {
      thumbIp = { x: thumbMcp.x - 0.04 * signX * scale, y: thumbMcp.y + 0.08 * scale, z: 0 };
      thumbTip = { x: thumbMcp.x - 0.06 * signX * scale, y: thumbMcp.y + 0.16 * scale, z: 0 };
    } else if (options.thumbDirection === "LEFT") {
      thumbIp = { x: thumbMcp.x - 0.08 * scale, y: thumbMcp.y, z: 0 };
      thumbTip = { x: thumbMcp.x - 0.16 * scale, y: thumbMcp.y, z: 0 };
    } else if (options.thumbDirection === "RIGHT") {
      thumbIp = { x: thumbMcp.x + 0.08 * scale, y: thumbMcp.y, z: 0 };
      thumbTip = { x: thumbMcp.x + 0.16 * scale, y: thumbMcp.y, z: 0 };
    } else {
      // Aberto diagonal padrão
      thumbIp = { x: thumbMcp.x - 0.07 * signX * scale, y: thumbMcp.y - 0.05 * scale, z: 0 };
      thumbTip = { x: thumbMcp.x - 0.14 * signX * scale, y: thumbMcp.y - 0.08 * scale, z: 0 };
    }
  } else {
    // Flexionado em direção à palma / indicador MCP
    thumbIp = { x: thumbMcp.x + 0.02 * signX * scale, y: thumbMcp.y + 0.02 * scale, z: 0 };
    thumbTip = { x: indexMcp.x, y: indexMcp.y + 0.03 * scale, z: 0.02 * scale };
  }

  // Função auxiliar para gerar articulações dos dedos
  function buildFinger(
    mcp: Landmark3D,
    extended: boolean,
    direction: "UP" | "DOWN" | "LEFT" | "RIGHT" = "UP",
    lateralOffset = 0
  ): { pip: Landmark3D; dip: Landmark3D; tip: Landmark3D } {
    if (extended) {
      if (direction === "DOWN") {
        return {
          pip: { x: mcp.x + lateralOffset, y: mcp.y + 0.07 * scale, z: 0 },
          dip: { x: mcp.x + lateralOffset, y: mcp.y + 0.13 * scale, z: 0 },
          tip: { x: mcp.x + lateralOffset, y: mcp.y + 0.18 * scale, z: 0 },
        };
      }
      if (direction === "LEFT") {
        return {
          pip: { x: mcp.x - 0.07 * scale, y: mcp.y + lateralOffset, z: 0 },
          dip: { x: mcp.x - 0.13 * scale, y: mcp.y + lateralOffset, z: 0 },
          tip: { x: mcp.x - 0.18 * scale, y: mcp.y + lateralOffset, z: 0 },
        };
      }
      if (direction === "RIGHT") {
        return {
          pip: { x: mcp.x + 0.07 * scale, y: mcp.y + lateralOffset, z: 0 },
          dip: { x: mcp.x + 0.13 * scale, y: mcp.y + lateralOffset, z: 0 },
          tip: { x: mcp.x + 0.18 * scale, y: mcp.y + lateralOffset, z: 0 },
        };
      }
      // Padrão UP
      return {
        pip: { x: mcp.x + lateralOffset, y: mcp.y - 0.07 * scale, z: 0 },
        dip: { x: mcp.x + lateralOffset * 1.5, y: mcp.y - 0.13 * scale, z: 0 },
        tip: { x: mcp.x + lateralOffset * 2, y: mcp.y - 0.19 * scale, z: 0 },
      };
    } else {
      // Flexionado em punho (dobrado para dentro da palma)
      return {
        pip: { x: mcp.x, y: mcp.y - 0.03 * scale, z: -0.02 * scale },
        dip: { x: mcp.x, y: mcp.y + 0.01 * scale, z: 0.02 * scale },
        tip: { x: mcp.x, y: mcp.y + 0.03 * scale, z: 0.03 * scale },
      };
    }
  }

  const indexDir = options.indexDirection ?? "UP";
  const indexExtended = options.indexExtended ?? false;
  const middleExtended = options.middleExtended ?? false;
  const ringExtended = options.ringExtended ?? false;
  const pinkyExtended = options.pinkyExtended ?? false;

  const index = buildFinger(indexMcp, indexExtended, indexDir, options.victorySpread ? -0.03 * signX * scale : 0);
  const middle = buildFinger(middleMcp, middleExtended, "UP", options.victorySpread ? 0.03 * signX * scale : 0);
  const ring = buildFinger(ringMcp, ringExtended, "UP");
  const pinky = buildFinger(pinkyMcp, pinkyExtended, "UP");

  // Ajustes de Pinch / OK_SIGN
  if (options.pinchContact) {
    // Aproxima ponta do indicador da ponta do polegar
    thumbTip = { x: center.x - 0.06 * signX * scale, y: center.y - 0.03 * scale, z: 0 };
    thumbIp = { x: center.x - 0.07 * signX * scale, y: center.y + 0.01 * scale, z: 0 };
    index.tip = { x: thumbTip.x + 0.01 * signX * scale, y: thumbTip.y + 0.01 * scale, z: 0 };
    index.dip = { x: indexMcp.x - 0.02 * signX * scale, y: indexMcp.y - 0.04 * scale, z: 0 };
    index.pip = { x: indexMcp.x - 0.01 * signX * scale, y: indexMcp.y - 0.02 * scale, z: 0 };
  }

  const landmarks: Landmark3D[] = [
    wrist, // 0
    thumbCmc, // 1
    thumbMcp, // 2
    thumbIp, // 3
    thumbTip, // 4
    indexMcp, // 5
    index.pip, // 6
    index.dip, // 7
    index.tip, // 8
    middleMcp, // 9
    middle.pip, // 10
    middle.dip, // 11
    middle.tip, // 12
    ringMcp, // 13
    ring.pip, // 14
    ring.dip, // 15
    ring.tip, // 16
    pinkyMcp, // 17
    pinky.pip, // 18
    pinky.dip, // 19
    pinky.tip, // 20
  ];

  return {
    landmarks,
    handedness,
    confidence: conf,
    score: conf,
  };
}

export function createOpenPalm(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: true,
    indexExtended: true,
    middleExtended: true,
    ringExtended: true,
    pinkyExtended: true,
  });
}

export function createClosedFist(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: false,
    indexExtended: false,
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createNumberOne(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: false,
    indexExtended: true,
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createNumberTwo(scale = 1.0, handedness: Handedness = "Right", victorySpread = false): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: false,
    indexExtended: true,
    middleExtended: true,
    ringExtended: false,
    pinkyExtended: false,
    victorySpread,
  });
}

export function createNumberThree(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: false,
    indexExtended: true,
    middleExtended: true,
    ringExtended: true,
    pinkyExtended: false,
  });
}

export function createNumberFour(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: false,
    indexExtended: true,
    middleExtended: true,
    ringExtended: true,
    pinkyExtended: true,
  });
}

export function createNumberFive(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: true,
    indexExtended: true,
    middleExtended: true,
    ringExtended: true,
    pinkyExtended: true,
  });
}

export function createVictory(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: false,
    indexExtended: true,
    middleExtended: true,
    ringExtended: false,
    pinkyExtended: false,
    victorySpread: true,
  });
}

export function createRockOn(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: false,
    indexExtended: true,
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: true,
  });
}

export function createThumbsUp(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: true,
    thumbDirection: "UP",
    indexExtended: false,
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createThumbsDown(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: true,
    thumbDirection: "DOWN",
    indexExtended: false,
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createThumbLeft(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: true,
    thumbDirection: "LEFT",
    indexExtended: false,
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createThumbRight(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    thumbExtended: true,
    thumbDirection: "RIGHT",
    indexExtended: false,
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createPointingUp(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    indexExtended: true,
    indexDirection: "UP",
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createPointingDown(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    indexExtended: true,
    indexDirection: "DOWN",
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createPointingLeft(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    indexExtended: true,
    indexDirection: "LEFT",
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createPointingRight(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    indexExtended: true,
    indexDirection: "RIGHT",
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}

export function createOkSign(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    pinchContact: true,
    middleExtended: true,
    ringExtended: true,
    pinkyExtended: true,
  });
}

export function createPinch(scale = 1.0, handedness: Handedness = "Right"): HandInput {
  return createSyntheticHand({
    handedness,
    scale,
    pinchContact: true,
    middleExtended: false,
    ringExtended: false,
    pinkyExtended: false,
  });
}
