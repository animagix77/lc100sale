import {mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
for(const file of ['index.html','storyboard.html','style.css','app.js','gallery.js','video-prompts.json'])cpSync(file,'dist/'+file);
mkdirSync('dist/assets',{recursive:true});
for(const file of ['front-ai-edited-v2.png','rear-ai-edited.png','side-2025.jpg','rotation-frames.json','orbit-media.json','beach-portrait-v2.png'])cpSync('assets/'+file,'dist/assets/'+file);
cpSync('assets/orbit','dist/assets/orbit',{recursive:true});
cpSync('assets/gallery','dist/assets/gallery',{recursive:true});
console.log('Static website and storyboard prepared.');
