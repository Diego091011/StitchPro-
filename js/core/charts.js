/** Sparkline suave con relleno degradado. */
export function spark(c, data, col) {
  const r = devicePixelRatio || 1, w = (c.width = c.clientWidth * r), h = (c.height = c.clientHeight * r), x = c.getContext('2d');
  if (!w) return;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 6 * r - ((v - min) / (max - min || 1)) * (h - 16 * r)]);
  x.beginPath(); x.moveTo(...pts[0]);
  pts.slice(1).forEach(([px, py], i) => { const [qx, qy] = pts[i]; x.quadraticCurveTo(qx, qy, (qx + px) / 2, (qy + py) / 2); });
  x.lineTo(...pts.at(-1));
  x.strokeStyle = col; x.lineWidth = 2 * r; x.shadowColor = col; x.shadowBlur = 10 * r; x.stroke();
  x.shadowBlur = 0; x.lineTo(w, h); x.lineTo(0, h); x.closePath();
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col + '40'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fill();
}
