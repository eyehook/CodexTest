import * as T from '../../shared/vendor/three-r180/three.module.js';
import {C,RAILS} from './physics.mjs';
export function createView(scene){
  const table=new T.Group();scene.add(table);
  const mat=color=>new T.MeshStandardMaterial({color,roughness:.48,metalness:.15});
  const white=mat('#edf4ef'),navy=mat('#132f43'),blue=mat('#188ce8'),red=mat('#ee5165'),dark=mat('#18222c'),skin=mat('#f4c774');
  const box=(parent,w,h,d,x,y,z,m)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o;};
  const cylinder=(parent,r,h,x,y,z,m)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,32),m);o.position.set(x,y,z);parent.add(o);return o;};
  box(table,1.34,.26,2.56,0,-.19,0,navy);box(table,1.36,.035,2.58,0,-.08,0,blue);
  for(const x of [-.48,.48])for(const z of [-.95,.95])box(table,.12,.59,.14,x,-.56,z,navy);
  // The single procedural texture carries markings and air perforations.
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1536;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#eef4ef';ctx.fillRect(0,0,768,1536);ctx.fillStyle='#bbcec9';
  for(let y=12;y<1536;y+=18)for(let x=12;x<768;x+=18){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}
  ctx.lineWidth=6;ctx.strokeStyle='#e96677';ctx.beginPath();ctx.moveTo(0,768);ctx.lineTo(768,768);ctx.stroke();
  for(const [y,r,col] of [[768,120,'#e96677'],[140,155,'#e96677'],[1396,155,'#188ce8']]){ctx.strokeStyle=col;ctx.beginPath();ctx.arc(384,y,r,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#153e57';ctx.font='bold 29px sans-serif';ctx.textAlign='center';ctx.fillText('AIR / CLUB',384,1010);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  const shape=new T.Shape(),w=C.width/2,l=C.length/2,r=C.corner;
  shape.moveTo(-w+r,-l);shape.lineTo(w-r,-l);shape.quadraticCurveTo(w,-l,w,-l+r);shape.lineTo(w,l-r);shape.quadraticCurveTo(w,l,w-r,l);shape.lineTo(-w+r,l);shape.quadraticCurveTo(-w,l,-w,l-r);shape.lineTo(-w,-l+r);shape.quadraticCurveTo(-w,-l,-w+r,-l);
  const geo=new T.ShapeGeometry(shape,8),pos=geo.attributes.position,uv=geo.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+w)/C.width,(pos.getY(i)+l)/C.length);
  const surface=new T.Mesh(geo,new T.MeshStandardMaterial({map:tex,roughness:.36}));surface.rotation.x=-Math.PI/2;table.add(surface);
  for(const s of RAILS){const dx=s.bx-s.ax,dz=s.bz-s.az;const rail=box(table,Math.hypot(dx,dz)+.012,.065,.035,(s.ax+s.bx)/2,.025,(s.az+s.bz)/2,Math.abs(s.az+s.bz)<.1?white:(s.az+s.bz>0?blue:red));rail.rotation.y=-Math.atan2(dz,dx);}
  for(const z of [-1,1]){box(table,C.goal,.045,.18,0,-.015,z*1.29,dark);box(table,C.goal,.06,.025,0,.015,z*1.39,navy);}
  function makeMallet(material){const g=new T.Group();cylinder(g,C.mallet,.028,0,.018,0,material);cylinder(g,.026,.055,0,.055,0,material);cylinder(g,.033,.018,0,.087,0,material);table.add(g);return g;}
  const player=makeMallet(blue),enemy=makeMallet(red),puck=cylinder(table,C.puck,.012,0,.008,0,dark);
  cylinder(puck,.022,.001,0,.0065,0,skin);
  const scoreCanvas=document.createElement('canvas');scoreCanvas.width=1024;scoreCanvas.height=320;const sc=scoreCanvas.getContext('2d'),scoreTexture=new T.CanvasTexture(scoreCanvas);scoreTexture.colorSpace=T.SRGBColorSpace;
  const score=new T.Mesh(new T.PlaneGeometry(.85,.266),new T.MeshBasicMaterial({map:scoreTexture}));score.position.set(0,.33,-1.33);score.rotation.x=-.26;table.add(score);box(table,.9,.3,.06,0,.33,-1.42,navy);for(const x of [-.37,.37])box(table,.035,.32,.035,x,.1,-1.42,navy);
  const bot=new T.Group();bot.position.set(0,0,-1.68);table.add(bot);
  const body=cylinder(bot,.16,.38,0,.35,0,red);body.rotation.z=.07;
  const head=new T.Group();head.position.y=.68;bot.add(head);
  const skull=new T.Mesh(new T.IcosahedronGeometry(.225,1),skin);head.add(skull);
  for(const x of [-.078,.078]){const eye=new T.Mesh(new T.SphereGeometry(.045,12,8),white);eye.position.set(x,.025,.18);head.add(eye);const pupil=new T.Mesh(new T.SphereGeometry(.022,10,6),dark);pupil.position.set(x,.025,.216);head.add(pupil);}
  box(head,.08,.014,.018,0,-.075,.205,navy);
  const hat=cylinder(head,.24,.035,0,.19,0,blue);hat.rotation.z=-.12;
  const hand=new T.Mesh(new T.IcosahedronGeometry(.058,1),skin);table.add(hand);
  const floor=new T.Mesh(new T.CircleGeometry(12,64),mat('#c5d6d4'));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;scene.add(floor);
  const rug=new T.Mesh(new T.CircleGeometry(2.6,64),mat('#a2bdbc'));rug.rotation.x=-Math.PI/2;rug.position.y=-.003;scene.add(rug);
  let last='',lastPlayer=-1,lastEnemy=-1;
  function update(game,time,paused){
    table.position.y=game.height;player.position.set(game.player.x,0,game.player.z);enemy.position.set(game.enemy.x,0,game.enemy.z);puck.position.set(game.physics.puck.x,.008,game.physics.puck.z);puck.visible=game.state==='play'||game.state==='ready'||game.state==='serve';
    hand.position.set(game.enemy.x,.14,game.enemy.z);bot.position.y=Math.sin(time*2)*.008;head.rotation.y=game.physics.puck.x*.38;body.rotation.z=-game.enemy.x*.12;
    const reaction=game.state==='goal'||game.state==='won';if(reaction){const happy=game.message.startsWith('BOT');head.rotation.z=happy?Math.sin(time*12)*.16:.25;bot.position.y+=happy?Math.abs(Math.sin(time*9))*.07:-.04;}else head.rotation.z=0;
    const message=paused||game.message||'FIRST TO 7';
    if(message!==last||game.scores[0]!==lastPlayer||game.scores[1]!==lastEnemy){last=message;lastPlayer=game.scores[0];lastEnemy=game.scores[1];sc.fillStyle='#10283c';sc.fillRect(0,0,1024,320);sc.textAlign='center';sc.font='bold 33px sans-serif';sc.fillStyle='#6fcaff';sc.fillText('YOU',240,52);sc.fillStyle='#ff8b9c';sc.fillText('BOT',784,52);sc.font='bold 150px monospace';sc.fillStyle='#e9f7ff';sc.fillText(game.scores[0],240,211);sc.fillText(game.scores[1],784,211);sc.font='25px sans-serif';sc.fillStyle='#bad6df';sc.fillText(message,512,285);scoreTexture.needsUpdate=true;}
  }
  return {table,player,enemy,puck,update};
}
