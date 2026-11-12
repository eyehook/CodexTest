import {buildProfileReport} from './profiler-report.mjs?v=capture-1';
self.onmessage=({data})=>{try{self.postMessage({ok:true,...buildProfileReport(data)});}catch(error){self.postMessage({ok:false,error:error.message});}};
