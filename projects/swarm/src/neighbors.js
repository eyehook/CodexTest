// Isolated all-pairs search; replace with a spatial grid if counts grow.
// Caller-owned result avoids allocations, and all forces use the same frame state.
export function findNeighbors(boids, index, radius, result) {
  result.length = 0;
  const p = boids[index].position, r2 = radius * radius;
  for (let j = 0; j < boids.length; j++) {
    if (j !== index && p.distanceToSquared(boids[j].position) < r2) result.push(j);
  }
  return result;
}
