// Shared normalized pointer-to-value mapping. Quantization stays in the control model.
export function sliderValue(definition, x, start=80, width=864) {
  if(!Number.isFinite(x)||!Number.isFinite(width)||width<=0)return undefined;
  return definition.min+Math.max(0,Math.min(1,(x-start)/width))*(definition.max-definition.min);
}
