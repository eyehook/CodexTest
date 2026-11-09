import {BoxGeometry} from '../../shared/vendor/three-r180/three.module.js';
export const PANEL_WIDTH=1.9,PANEL_PADDING=.125,PANEL_ROW_GAP=.04;
// Rows can share a slot when only one alternative is visible (snap/smooth turn).
export function layoutRoomPanel(board,rows){
 const slots=rows.map(row=>Array.isArray(row)?row:[row]);
 const heights=slots.map(meshes=>Math.max(...meshes.map(mesh=>mesh.geometry.parameters.height)));
 const height=heights.reduce((sum,h)=>sum+h,0)+PANEL_ROW_GAP*(slots.length-1)+2*PANEL_PADDING;
 board.geometry.dispose();board.geometry=new BoxGeometry(PANEL_WIDTH,height,.06);board.position.y=0;
 let top=height/2-PANEL_PADDING;
 slots.forEach((meshes,i)=>{for(const mesh of meshes){mesh.position.x=0;mesh.position.y=top-heights[i]/2;}top-=heights[i]+PANEL_ROW_GAP;});
 return height;
}
