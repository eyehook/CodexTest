import * as THREE from '../../shared/vendor/three-r180/three.module.js';
export function createCockpit(){
 const group=new THREE.Group();
 const red=new THREE.MeshLambertMaterial({color:0xc54438,flatShading:true});
 const trim=new THREE.MeshLambertMaterial({color:0x222e36,flatShading:true});
 const black=new THREE.MeshLambertMaterial({color:0x121c23});
 const silver=new THREE.MeshLambertMaterial({color:0x9aa9a8,flatShading:true});
 function box(width,height,depth,x,y,z,material){const m=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);m.position.set(x,y,z);group.add(m);return m;}
 // Coordinates relative to the driver's initial eye pose, never attached to the head.
 box(1.85,.12,1.8,0,-.6,-2.05,red); // Long, visible hood.
 box(1.82,.22,.24,0,-.68,-2.92,red);
 box(.10,.015,1.65,-.62,-.532,-2.05,silver);
 box(.10,.015,1.65,.62,-.532,-2.05,silver);
 box(1.82,.28,.42,0,-.54,-1.02,trim);
 box(1.75,.035,.45,0,-.38,-1.02,black);
 box(.82,.13,.025,0,-.48,-.798,black);
 // Static dashboard accents, deliberately no score/speed display or HUD.
 for(const x of [-.24,.24])box(.2,.025,.01,x,-.48,-.78,silver);
 box(.14,.05,.01,0,-.48,-.78,red);
 box(.13,.62,1.75,-.94,-.65,-.35,red);box(.13,.62,1.75,.94,-.65,-.35,red);
 box(1.8,.07,1.5,0,-1.08,-.3,black);
 const wheelPivot=new THREE.Group();wheelPivot.position.set(0,-.37,-.62);wheelPivot.rotation.x=-.23;group.add(wheelPivot);
 const wheel=new THREE.Group();wheelPivot.add(wheel);
 wheel.add(new THREE.Mesh(new THREE.TorusGeometry(.215,.027,6,20),black));
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.055,8),trim);hub.rotation.x=Math.PI/2;wheel.add(hub);
 for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;const spoke=new THREE.Mesh(new THREE.BoxGeometry(.022,.16,.018),silver);spoke.position.set(Math.sin(angle)*.12,Math.cos(angle)*.12,0);spoke.rotation.z=-angle;wheel.add(spoke);}
 const column=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.4,8),trim);column.rotation.x=Math.PI/2;column.position.set(0,-.42,-.82);group.add(column);
 return {group,update(steer,dt){wheel.rotation.z+=(-steer*.65-wheel.rotation.z)*(1-Math.exp(-12*dt));}};
}
