export function getBoxFaceUvScales({
  width = 1,
  height = 1,
  depth = 1,
  textureScale = 1,
}) {
  const scale = Math.max(0.001, Number(textureScale) || 1);

  return [
    [depth / scale, height / scale],
    [depth / scale, height / scale],
    [width / scale, depth / scale],
    [width / scale, depth / scale],
    [width / scale, height / scale],
    [width / scale, height / scale],
  ];
}
