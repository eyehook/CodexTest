import { Vector3 } from '../../../shared/vendor/three-r180/three.module.js';
import { Boid } from './Boid.js';
import { findNeighbors } from './neighbors.js';
export class Swarm {
  constructor(config, origin, random = Math.random) {
    this.config = config;
    this.boids = Array.from({length: config.beeCount}, () => new Boid(origin, random));
    this.neighbors = [];
    this.center = new Vector3(); this.heading = new Vector3();
    this.separate = new Vector3(); this.scratch = new Vector3();
  }
  steer(target, velocity, speed, force) {
    if (target.lengthSq() < 1e-10) return target.set(0,0,0);
    return target.setLength(speed).sub(velocity).clampLength(0, force);
  }
  update(dt, wasp) {
    const c = this.config;
    // Compute every acceleration before integrating any position or velocity.
    for (let i=0;i<this.boids.length;i++) {
      const b=this.boids[i], p=b.position, v=b.velocity, a=b.acceleration.set(0,0,0);
      const speed=c.maxSpeed*b.variation, force=c.maxForce*b.variation;
      const neighbors=findNeighbors(this.boids,i,Math.max(c.neighborRadius,c.separationRadius),this.neighbors);
      this.center.set(0,0,0); this.heading.set(0,0,0); this.separate.set(0,0,0);
      let count=0;
      for (const j of neighbors) {
        const other=this.boids[j], d2=p.distanceToSquared(other.position);
        if (d2<c.neighborRadius*c.neighborRadius) {
          this.center.add(other.position); this.heading.add(other.velocity); count++;
        }
        if (d2<c.separationRadius*c.separationRadius && d2>1e-10)
          this.separate.add(this.scratch.subVectors(p,other.position).divideScalar(d2));
      }
      if(count) {
        this.center.divideScalar(count).sub(p);
        a.addScaledVector(this.steer(this.center,v,speed,force),c.cohesion);
        this.heading.divideScalar(count);
        a.addScaledVector(this.steer(this.heading,v,speed,force),c.alignment);
      }
      a.addScaledVector(this.steer(this.separate,v,speed,force),c.separation);
      // Arrival reduces attraction near the leader, allowing separation to dominate.
      this.scratch.subVectors(wasp,p);
      const distance=this.scratch.length();
      a.addScaledVector(this.steer(this.scratch,v,speed*Math.min(1,distance/2),force),c.attraction);
      const bounds=c.bounds, margin=4;
      this.scratch.set(
        -Math.sign(p.x)*Math.max(0,Math.abs(p.x)-(bounds.x+2))/margin,
        Math.max(0,3-p.y)*1.5-Math.max(0,p.y-15)/margin,
        -Math.sign(p.z)*Math.max(0,Math.abs(p.z)-(bounds.z+2))/margin);
      a.addScaledVector(this.scratch,force*c.boundary).clampLength(0,force);
    }
    for(const b of this.boids) {
      b.velocity.addScaledVector(b.acceleration,dt).clampLength(0,c.maxSpeed*b.variation);
      b.position.addScaledVector(b.velocity,dt);
      // Last-resort ground safety, normally avoided by anticipatory steering.
      if(b.position.y<0.15) { b.position.y=0.15; b.velocity.y=Math.max(0,b.velocity.y); }
    }
  }
}
