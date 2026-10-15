import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const path=s=>fileURLToPath(new URL(s,import.meta.url));
export default defineConfig({root:path('./src/'),base:'./',build:{outDir:path('./'),emptyOutDir:false,assetsDir:'build',target:'es2022'}});
