'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

/**
 * Minimal drawn-signature pad. The PNG data URL is posted with the form as
 * `signature_data`; the server stores it with the agreement version, a content
 * hash, the signatory name, the IP and the user agent.
 */
export function SignaturePad({
  hint,
  clearLabel,
  name = 'signature_data',
}: {
  hint: string;
  clearLabel: string;
  name?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c1c1c';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = position(event);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !last.current) return;
    const point = position(event);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    last.current = point;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas) setValue(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setValue('');
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          border: '2px solid var(--ink)',
          borderRadius: 'var(--radius-sm)',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          width={900}
          height={260}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label={hint}
          role="img"
        />
      </div>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <span className="small muted">{hint}</span>
        <button className="btn sm ghost" type="button" onClick={clear}>
          <Eraser size={14} /> {clearLabel}
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
