import type {
  DerivedHandFeatures,
  FingerState,
  Handedness,
  Landmark3D,
  Point2D,
} from "./types.js";

function dist3D(a: Landmark3D, b: Landmark3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function normalizeVector(v: Landmark3D): Landmark3D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-6) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function calculatePrimaryDirection(
  v: Landmark3D
): "UP" | "DOWN" | "LEFT" | "RIGHT" | "NONE" {
  const absX = Math.abs(v.x);
  const absY = Math.abs(v.y);

  // No sistema de coordenadas de imagem: Y aponta para baixo
  if (absY > absX * 1.1) {
    return v.y < 0 ? "UP" : "DOWN";
  }
  if (absX > absY * 1.1) {
    return v.x < 0 ? "LEFT" : "RIGHT";
  }
  return "NONE";
}

export function extractHandFeatures(
  landmarks: Landmark3D[],
  handedness: Handedness
): DerivedHandFeatures {
  if (landmarks.length < 21) {
    throw new Error(`Landmarks inválidos: esperado 21 pontos, recebido ${landmarks.length}`);
  }

  const wrist = landmarks[0];
  const thumbCmc = landmarks[1];
  const thumbMcp = landmarks[2];
  const thumbIp = landmarks[3];
  const thumbTip = landmarks[4];

  const indexMcp = landmarks[5];
  const indexPip = landmarks[6];
  const indexDip = landmarks[7];
  const indexTip = landmarks[8];

  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleDip = landmarks[11];
  const middleTip = landmarks[12];

  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringDip = landmarks[15];
  const ringTip = landmarks[16];

  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyDip = landmarks[19];
  const pinkyTip = landmarks[20];

  // Escala da mão: distância estável entre pulso e MCP do dedo médio
  const rawHandScale = dist3D(wrist, middleMcp);
  const handScale = rawHandScale > 0.005 ? rawHandScale : 0.1;

  // Centro da palma: média de pontos chave (pulso e MCPs)
  const palmPoints = [wrist, indexMcp, middleMcp, ringMcp, pinkyMcp];
  const palmCenter: Point2D = {
    x: palmPoints.reduce((acc, p) => acc + p.x, 0) / palmPoints.length,
    y: palmPoints.reduce((acc, p) => acc + p.y, 0) / palmPoints.length,
  };

  // Vetor normal/direção da palma (do pulso para o centro dos MCPs)
  const mcpCenter: Landmark3D = {
    x: (indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 4,
    y: (indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 4,
    z: (indexMcp.z + middleMcp.z + ringMcp.z + pinkyMcp.z) / 4,
  };
  const palmNormal = normalizeVector({
    x: mcpCenter.x - wrist.x,
    y: mcpCenter.y - wrist.y,
    z: mcpCenter.z - wrist.z,
  });

  // Função auxiliar para analisar os 4 dedos principais (indicador, médio, anelar, mínimo)
  const analyzeFinger = (
    mcp: Landmark3D,
    pip: Landmark3D,
    dip: Landmark3D,
    tip: Landmark3D
  ): FingerState => {
    const tipToWrist = dist3D(tip, wrist);
    const pipToWrist = dist3D(pip, wrist);
    const dipToWrist = dist3D(dip, wrist);
    const tipToMcp = dist3D(tip, mcp);
    const fingerLength = dist3D(mcp, pip) + dist3D(pip, dip) + dist3D(dip, tip);

    const lengthRatio = fingerLength > 0 ? tipToMcp / fingerLength : 0;
    // Straight finger: lengthRatio ~ 0.85-1.0; curled: ~ 0.3-0.5
    const extensionRatio = Math.max(0, Math.min(1, (lengthRatio - 0.42) / (0.82 - 0.42)));

    // Dedo estendido requer tanto boa extensão quanto ponta mais distante do pulso que a articulação PIP
    const isExtended = extensionRatio >= 0.6 && tipToWrist > pipToWrist * 1.05 && tipToWrist > dipToWrist;

    const dirVector = normalizeVector({
      x: tip.x - pip.x,
      y: tip.y - pip.y,
      z: tip.z - pip.z,
    });
    const primaryDirection = calculatePrimaryDirection(dirVector);

    return {
      extended: isExtended,
      extensionRatio,
      tipDirection: dirVector,
      primaryDirection,
    };
  };

  // Análise do polegar
  const analyzeThumb = (): FingerState => {
    const thumbSegmentsLength =
      dist3D(thumbCmc, thumbMcp) + dist3D(thumbMcp, thumbIp) + dist3D(thumbIp, thumbTip);
    const tipToCmc = dist3D(thumbTip, thumbCmc);
    const straightness = thumbSegmentsLength > 0 ? tipToCmc / thumbSegmentsLength : 0;

    // Distância da ponta do polegar até o MCP do mínimo (afastamento da palma)
    const tipToPinkyMcp = dist3D(thumbTip, pinkyMcp) / handScale;
    // Distância da ponta do polegar até o MCP do indicador
    const tipToIndexMcp = dist3D(thumbTip, indexMcp) / handScale;

    // Polegar estendido: ponta afastada e alinhada
    const extensionRatio = Math.max(0, Math.min(1, (straightness - 0.5) / (0.88 - 0.5)));
    const isExtended = extensionRatio >= 0.55 && tipToPinkyMcp > 0.62;

    const dirVector = normalizeVector({
      x: thumbTip.x - thumbMcp.x,
      y: thumbTip.y - thumbMcp.y,
      z: thumbTip.z - thumbMcp.z,
    });
    const primaryDirection = calculatePrimaryDirection(dirVector);

    return {
      extended: isExtended,
      extensionRatio,
      tipDirection: dirVector,
      primaryDirection,
    };
  };

  const thumbState = analyzeThumb();
  const indexState = analyzeFinger(indexMcp, indexPip, indexDip, indexTip);
  const middleState = analyzeFinger(middleMcp, middlePip, middleDip, middleTip);
  const ringState = analyzeFinger(ringMcp, ringPip, ringDip, ringTip);
  const pinkyState = analyzeFinger(pinkyMcp, pinkyPip, pinkyDip, pinkyTip);

  const extendedFingers: ("thumb" | "index" | "middle" | "ring" | "pinky")[] = [];
  if (thumbState.extended) extendedFingers.push("thumb");
  if (indexState.extended) extendedFingers.push("index");
  if (middleState.extended) extendedFingers.push("middle");
  if (ringState.extended) extendedFingers.push("ring");
  if (pinkyState.extended) extendedFingers.push("pinky");

  // Pinch e OK_SIGN
  const rawPinchDist = dist3D(thumbTip, indexTip);
  const pinchDistance = rawPinchDist / handScale;
  const pinchThreshold = 0.38;
  const pinchIntensity = Math.max(0, Math.min(1, 1 - pinchDistance / 0.5));
  const isPinching = pinchDistance <= pinchThreshold;

  // OK_SIGN requer contato próximo entre ponta do indicador e polegar
  const okContact = pinchDistance <= 0.28;

  // Separação em V para VICTORY
  const rawVictorySeparation = dist3D(indexTip, middleTip);
  const victorySeparation = rawVictorySeparation / handScale;

  return {
    handScale,
    palmCenter,
    palmNormal,
    fingers: {
      thumb: thumbState,
      index: indexState,
      middle: middleState,
      ring: ringState,
      pinky: pinkyState,
    },
    extendedFingers,
    extendedCount: extendedFingers.length,
    pinchDistance,
    pinchIntensity,
    isPinching,
    okContact,
    victorySeparation,
  };
}
