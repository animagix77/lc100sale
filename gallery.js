const galleryDialog=document.getElementById('photo-dialog');
let galleryPhotos=[],galleryIndex=0;
const el=id=>document.getElementById(id);
function displayPhoto(){const p=galleryPhotos[galleryIndex];if(!p)return;el('photo-large').src=p.src;el('photo-large').alt=p.alt||p.title;el('photo-title').textContent=p.title;if(p.titleAccent&&p.title.endsWith(p.titleAccent)){el('photo-title').textContent=p.title.slice(0,-p.titleAccent.length);const accent=document.createElement('em');accent.textContent=p.titleAccent;el('photo-title').append(accent);}el('photo-description').textContent=p.caption;el('photo-count').textContent=`${galleryIndex+1} / ${galleryPhotos.length}`;galleryDialog.scrollTop=0;}
function movePhoto(delta){galleryIndex=(galleryIndex+delta+galleryPhotos.length)%galleryPhotos.length;displayPhoto();}
const photosReady=fetch('assets/gallery/photos.json?v=photo-copy-2').then(r=>{if(!r.ok)throw new Error('Photo list unavailable');return r.json()}).then(p=>galleryPhotos=p);
document.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',async event=>{const isLink=button.matches('a[href]');if(isLink&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0))return;event.preventDefault();try{await photosReady;galleryIndex=Number(button.dataset.photo);displayPhoto();galleryDialog.showModal();}catch{const source=button.getAttribute('href')||button.querySelector('img')?.src;if(source){if(isLink)window.location.assign(source);else window.open(source,'_blank','noopener');}}}));
el('photo-close').addEventListener('click',()=>galleryDialog.close());
el('photo-previous').addEventListener('click',()=>movePhoto(-1));el('photo-next').addEventListener('click',()=>movePhoto(1));
galleryDialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();movePhoto(-1)}if(event.key==='ArrowRight'){event.preventDefault();movePhoto(1)}});
galleryDialog.addEventListener('click',event=>{if(event.target===galleryDialog){const r=galleryDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)galleryDialog.close()}});
