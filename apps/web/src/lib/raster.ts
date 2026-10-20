/** SVG markup (with a viewBox) drawn as a PNG on white, `scale` times its size, and that size in CSS pixels. */
export async function svgToPng(svg: string, scale = 2): Promise<{ png: Blob; width: number; height: number } | null> {
  const box = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!box) return null;
  const [width, height] = [Number(box[1]), Number(box[2])];
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(width * scale), height: Math.round(height * scale) });
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    return png ? { png, width, height } : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
