/**
 * 点击爆发粒子引擎
 * 自研轻量级 Canvas 粒子系统，专为"点击触发"特效设计
 * 支持多种粒子形状、边缘柔化、衰减曲线、大小模式、颜色渐变
 */

/** 粒子形状 */
export type ParticleShape = 'circle' | 'star' | 'heart' | 'square' | 'diamond' | 'spark' | 'ring';

/** 生命衰减曲线 */
export type LifeCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'pulse';

/** 大小衰减模式 */
export type SizeMode = 'shrink' | 'grow' | 'constant' | 'pop';

/** 单个粒子 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  /** 颜色渐变终点色（可选） */
  colorEnd: string | null;
  shape: ParticleShape;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  friction: number;
  glow: boolean;
  trail: boolean;
  /** 边缘柔化度 0~1 */
  softness: number;
  /** 衰减曲线 */
  lifeCurve: LifeCurve;
  /** 大小模式 */
  sizeMode: SizeMode;
  /** 尾迹历史位置 */
  history: Array<{ x: number; y: number; opacity: number }>;
  /** 可选粒子贴图 */
  texture: HTMLImageElement | null;
}

/** 爆发配置 */
export interface BurstConfig {
  /** 每次点击产生的粒子数 */
  count: number;
  /** 粒子形状 */
  shapes: ParticleShape[];
  /** 颜色列表 */
  colors: string[];
  /** 粒子生命周期范围 (秒) */
  life: [number, number];
  /** 粒子大小范围 */
  size: [number, number];
  /** 初始速度范围 */
  speed: [number, number];
  /** 重力 (0 = 无重力) */
  gravity: number;
  /** 摩擦力 (0~1, 1=无摩擦) */
  friction: number;
  /** 发射角度范围 (弧度，默认全方向) */
  angleRange?: [number, number];
  /** 是否有发光效果 */
  glow?: boolean;
  /** 是否有尾迹 */
  trail?: boolean;
  /** 二次爆炸 (模拟烟花) */
  secondaryBurst?: Omit<BurstConfig, 'secondaryBurst'>;

  // ========== 新增样式参数 ==========

  /** 边缘柔化度 0~1，0=硬边实心，1=完全径向渐变柔化 */
  softness?: number;
  /** 生命衰减曲线 */
  lifeCurve?: LifeCurve;
  /** 大小衰减模式 */
  sizeMode?: SizeMode;
  /** 颜色渐变：粒子生命期内从 colors 中选的颜色渐变到此 endColor */
  colorGradient?: string;
  /** 粒子贴图路径，来自素材库 */
  texturePaths?: string[];
}

export type BurstOverlayKind = 'flash' | 'spotlight' | 'curtain' | 'speedLines' | 'impactLines';

interface BurstOverlay {
  kind: BurstOverlayKind;
  life: number;
  maxLife: number;
  color: string;
}

// ============================================================
// 工具函数
// ============================================================

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const imageCache = new Map<string, HTMLImageElement>();

function loadTexture(src: string): HTMLImageElement {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  imageCache.set(src, image);
  return image;
}

/**
 * 解析 hex/named 颜色为 RGB
 * 支持 #RGB, #RRGGBB 格式
 */
function parseColor(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}

/**
 * RGB 颜色线性插值
 */
function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = parseColor(c1);
  const [r2, g2, b2] = parseColor(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

/**
 * 应用生命衰减曲线
 * @param progress 0~1，1=刚出生，0=即将消亡
 * @returns 0~1 不透明度因子
 */
function applyLifeCurve(progress: number, curve: LifeCurve): number {
  switch (curve) {
    case 'linear':
      return progress;
    case 'easeOut':
      // 快闪慢消：一开始高透明度维持较久，最后加速消失
      return 1 - Math.pow(1 - progress, 3);
    case 'easeIn':
      // 慢闪快消：迅速变暗
      return Math.pow(progress, 3);
    case 'easeInOut':
      // 缓入缓出：柔和的 S 曲线
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    case 'pulse':
      // 脉冲闪烁：周期性明暗
      return 0.3 + 0.7 * Math.abs(Math.sin(progress * Math.PI * 3));
    default:
      return progress;
  }
}

/**
 * 应用大小衰减模式
 * @param progress 0~1，1=刚出生，0=即将消亡
 * @param baseSize 基础大小
 * @returns 当前帧的实际大小
 */
function applySizeMode(progress: number, baseSize: number, mode: SizeMode): number {
  switch (mode) {
    case 'shrink':
      // 逐渐缩小到 30%
      return baseSize * (0.3 + progress * 0.7);
    case 'grow':
      // 从 20% 长到 100% 再略微回缩
      return baseSize * (0.2 + (1 - progress) * 0.8);
    case 'constant':
      // 保持大小不变
      return baseSize;
    case 'pop':
      // 先膨胀到 140% 再迅速缩小消失（爆炸冲击波感）
      if (progress > 0.7) {
        // 前 30% 生命：快速膨胀
        const t = (1 - progress) / 0.3; // 0→1
        return baseSize * (1 + t * 0.4);
      }
      // 后 70% 生命：缩小
      return baseSize * 1.4 * (progress / 0.7);
    default:
      return baseSize * (0.3 + progress * 0.7);
  }
}

// ============================================================
// 形状绘制函数
// ============================================================

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  const points = 5;
  const outerR = size;
  const innerR = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2 + rotation;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const s = size * 0.6;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.bezierCurveTo(0, 0, -s, 0, -s, s * 0.3);
  ctx.bezierCurveTo(-s, s * 0.7, 0, s, 0, s * 1.3);
  ctx.bezierCurveTo(0, s, s, s * 0.7, s, s * 0.3);
  ctx.bezierCurveTo(s, 0, 0, 0, 0, s * 0.3);
  ctx.closePath();
  ctx.restore();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.6, 0);
  ctx.closePath();
  ctx.restore();
}

function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(0, size);
  ctx.restore();
}

// ============================================================
// 粒子渲染
// ============================================================

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const progress = p.life / p.maxLife; // 1=刚出生，0=将死

  // 应用衰减曲线计算不透明度
  const opacity = applyLifeCurve(progress, p.lifeCurve);

  // 应用大小模式
  const currentSize = applySizeMode(progress, p.size, p.sizeMode);

  // 应用颜色渐变
  let currentColor = p.color;
  if (p.colorEnd) {
    // progress 1→0，所以 t = 1 - progress 表示从起始色到终点色
    currentColor = lerpColor(p.color, p.colorEnd, 1 - progress);
  }

  ctx.save();
  ctx.globalAlpha = opacity;

  // 发光效果
  if (p.glow) {
    ctx.shadowColor = currentColor;
    ctx.shadowBlur = currentSize * 3;
  }

  // 绘制尾迹
  if (p.trail && p.history.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize * 0.3;
    ctx.lineCap = 'round';
    for (let i = 0; i < p.history.length; i++) {
      const h = p.history[i];
      ctx.globalAlpha = h.opacity * opacity * 0.4;
      if (i === 0) ctx.moveTo(h.x, h.y);
      else ctx.lineTo(h.x, h.y);
    }
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = opacity;
  }

  ctx.fillStyle = currentColor;
  ctx.strokeStyle = currentColor;

  if (p.texture?.complete && p.texture.naturalWidth > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    const drawSize = currentSize * 2;
    ctx.drawImage(p.texture, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();
    ctx.restore();
    return;
  }

  // ---- 边缘柔化处理 ----
  // 对 circle 和 ring 形状使用径向渐变实现柔化
  const useSoftFill = p.softness > 0 && (p.shape === 'circle' || p.shape === 'star');

  if (useSoftFill && p.shape === 'circle') {
    // 径向渐变柔化圆形
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentSize);
    gradient.addColorStop(0, currentColor);
    gradient.addColorStop(Math.max(0, 1 - p.softness), currentColor);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 其他形状：通过多层半透明叠加模拟边缘柔化
    switch (p.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'star':
        if (p.softness > 0) {
          // 柔化星星：先画一层更大的低透明度底层
          ctx.globalAlpha = opacity * p.softness * 0.3;
          const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentSize * 1.8);
          glowGrad.addColorStop(0, currentColor);
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentSize * 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = opacity;
          ctx.fillStyle = currentColor;
        }
        drawStar(ctx, p.x, p.y, currentSize, p.rotation);
        ctx.fill();
        break;

      case 'heart':
        drawHeart(ctx, p.x, p.y, currentSize, p.rotation);
        ctx.fill();
        break;

      case 'square':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-currentSize / 2, -currentSize / 2, currentSize, currentSize);
        ctx.restore();
        break;

      case 'diamond':
        drawDiamond(ctx, p.x, p.y, currentSize, p.rotation);
        ctx.fill();
        break;

      case 'spark':
        ctx.lineWidth = Math.max(1, currentSize * 0.3);
        drawSpark(ctx, p.x, p.y, currentSize * 1.5, p.rotation);
        ctx.stroke();
        break;

      case 'ring':
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1, currentSize * 0.25);
        ctx.stroke();
        break;
    }
  }

  ctx.restore();
}

// ============================================================
// 爆发引擎
// ============================================================

export class BurstEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private overlays: BurstOverlay[] = [];
  private rafId: number | null = null;
  private lastTime = 0;
  private resizeHandler = () => this.resizeCanvas();
  private pendingSecondary: Array<{
    x: number;
    y: number;
    config: BurstConfig;
    delay: number;
  }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeHandler);
  }

  /** 调整 Canvas 分辨率 */
  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 在指定位置触发爆发 */
  burst(x: number, y: number, config: BurstConfig) {
    const angleMin = config.angleRange?.[0] ?? 0;
    const angleMax = config.angleRange?.[1] ?? Math.PI * 2;

    for (let i = 0; i < config.count; i++) {
      const angle = rand(angleMin, angleMax);
      const speed = rand(config.speed[0], config.speed[1]);
      const life = rand(config.life[0], config.life[1]);
      const texture = config.texturePaths?.length ? loadTexture(randItem(config.texturePaths)) : null;

      const particle: Particle = {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rand(config.size[0], config.size[1]),
        life,
        maxLife: life,
        color: randItem(config.colors),
        colorEnd: config.colorGradient ?? null,
        shape: randItem(config.shapes),
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-5, 5),
        gravity: config.gravity,
        friction: config.friction,
        glow: config.glow ?? false,
        trail: config.trail ?? false,
        softness: config.softness ?? 0,
        lifeCurve: config.lifeCurve ?? 'easeOut',
        sizeMode: config.sizeMode ?? 'shrink',
        history: [],
        texture
      };

      this.particles.push(particle);
    }

    // 如果有二次爆炸（烟花效果），设置延迟触发
    if (config.secondaryBurst) {
      this.pendingSecondary.push({
        x, y, config: { ...config.secondaryBurst } as BurstConfig,
        delay: rand(0.3, 0.6)
      });
    }

    // 确保动画循环在运行
    if (!this.rafId) {
      this.lastTime = performance.now();
      this.animate();
    }
  }

  /** 播放可录制的画布叠加层 */
  overlay(kind: BurstOverlayKind, durationMs: number, color = '#ffffff') {
    const life = Math.max(0.1, durationMs / 1000);
    this.overlays.push({ kind, life, maxLife: life, color });

    if (!this.rafId) {
      this.lastTime = performance.now();
      this.animate();
    }
  }

  /** 动画循环 */
  private animate = () => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    // 更新和绘制粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // 保存尾迹
      if (p.trail) {
        p.history.push({ x: p.x, y: p.y, opacity: p.life / p.maxLife });
        if (p.history.length > 8) p.history.shift();
      }

      // 物理更新
      p.vy += p.gravity * dt * 300;
      p.vx *= Math.pow(p.friction, dt * 60);
      p.vy *= Math.pow(p.friction, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      drawParticle(this.ctx, p);
    }

    // 处理二次爆炸
    for (let i = this.pendingSecondary.length - 1; i >= 0; i--) {
      this.pendingSecondary[i].delay -= dt;
      if (this.pendingSecondary[i].delay <= 0) {
        const s = this.pendingSecondary.splice(i, 1)[0];
        this.burst(s.x, s.y, s.config);
      }
    }

    // 更新并绘制叠加层，保证 GIF/PNG 序列能录到这些效果
    for (let i = this.overlays.length - 1; i >= 0; i--) {
      const overlay = this.overlays[i];
      overlay.life -= dt;
      if (overlay.life <= 0) {
        this.overlays.splice(i, 1);
        continue;
      }
      this.drawOverlay(overlay);
    }

    // 如果还有粒子，继续动画
    if (this.particles.length > 0 || this.pendingSecondary.length > 0 || this.overlays.length > 0) {
      this.rafId = requestAnimationFrame(this.animate);
    } else {
      this.rafId = null;
    }
  };

  private drawOverlay(overlay: BurstOverlay) {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const progress = 1 - overlay.life / overlay.maxLife;
    const fade = Math.sin(Math.PI * Math.min(1, progress));

    this.ctx.save();

    if (overlay.kind === 'flash') {
      this.ctx.globalAlpha = fade * 0.85;
      this.ctx.fillStyle = overlay.color;
      this.ctx.fillRect(0, 0, width, height);
    } else if (overlay.kind === 'spotlight') {
      this.ctx.globalAlpha = 0.42 * Math.sin(Math.PI * Math.min(1, progress));
      this.ctx.fillStyle = overlay.color;
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.globalCompositeOperation = 'destination-out';
      const radius = Math.min(width, height) * (0.18 + 0.1 * Math.sin(progress * Math.PI));
      const gradient = this.ctx.createRadialGradient(width / 2, height / 2, radius * 0.25, width / 2, height / 2, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (overlay.kind === 'curtain') {
      this.ctx.globalAlpha = 0.82;
      this.ctx.fillStyle = overlay.color;
      const half = width / 2;
      const cover = progress < 0.5 ? progress / 0.5 : 1 - (progress - 0.5) / 0.5;
      this.ctx.fillRect(0, 0, half * cover, height);
      this.ctx.fillRect(width - half * cover, 0, half * cover, height);
    } else if (overlay.kind === 'speedLines') {
      this.ctx.globalAlpha = (1 - progress) * 0.75;
      this.ctx.strokeStyle = overlay.color;
      this.ctx.lineWidth = 3;
      for (let i = 0; i < 26; i++) {
        const y = ((i * 53) % Math.max(1, height)) + Math.sin(i) * 8;
        const side = i % 2 === 0 ? -1 : 1;
        const x1 = side < 0 ? 0 : width;
        const x2 = width / 2 + side * (40 + (i % 5) * 24);
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y);
        this.ctx.lineTo(x2, y - 30 + (i % 7) * 10);
        this.ctx.stroke();
      }
    } else if (overlay.kind === 'impactLines') {
      this.ctx.globalAlpha = (1 - progress) * 0.85;
      this.ctx.strokeStyle = overlay.color;
      this.ctx.lineWidth = 3;
      const cx = width / 2;
      const cy = height * 0.44;
      const inner = Math.min(width, height) * (0.12 + progress * 0.05);
      const outer = Math.max(width, height) * 0.7;
      for (let i = 0; i < 34; i++) {
        const angle = (i / 34) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        this.ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  /** 清除所有粒子 */
  clear() {
    this.particles = [];
    this.overlays = [];
    this.pendingSecondary = [];
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
  }

  /** 销毁引擎 */
  destroy() {
    this.clear();
    window.removeEventListener('resize', this.resizeHandler);
  }
}
