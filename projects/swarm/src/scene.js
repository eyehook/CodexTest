import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {config} from './config.js';
import {fitDesktop} from './viewer.js';
export function createScene(){
 const scene=new T.Scene();scene.background=new T.Color(0x888888);
 const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.05,400);fitDesktop(camera,config.bounds);
 const rig=new T.Group();scene.add(rig);rig.add(camera);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');document.body.append(renderer.domElement);
 scene.add(new T.HemisphereLight(0xffffff,0x555555,2));const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(10,20,10);scene.add(sun);
 // One repeating 2×2 tile; each square is exactly 3 feet (0.9144 m).
 const tile=document.createElement('canvas');tile.width=128;tile.height=128;
 const ctx=tile.getContext('2d');
 ctx.fillStyle='#353535';ctx.fillRect(0,0,128,128);
 ctx.fillStyle='#3d3d3d';ctx.fillRect(0,0,64,64);ctx.fillRect(64,64,64,64);
 const groundMap=new T.CanvasTexture(tile);groundMap.colorSpace=T.SRGBColorSpace;
 groundMap.wrapS=groundMap.wrapT=T.RepeatWrapping;
 groundMap.repeat.setScalar(600/(2*0.9144));
 // Mipmaps blend distant checks to gray, reducing shimmer in the headset.
 groundMap.magFilter=T.NearestFilter;groundMap.minFilter=T.LinearMipmapLinearFilter;
 groundMap.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const ground=new T.Mesh(new T.PlaneGeometry(600,600),new T.MeshLambertMaterial({map:groundMap}));ground.rotation.x=-Math.PI/2;scene.add(ground);
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(!renderer.xr.isPresenting)fitDesktop(camera,config.bounds);renderer.setSize(innerWidth,innerHeight);});return {scene,camera,renderer,rig};
}
