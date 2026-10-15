import GUI from 'lil-gui';
export function createGUI(c,resize){
 const gui=new GUI({title:'Swarm tuning'});
 gui.add(c,'beeCount',10,1000,1).onFinishChange(resize);
 for(const [key,min,max] of [['maxSpeed',.5,8],['maxForce',.5,12],['neighborRadius',.2,6],['separationRadius',.1,2],['waspSpeed',.2,6]])gui.add(c,key,min,max);
 const weights=gui.addFolder('Steering weights');for(const key of ['cohesion','alignment','separation','attraction','boundary'])weights.add(c,key,0,4,.05);weights.close();
 const bounds=gui.addFolder('Wasp flight volume');bounds.add(c.bounds,'x',4,20);bounds.add(c.bounds,'z',4,20);bounds.add(c.bounds,'minY',3,6);bounds.add(c.bounds,'maxY',8,14);bounds.close();return gui;
}
