import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const path=relative=>fileURLToPath(new URL(relative,import.meta.url));
export default defineConfig({plugins:[{name:'trim-generated-whitespace',generateBundle(_options,bundle){for(const item of Object.values(bundle)){if(item.type==='chunk')item.code=item.code.replace(/[ \t]+$/gm,'');}}}],root:path('../../src/fishing/'),base:'./',publicDir:false,server:{host:'127.0.0.1',port:5175,strictPort:true,fs:{allow:[path('../../')]}},build:{outDir:path('./'),emptyOutDir:false,assetsDir:'build',target:'es2022',rollupOptions:{output:{entryFileNames:'build/fishing.js',assetFileNames:'build/[name][extname]'}}}});
