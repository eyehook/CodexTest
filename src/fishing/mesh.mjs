// Adaptive ring populations keep the central fan well shaped while reaching 256 sectors.
export function meshData(radius=2000,rings=128,segments=256){
 const positions=[0,0,0],spacings=[0],indices=[];let previous=[0],prevR=0;
 const firstStep=Math.min(0.4,radius/(rings+1));
 let lo=0,hi=1;for(let k=0;k<60;k++){const mid=(lo+hi)/2;const total=firstStep*Math.expm1(mid*rings)/Math.expm1(mid);if(total>radius)hi=mid;else lo=mid;}const growth=(lo+hi)/2;
 for(let j=1;j<=rings;j++){
  const r=firstStep*Math.expm1(growth*j)/Math.expm1(growth);
  const dr=j===1?firstStep:r-prevR;
  const count=Math.min(segments,Math.max(8,Math.ceil(2*Math.PI*r/Math.max(dr,0.4)/8)*8));
  const current=[];
  for(let k=0;k<count;k++){current.push(positions.length/3);const angle=k/count*Math.PI*2;positions.push(r*Math.cos(angle),0,r*Math.sin(angle));spacings.push(Math.max(dr,2*Math.PI*r/count));}
  if(j===1){for(let k=0;k<count;k++)indices.push(0,current[(k+1)%count],current[k]);}
  else {let a=0,b=0;const n=previous.length;while(a<n||b<count){const na=(a+1)/n,nb=(b+1)/count;if(na<nb){indices.push(previous[a%n],previous[(a+1)%n],current[b%count]);a++;}else{indices.push(previous[a%n],current[(b+1)%count],current[b%count]);b++;}}}
  previous=current;prevR=r;
 }
 return {positions:new Float32Array(positions),spacings:new Float32Array(spacings),indices:new Uint32Array(indices)};
}
