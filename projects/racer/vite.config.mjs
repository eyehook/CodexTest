import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const path=relative=>fileURLToPath(new URL(relative,import.meta.url));
export default defineConfig({
 root:path('../../src/racer/'),
 base:'./', // Same build works at /projects/racer/ and /CodexTest/projects/racer/.
 publicDir:false,
 server:{host:'127.0.0.1',port:5173,strictPort:true,fs:{allow:[path('../../')]}},
 preview:{host:'127.0.0.1',port:4173,strictPort:true},
 build:{outDir:path('./'),emptyOutDir:false,assetsDir:'build',target:'es2022',
  rollupOptions:{output:{entryFileNames:'build/racer.js',chunkFileNames:'build/[name].js',assetFileNames:'build/[name][extname]'}}}
});
