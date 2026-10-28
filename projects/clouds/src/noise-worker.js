import { generateNoise } from './noise.js';
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
