// Uniform allowed hue arc: exclude yellow-green through green/teal (70–170°).
// Mapping one existing PRNG sample preserves the geometry random sequence.
export function flowerHue(sample){const degrees=sample*260;return (degrees<70?degrees:degrees+100)/360;}
