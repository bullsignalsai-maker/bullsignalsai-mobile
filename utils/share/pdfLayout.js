export function drawMultilineText(
  page,
  text,
  font,
  size,
  x,
  y,
  maxWidth,
  color
) {
  const lineHeight = size + 4;
  const words = String(text).replace(/\n+/g, " ").split(" ");
  let line = "";

  words.forEach(word => {
    const test = line + word + " ";
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      page.drawText(line.trim(), { x, y, size, color });
      y -= lineHeight;
      line = word + " ";
    } else {
      line = test;
    }
  });

  if (line.trim()) {
    page.drawText(line.trim(), { x, y, size, color });
    y -= lineHeight;
  }

  return y;
}
