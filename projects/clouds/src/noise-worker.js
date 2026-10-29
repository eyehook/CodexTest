import { generateNoise } from './noise.js?v=shared-r180-1';
self.onmessage=({
  data:{
    size,octaves,id
  }
})=>{
  const data=generateNoise(size,octaves);
  self.postMessage({
    data,size,id
  },[data.buffer]);
};
