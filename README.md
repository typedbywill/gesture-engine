# GestureEngine — SDK de Gestos em TypeScript

SDK agnóstico de framework para transformar gestos manuais em eventos estritamente tipados.

- **No Navegador (`gesture-engine/browser`)**: Captura contínua de câmera via `getUserMedia` e inferência com MediaPipe HandLandmarker.
- **No Node.js (`gesture-engine/core`)**: O mesmo núcleo de regras e tracking processa landmarks normalizados oriundos de fontes externas (sockets, arquivos, streams, pipelines de visão computacional). O módulo `core` não possui dependência de DOM nem carrega MediaPipe.

---

## 📦 Estrutura do Workspace

Este repositório é configurado como um monorepo `pnpm`:

```text
gesture-engine/
├── packages/
│   └── gesture-engine/       # Pacote principal da biblioteca
│       ├── src/
│       │   ├── core/         # Núcleo puro em TS (regras, tracking, estabilizador)
│       │   └── browser/      # Adaptador de câmera e pipeline MediaPipe
│       └── tests/            # Testes automatizados com Vitest
└── apps/
    └── playground/           # Aplicação web Vite para testes manuais e demonstração
```

Subpath exports disponíveis:
- `gesture-engine`: exporta API completa (core + browser).
- `gesture-engine/core`: exporta apenas o núcleo (seguro para Node.js e ambientes sem DOM).
- `gesture-engine/browser`: exporta a fábrica de navegador, adaptador de câmera e pipeline MediaPipe.

---

## 🚀 Instalação e Requisitos

### Instalação no Workspace Local

```bash
pnpm install
pnpm build
```

### Requisitos de Câmera no Navegador
Para acessar a câmera via `navigator.mediaDevices.getUserMedia`, os navegadores exigem um **Contexto Seguro** (**HTTPS** ou `http://localhost` / `http://127.0.0.1`).

---

## 🌐 Uso no Navegador

```ts
import { createBrowserGestureEngine } from "gesture-engine/browser";

const videoElement = document.getElementById("webcam") as HTMLVideoElement;

// 1. Cria a instância do motor para navegador
const engine = createBrowserGestureEngine({
  video: videoElement,
  maxHands: 2,
  gestures: ["OPEN_PALM", "PINCH", "SWIPE_LEFT", "SWIPE_RIGHT"],
  stabilizationTimeMs: 150, // Confirmação após 150ms contínuos
  absenceTimeoutMs: 250,     // Tolerância antes de declarar mão perdida
  mirrored: true,            // Inverte swipes para corresponder à visão selfie
  assets: {
    modelAssetPath: "/models/hand_landmarker.task",
    wasmRoot: "/mediapipe/wasm",
  },
});

// 2. Inscrição tipada em eventos
const unsubscribe = engine.on("gesture:detected", ({ gesture, handId, score }) => {
  console.log(`Gesto detectado: ${gesture} na mão ${handId} com score ${score}`);
});

engine.on("gesture:start", ({ gesture, handId }) => {
  console.log(`Gesto ${gesture} iniciado`);
});

engine.on("gesture:end", ({ gesture, duration }) => {
  console.log(`Gesto ${gesture} encerrou após ${duration}ms`);
});

engine.on("gesture:cancelled", ({ gesture, reason }) => {
  console.warn(`Gesto ${gesture} cancelado. Motivo: ${reason}`);
});

engine.on("camera:error", ({ code, message }) => {
  console.error(`Erro de câmera [${code}]: ${message}`);
});

// 3. Inicializa modelo e inicia captura
await engine.init();
await engine.start();

// 4. Seleção e troca de câmera
const cameras = await engine.listCameras();
if (cameras.length > 1) {
  await engine.switchCamera(cameras[1].deviceId);
}
```

---

## 🖥️ Uso no Node.js (Sem DOM)

No Node.js, importe de `gesture-engine/core`. O motor recebe landmarks normalizados (21 pontos MediaPipe com coordenadas `{ x, y, z }` entre 0 e 1):

```ts
import { GestureEngine, BUILT_IN_GESTURES } from "gesture-engine/core";

const engine = new GestureEngine({
  maxHands: 2,
  stabilizationTimeMs: 150,
});

engine.on("gesture:detected", ({ gesture, handId, score }) => {
  console.log(`[Node.js] Gesto detectado: ${gesture} (Mão: ${handId}, Score: ${score})`);
});

await engine.init();
await engine.start();

// Processamento de frame recebido de socket/stream
const frameResult = engine.processFrame({
  timestamp: Date.now(),
  hands: [
    {
      landmarks: [
        { x: 0.5, y: 0.7, z: 0 }, // 0: Wrist
        // ... 21 landmarks
      ],
      handedness: "Right",
      confidence: 0.95,
    },
  ],
});

console.log("Mãos rastreadas:", frameResult.trackedHands);
console.log("Gestos ativos:", frameResult.activeGestures);
```

---

## ✋ Gestos Embutidos (`BUILT_IN_GESTURES`)

O SDK inclui 24 gestos embutidos:

| Constante | Descrição | Critérios Principais |
| :--- | :--- | :--- |
| `OPEN_PALM` | Palma aberta | Todos os 5 dedos estendidos |
| `CLOSED_FIST` | Punho fechado | Todos os dedos flexionados contra a palma |
| `NUMBER_ONE` | Número 1 | Apenas o indicador estendido |
| `NUMBER_TWO` | Número 2 | Indicador e médio estendidos |
| `NUMBER_THREE` | Número 3 | Indicador, médio e anelar estendidos |
| `NUMBER_FOUR` | Número 4 | 4 dedos estendidos (sem polegar) |
| `NUMBER_FIVE` | Número 5 | 5 dedos estendidos |
| `VICTORY` | Sinal de Vitória / Paz | Indicador e médio em formato "V" (separaçāo angular) |
| `ROCK_ON` | Sinal do Rock | Indicador e mínimo estendidos, médio e anelar recolhidos |
| `THUMBS_UP` | Polegar para cima | Polegar estendido apontando para cima, demais dedos recolhidos |
| `THUMBS_DOWN` | Polegar para baixo | Polegar estendido apontando para baixo, demais dedos recolhidos |
| `THUMB_LEFT` | Polegar para esquerda | Polegar estendido apontando para esquerda, demais recolhidos |
| `THUMB_RIGHT` | Polegar para direita | Polegar estendido apontando para direita, demais recolhidos |
| `POINTING_UP` | Indicador para cima | Indicador estendido apontando para cima |
| `POINTING_DOWN` | Indicador para baixo | Indicador estendido apontando para baixo |
| `POINTING_LEFT` | Indicador para esquerda | Indicador estendido apontando para esquerda |
| `POINTING_RIGHT` | Indicador para direita | Indicador estendido apontando para direita |
| `OK_SIGN` | Sinal de OK | Contato próximo entre polegar e indicador + 3 dedos estendidos |
| `PINCH` | Gesto de Pinça | Aproximação entre polegar e indicador (independe dos outros dedos) |
| `SWIPE_LEFT` | Deslize para esquerda | Deslocamento dinâmico horizontal da palma |
| `SWIPE_RIGHT` | Deslize para direita | Deslocamento dinâmico horizontal da palma |
| `SWIPE_UP` | Deslize para cima | Deslocamento dinâmico vertical da palma |
| `SWIPE_DOWN` | Deslize para baixo | Deslocamento dinâmico vertical da palma |
| `UNKNOWN` | Desconhecido | Mão rastreada sem pose estática reconhecida |

> **Poses Simultâneas**: `NUMBER_TWO` e `VICTORY` podem ficar ativos juntos quando as condições geométricas de ambos são satisfeitas.

---

## ⚡ Ciclo de Vida e Eventos (`GESTURE_EVENTS`)

```text
[ Entrada da Mão ] ──> hand:detected
       │
       ▼ (a cada frame)
  hand:tracking
       │
       ▼ (pose mantida por 150ms)
gesture:detected (1x) ──> gesture:start (1x)
       │
       ▼ (frames seguintes)
 gesture:update
       │
  ┌────┴───────────────────────────┐
  ▼ (150ms sem correspondência)    ▼ (interrupção forçada)
gesture:end                   gesture:cancelled
```

### Eventos Disponíveis:
- `ready`: emitido após `init()` com sucesso.
- `hand:detected`: emitido quando uma mão é detectada na cena.
- `hand:tracking`: emitido a cada frame com landmarks e features derivadas de cada mão rastreada.
- `hand:lost`: emitido após o período de tolerância de ausência (`absenceTimeoutMs`).
- `gesture:detected`: emitido uma única vez ao confirmar estabilização de 150ms (ou na confirmação de swipes).
- `gesture:start`: emitido imediatamente após `gesture:detected`.
- `gesture:update`: emitido em cada frame enquanto a pose permanecer ativa.
- `gesture:end`: emitido após 150ms sem correspondência.
- `gesture:cancelled`: emitido em interrupções (motivos: `hand_lost`, `camera_switch`, `recognition_paused`, `recognizer_unregistered`, `engine_stopped`, `engine_destroyed`).
- `camera:error`: emitido em falhas no subsistema de câmera (`CAMERA_PERMISSION_DENIED`, `CAMERA_NOT_FOUND`, etc.).
- `error`: emitido para erros gerais e falhas em callbacks de gestos customizados.

---

## 🛠️ Registro de Gestos Customizados

Você pode registrar gestos customizados com callbacks síncronos. Eles participam do mesmo pipeline de estabilização e emitem os mesmos eventos:

```ts
engine.registerGesture({
  name: "I_LOVE_YOU",
  description: "Sinal de I Love You em Libras / ASL",
  recognize: (ctx) => {
    const f = ctx.features.fingers;

    // Polegar, indicador e mínimo estendidos; médio e anelar flexionados
    const matched =
      f.thumb.extended &&
      f.index.extended &&
      f.pinky.extended &&
      !f.middle.extended &&
      !f.ring.extended;

    return {
      matched,
      score: 0.95,
      data: { sign: "ILY" },
    };
  },
});
```

---

## 🗄️ Hospedagem dos Arquivos Estáticos (MediaPipe Model & WASM)

Para funcionamento em produção no navegador, sirva os seguintes arquivos em seu servidor estático / CDN:

1. **Modelo**: `hand_landmarker.task` (~7.5 MB)
2. **WASM**: arquivos da pasta `@mediapipe/tasks-vision/wasm` (`vision_wasm_internal.wasm`, `vision_wasm_internal.js`, etc.)

Configure os caminhos na inicialização:

```ts
const engine = createBrowserGestureEngine({
  assets: {
    modelAssetPath: "https://seu-cdn.com/models/hand_landmarker.task",
    wasmRoot: "https://seu-cdn.com/mediapipe/wasm",
  },
});
```

---

## 🎮 Playground Web (Vite)

O repositório inclui um playground completo com:
- Preview com desenho dos 21 landmarks, conexões ósseas e centro da palma.
- Alternância entre Câmera Real e **Mídia Simulada** (permite testar todos os gestos mesmo sem webcam).
- Seleção e troca de câmeras.
- Sliders para controle dinâmico de tempo de estabilização, tolerância de ausência e cooldown.
- Editor interativo para criação e teste de gestos personalizados.
- Log de eventos em tempo real com auto-scroll.

Para executar o playground:

```bash
pnpm dev
```

Acesse em seu navegador: `http://localhost:3000`

---

## 🧪 Testes Automatizados

O SDK conta com uma suíte de 45 testes com Vitest cobrindo:
- Fixtures sintéticas de landmarks para todas as poses e ambas as mãos (esquerda/direita).
- Invariância de escala e variações limítrofes.
- Detecção dinâmica de Swipes (4 direções, cooldown, espelhamento, timestamps inválidos).
- Rastreamento multi-mãos com IDs estáveis e retenção contra perda temporária.
- Gestos simultâneos e ciclo de vida temporal (estabilização, updates, tolerância de término, motivos de cancelamento).
- Gestos customizados (rejeição de nomes duplicados, isolamento de falhas).
- Mocks completos de câmera (`getUserMedia`, troca de câmera, liberação de recursos).
- Importação do core em Node.js puro sem variáveis globais de DOM.

```bash
pnpm test
```
