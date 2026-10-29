import { Vector3 } from '../../../shared/vendor/three-r180/three.module.js';
export class Boid {
  constructor(origin, random = Math.random) {
    this.position = origin.clone().add(new Vector3((random()-.5)*4,(random()-.5)*3,(random()-.5)*4));
    this.velocity = new Vector3(random()-.5,random()-.5,random()-.5);
    this.acceleration = new Vector3();
    this.variation = 0.88 + random() * 0.24;
  }
}
