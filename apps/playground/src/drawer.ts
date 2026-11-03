import type { HandTrackingEvent, Landmark3D } from "gesture-engine/core";

// Conexões padrão dos 21 landmarks MediaPipe
const CONNECTIONS: [number, number][] = [
  // Palma
  [0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [17, 0],
  // Polegar
  [1, 2], [2, 3], [3, 4],
  // Indicador
  [5, 6], [6, 7], [7, 8],
  // Médio
  [9, 10], [10, 11], [11, 12],
  // Anelar
  [13, 14], [14, 15], [15, 16],
  // Mínimo
  [17, 18], [18, 19], [19, 20],
];

const FINGERTIP_INDICES = new Set([4, 8, 12, 16, 20]);

export class LandmarkDrawer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível obter contexto 2D do Canvas");
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawHands(hands: HandTrackingEvent[], mirrored: boolean): void {
    this.clear();
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const hand of hands) {
      const isRight = hand.handedness === "Right";
      const boneColor = isRight ? "rgba(56, 189, 248, 0.75)" : "rgba(168, 85, 247, 0.75)";
      const jointColor = isRight ? "#38bdf8" : "#c084fc";
      const tipColor = isRight ? "#22d3ee" : "#f472b6";

      // Converte coordenadas normalizadas [0, 1] para pixels
      const points = hand.landmarks.map((p) => {
        const x = mirrored ? (1 - p.x) * w : p.x * w;
        const y = p.y * h;
        return { x, y };
      });

      // 1. Desenha as conexões (ossos)
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = "round";
      this.ctx.strokeStyle = boneColor;

      for (const [startIdx, endIdx] of CONNECTIONS) {
        const p1 = points[startIdx];
        const p2 = points[endIdx];
        if (!p1 || !p2) continue;

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
      }

      // 2. Desenha os nós das articulações
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const isTip = FINGERTIP_INDICES.has(i);

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, isTip ? 6 : 4, 0, Math.PI * 2);
        this.ctx.fillStyle = isTip ? tipColor : jointColor;
        this.ctx.fill();
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.stroke();
      }

      // 3. Desenha centro da palma
      const palmX = mirrored ? (1 - hand.features.palmCenter.x) * w : hand.features.palmCenter.x * w;
      const palmY = hand.features.palmCenter.y * h;

      this.ctx.beginPath();
      this.ctx.arc(palmX, palmY, 7, 0, Math.PI * 2);
      this.ctx.fillStyle = "#eab308";
      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.stroke();

      // 4. Badge com Hand ID e Handedness
      const wristPoint = points[0];
      if (wristPoint) {
        const label = `${hand.handedness} (${hand.handId})`;
        this.ctx.font = "bold 13px system-ui, sans-serif";
        const textWidth = this.ctx.measureText(label).width;

        const badgeX = wristPoint.x - textWidth / 2 - 8;
        const badgeY = wristPoint.y + 15;
        const badgeW = textWidth + 16;
        const badgeH = 22;

        this.ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        this.ctx.beginPath();
        this.ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
        this.ctx.fill();
        this.ctx.strokeStyle = jointColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillText(label, badgeX + 8, badgeY + 16);
      }
    }
  }
}
