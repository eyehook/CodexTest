import {Group,Box3,Vector3,Sphere} from '../../shared/vendor/three-r180/three.module.js';
// A garden-level hierarchy complements each plant's exact component picker.
export class GardenPicker {
 constructor(){this.group=new Group();this.group.matrixAutoUpdate=false;this.root=null;this.stack=[];this.group.raycast=(raycaster,hits)=>{const stack=this.stack;stack.length=0;if(this.root)stack.push(this.root);while(stack.length){const n=stack.pop();if(!raycaster.ray.intersectsBox(n.box))continue;if(n.items){for(const item of n.items)if(raycaster.ray.intersectsBox(item.box))raycaster.intersectObject(item.group,true,hits);}else stack.push(n.left,n.right);}return false;};}
 rebuild(instances){
  const items=[];
  for(const plant of instances){const group=plant.visual.group;group.updateWorldMatrix(true,false);const sphere=new Sphere(new Vector3(),group.userData.pickRadius).applyMatrix4(group.matrixWorld);items.push({group,box:sphere.getBoundingBox(new Box3())});}
  const build=items=>{if(!items.length)return null;const box=new Box3();for(const item of items)box.union(item.box);if(items.length<=8)return {box,items};const size=box.getSize(new Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';items.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const mid=items.length>>1;return {box,left:build(items.slice(0,mid)),right:build(items.slice(mid))};};
  this.root=build(items);
 }
}
