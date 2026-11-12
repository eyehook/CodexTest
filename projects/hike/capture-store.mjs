// One persisted capture, retained on the headset across reloads and failed uploads.
export class CaptureStore {
 async database(){
  if(!globalThis.indexedDB)throw Error('Device storage unavailable');
  if(!this.opening)this.opening=new Promise((resolve,reject)=>{
   const request=indexedDB.open('codextest-hike-profiler',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('captures');
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Capture storage is blocked'));
  });
  return this.opening;
 }
 async transact(mode,value){
  const db=await this.database();return new Promise((resolve,reject)=>{
   const tx=db.transaction('captures',mode),store=tx.objectStore('captures'),request=mode==='readonly'?store.get('latest'):store.put(value,'latest');let result;
   request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result??null);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('Capture storage aborted'));
  });
 }
 load(){return this.transact('readonly');}
 save(value){return this.transact('readwrite',value);}
}
