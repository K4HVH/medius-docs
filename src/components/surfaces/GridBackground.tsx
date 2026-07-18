import { Component, onMount, onCleanup } from 'solid-js';
import { getCSSVariable } from '../../utils/cssVariables';

interface GridBackgroundProps {
  gridSize?: number;
  gridColor?: string;
}

export const GridBackground: Component<GridBackgroundProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;

  const gridSize = () => props.gridSize ?? 10;
  const gridColor = () => props.gridColor ?? getCSSVariable('--color-gray-800');

  const resizeCanvas = () => {
    if (!canvasRef) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasRef.getBoundingClientRect();

    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;

    const ctx = canvasRef.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawGrid(ctx, rect.width, rect.height);
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const size = gridSize();
    const color1 = gridColor();
    const color2 = getCSSVariable('--color-blue-950');

    if (!color1 || !color2) return;

    ctx.imageSmoothingEnabled = false;

    const gradient = ctx.createLinearGradient(width * 0.65, height * 0.1, width * 0.35, height * 0.9);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    for (let x = 0; x <= width; x += size) {
      const pixelX = Math.floor(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pixelX, 0);
      ctx.lineTo(pixelX, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += size) {
      const pixelY = Math.floor(y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, pixelY);
      ctx.lineTo(width, pixelY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  };

  onMount(() => {
    if (!canvasRef) return;

    resizeCanvas();

    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener('resize', handleResize);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
    });
  });

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        'z-index': 0,
        'pointer-events': 'none',
      }}
    />
  );
};
