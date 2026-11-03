import { BUILT_IN_GESTURES, type BuiltInGesture, type CustomGestureContext, type CustomGestureResult } from "../types.js";

export interface RecognizerEvaluation {
  matched: boolean;
  score: number;
  data?: Record<string, unknown>;
}

export type StaticRecognizerFn = (ctx: CustomGestureContext) => RecognizerEvaluation;

export const STATIC_RECOGNIZERS: Record<BuiltInGesture, StaticRecognizerFn | null> = {
  // OPEN_PALM: todos os 5 dedos estendidos
  [BUILT_IN_GESTURES.OPEN_PALM]: (ctx) => {
    const f = ctx.features.fingers;
    const allExtended =
      f.thumb.extended &&
      f.index.extended &&
      f.middle.extended &&
      f.ring.extended &&
      f.pinky.extended;

    if (!allExtended) return { matched: false, score: 0 };

    const avgScore =
      (f.thumb.extensionRatio +
        f.index.extensionRatio +
        f.middle.extensionRatio +
        f.ring.extensionRatio +
        f.pinky.extensionRatio) /
      5;

    return { matched: true, score: Math.min(1, Math.max(0, avgScore)) };
  },

  // CLOSED_FIST: todos os dedos flexionados
  [BUILT_IN_GESTURES.CLOSED_FIST]: (ctx) => {
    const f = ctx.features.fingers;
    const anyExtended =
      f.index.extended ||
      f.middle.extended ||
      f.ring.extended ||
      f.pinky.extended;

    // Se qualquer um dos 4 dedos principais estiver estendido, não é punho
    if (anyExtended) return { matched: false, score: 0 };
    // O polegar também não deve estar estendido (aberto)
    if (f.thumb.extended) return { matched: false, score: 0 };

    const score =
      1 -
      (f.thumb.extensionRatio * 0.2 +
        f.index.extensionRatio * 0.2 +
        f.middle.extensionRatio * 0.2 +
        f.ring.extensionRatio * 0.2 +
        f.pinky.extensionRatio * 0.2);

    return { matched: true, score: Math.min(1, Math.max(0, score)) };
  },

  // NUMBER_ONE: apenas indicador estendido (combinação explícita)
  [BUILT_IN_GESTURES.NUMBER_ONE]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended &&
      !f.thumb.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },

  // NUMBER_TWO: indicador e médio estendidos
  [BUILT_IN_GESTURES.NUMBER_TWO]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended &&
      !f.thumb.extended;

    if (!matched) return { matched: false, score: 0 };
    const score = (f.index.extensionRatio + f.middle.extensionRatio) / 2;
    return { matched: true, score };
  },

  // NUMBER_THREE: indicador, médio e anelar estendidos
  [BUILT_IN_GESTURES.NUMBER_THREE]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      f.middle.extended &&
      f.ring.extended &&
      !f.pinky.extended &&
      !f.thumb.extended;

    if (!matched) return { matched: false, score: 0 };
    const score =
      (f.index.extensionRatio + f.middle.extensionRatio + f.ring.extensionRatio) / 3;
    return { matched: true, score };
  },

  // NUMBER_FOUR: quatro dedos estendidos sem polegar
  [BUILT_IN_GESTURES.NUMBER_FOUR]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      f.middle.extended &&
      f.ring.extended &&
      f.pinky.extended &&
      !f.thumb.extended;

    if (!matched) return { matched: false, score: 0 };
    const score =
      (f.index.extensionRatio +
        f.middle.extensionRatio +
        f.ring.extensionRatio +
        f.pinky.extensionRatio) /
      4;
    return { matched: true, score };
  },

  // NUMBER_FIVE: cinco dedos estendidos
  [BUILT_IN_GESTURES.NUMBER_FIVE]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.thumb.extended &&
      f.index.extended &&
      f.middle.extended &&
      f.ring.extended &&
      f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    const score =
      (f.thumb.extensionRatio +
        f.index.extensionRatio +
        f.middle.extensionRatio +
        f.ring.extensionRatio +
        f.pinky.extensionRatio) /
      5;
    return { matched: true, score };
  },

  // ROCK_ON: indicador e mínimo estendidos, médio e anelar flexionados
  [BUILT_IN_GESTURES.ROCK_ON]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      f.pinky.extended &&
      !f.middle.extended &&
      !f.ring.extended;

    if (!matched) return { matched: false, score: 0 };
    const score = (f.index.extensionRatio + f.pinky.extensionRatio) / 2;
    return { matched: true, score };
  },

  // THUMBS_UP: polegar estendido apontando para cima, demais dedos flexionados
  [BUILT_IN_GESTURES.THUMBS_UP]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.thumb.extended &&
      f.thumb.primaryDirection === "UP" &&
      !f.index.extended &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.thumb.extensionRatio };
  },

  // THUMBS_DOWN: polegar estendido apontando para baixo, demais dedos flexionados
  [BUILT_IN_GESTURES.THUMBS_DOWN]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.thumb.extended &&
      f.thumb.primaryDirection === "DOWN" &&
      !f.index.extended &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.thumb.extensionRatio };
  },

  // THUMB_LEFT: polegar estendido apontando para a esquerda
  [BUILT_IN_GESTURES.THUMB_LEFT]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.thumb.extended &&
      f.thumb.primaryDirection === "LEFT" &&
      !f.index.extended &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.thumb.extensionRatio };
  },

  // THUMB_RIGHT: polegar estendido apontando para a direita
  [BUILT_IN_GESTURES.THUMB_RIGHT]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.thumb.extended &&
      f.thumb.primaryDirection === "RIGHT" &&
      !f.index.extended &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.thumb.extensionRatio };
  },

  // POINTING_UP: indicador estendido apontando para cima
  [BUILT_IN_GESTURES.POINTING_UP]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      f.index.primaryDirection === "UP" &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },

  // POINTING_DOWN: indicador estendido apontando para baixo
  [BUILT_IN_GESTURES.POINTING_DOWN]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      f.index.primaryDirection === "DOWN" &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },

  // POINTING_LEFT: indicador estendido apontando para a esquerda
  [BUILT_IN_GESTURES.POINTING_LEFT]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      f.index.primaryDirection === "LEFT" &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },

  // POINTING_RIGHT: indicador estendido apontando para a direita
  [BUILT_IN_GESTURES.POINTING_RIGHT]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      f.index.extended &&
      f.index.primaryDirection === "RIGHT" &&
      !f.middle.extended &&
      !f.ring.extended &&
      !f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    return { matched: true, score: f.index.extensionRatio };
  },

  // OK_SIGN: contato entre indicador e polegar com os demais 3 dedos estendidos
  [BUILT_IN_GESTURES.OK_SIGN]: (ctx) => {
    const f = ctx.features.fingers;
    const matched =
      ctx.features.okContact &&
      f.middle.extended &&
      f.ring.extended &&
      f.pinky.extended;

    if (!matched) return { matched: false, score: 0 };
    const contactScore = Math.max(0, 1 - ctx.features.pinchDistance / 0.28);
    const fingersScore =
      (f.middle.extensionRatio + f.ring.extensionRatio + f.pinky.extensionRatio) / 3;
    const score = contactScore * 0.5 + fingersScore * 0.5;

    return {
      matched: true,
      score,
      data: {
        pinchDistance: ctx.features.pinchDistance,
        contact: true,
      },
    };
  },

  // PINCH: aproximação entre indicador e polegar independente dos demais dedos
  [BUILT_IN_GESTURES.PINCH]: (ctx) => {
    if (!ctx.features.isPinching) return { matched: false, score: 0 };

    return {
      matched: true,
      score: ctx.features.pinchIntensity,
      data: {
        pinchDistance: ctx.features.pinchDistance,
        pinchIntensity: ctx.features.pinchIntensity,
      },
    };
  },

  // UNKNOWN: placeholder, manipulado dinamicamente caso nenhuma pose seja detectada
  [BUILT_IN_GESTURES.UNKNOWN]: () => ({ matched: false, score: 0 }),

  // Swipes são dinâmicos e tratados no SwipeTracker
  [BUILT_IN_GESTURES.SWIPE_LEFT]: null,
  [BUILT_IN_GESTURES.SWIPE_RIGHT]: null,
  [BUILT_IN_GESTURES.SWIPE_UP]: null,
  [BUILT_IN_GESTURES.SWIPE_DOWN]: null,
};
