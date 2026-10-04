import {mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
for(const file of ['index.html','storyboard.html','style.css','app.js','sequence-player.js','gallery.js','buyer-guide.js','motion.js','page-motion.js','ownership-journey.js','rusty.js','rusty.css','comparisons.js','video-prompts.json'])cpSync(file,'dist/'+file);
mkdirSync('dist/assets',{recursive:true});
for(const file of ['front-ai-edited-v2.png','rear-ai-edited.png','side-2025.jpg','rotation-frames.json','orbit-media.json','beach-portrait-v2.png'])cpSync('assets/'+file,'dist/assets/'+file);
cpSync('assets/orbit','dist/assets/orbit',{recursive:true});
cpSync('assets/gallery','dist/assets/gallery',{recursive:true});
console.log('Static website and storyboard prepared.');

cpSync('assets/video','dist/assets/video',{recursive:true});

cpSync('assets/history','dist/assets/history',{recursive:true});

cpSync('assets/share','dist/assets/share',{recursive:true});
