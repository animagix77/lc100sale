"""Original instrumental: No Particular Hurry. No samples or borrowed melody."""
import numpy as np, wave, json
from pathlib import Path
SR=44100; BPM=108; beat=60/BPM; bar=beat*4; duration=32*bar+4
N=int(duration*SR); rng=np.random.default_rng(1002004)
dry=np.zeros((N,2),np.float32); atmosphere=np.zeros_like(dry); wet_send=np.zeros_like(dry)
def hz(m):return 440*2**((m-69)/12)
def env(n,attack=.01,release=.15):
 e=np.ones(n,np.float32);a=min(n,int(attack*SR));r=min(n-a,int(release*SR));e[:a]=np.sin(np.linspace(0,np.pi/2,a))**2
 if r:e[-r:]=np.cos(np.linspace(0,np.pi/2,r))**2
 return e
def add(signal,start,amp=1,pan=0,send=0,target=dry):
 idx=int(start*SR);n=min(len(signal),N-idx)
 if n<=0:return
 if signal.ndim==1:s=np.column_stack([signal*np.sqrt((1-pan)/2),signal*np.sqrt((1+pan)/2)])
 else:s=signal
 target[idx:idx+n]+=s[:n]*amp
 if send:wet_send[idx:idx+n]+=s[:n]*amp*send
def smooth_noise(n,lo=0,hi=1800):
 x=rng.normal(0,1,n);f=np.fft.rfftfreq(n,1/SR);spec=np.fft.rfft(x);filt=1/(1+(f/max(hi,1))**6)
 if lo:filt*=1-1/(1+(f/lo)**6)
 a=np.fft.irfft(spec*filt,n);return a/(np.std(a)+1e-8)
def pad(notes,seconds):
 t=np.arange(int(seconds*SR))/SR;l=np.zeros_like(t);r=l.copy()
 for j,m in enumerate(notes):
  f=hz(m)
  for k in range(1,8):
   a=.15/(k**1.9);l+=a*np.sin(2*np.pi*f*(1-.0018)*k*t+j*.63);r+=a*np.sin(2*np.pi*f*(1+.0018)*k*t+j*.63+.3)
 e=env(len(t),.35,.65)*( .92+.08*np.sin(2*np.pi*.19*t))
 return np.column_stack([l*e,r*e])
def pluck(m,seconds=1.2,bright=1):
 t=np.arange(int(seconds*SR))/SR;f=hz(m);x=np.zeros_like(t)
 for k,a in [(1,1),(2,.32),(3,.11),(5,.035)]:x+=a*np.sin(2*np.pi*f*k*t)*np.exp(-t*(2.3+k*.75)/bright)
 return x*env(len(t),.007,.18)*.32
# D minor / B-flat major / F major / C suspended to major: an original ambient-house bed.
chords=[[50,57,62,65,69],[46,53,58,62,65],[41,53,57,60,65],[48,55,60,64,67]]
roots=[38,34,29,36]
for b in range(32):
 notes=chords[(b//2)%4];v=.78 if b<4 or 16<=b<20 or b>=28 else 1
 add(pad(notes,bar+1.2),b*bar,.55*v,target=atmosphere)
 # Sparse felt-like keys stay in the spaces between the lead phrases.
 if b%2==0:
  for j,m in enumerate(notes[1:]):add(pluck(m+12,2,1.7),b*bar+j*.06,.075,pan=-.28+j*.15,send=.8,target=atmosphere)
# Minimal sea-air texture, kept well below the music.
air=smooth_noise(N,1500,4800)*.0013;add(air,0,.7,target=atmosphere)
def kick():
 t=np.arange(int(.47*SR))/SR;f=47+105*np.exp(-t*44);phase=2*np.pi*np.cumsum(f)/SR
 x=np.sin(phase)*np.exp(-t*10)*env(len(t),.002,.04);x+=smooth_noise(len(t),1800,5500)*np.exp(-t*150)*.06
 return np.tanh(x*1.25)*.7
def clap():
 t=np.arange(int(.25*SR))/SR;n=smooth_noise(len(t),900,7000);e=np.exp(-t*21)*.5
 for a in [0,.012,.026]:e+=np.where(t>=a,np.exp(-np.maximum(0,t-a)*180),0)*.3
 tone=np.sin(2*np.pi*185*t)*np.exp(-t*27)*.13
 return (n*e*.2+tone)*env(len(t),.001,.06)
def hat(opened=False):
 d=.26 if opened else .075;t=np.arange(int(d*SR))/SR;x=smooth_noise(len(t),5500,14000)
 return x*np.exp(-t*(15 if opened else 63))*env(len(t),.001,.025)*.13
k=kick();cl=clap();hc=hat();ho=hat(True)
def bass(m,d):
 t=np.arange(int(d*SR))/SR;f=hz(m);x=np.sin(2*np.pi*f*t)*.65+np.sin(2*np.pi*f*2*t)*.16+np.sin(2*np.pi*f*3*t)*.055
 return x*env(len(t),.008,.06)*( .67+.33*np.exp(-t*12))
for b in range(32):
 full=8<=b<16 or 20<=b<28;build=4<=b<8;outro=28<=b<30
 if full or build or outro:
  strength=1 if full else (.66 if build else .53)
  for q in range(4):
   add(k,b*bar+q*beat,.51*strength)
   if q%2:add(cl,b*bar+q*beat,.48*strength,send=.10)
   add(ho,b*bar+(q+.5)*beat,.29*strength,pan=.18,send=.12)
   for step in [.25,.75]:add(hc,b*bar+(q+step)*beat,.19*strength*(.7 if step==.25 else 1),pan=-.28 if step==.25 else .28)
  root=roots[(b//2)%4]
  for st,len_beats,level in [(0,.70,.8),(1.5,.42,.67),(2,.65,.9),(3.25,.42,.66),(3.75,.19,.55)]:
   m=root+(12 if st==3.75 and b%2 else 0);add(bass(m,len_beats*beat),b*bar+st*beat,.29*strength*level)
 # Ticking arp opens into the beat, then dissolves at the end.
 if b>=6 and b<30 and not 16<=b<19:
  notes=chords[(b//2)%4];pattern=[0,2,1,3,2,4,1,3]
  for step in range(8):
   m=notes[pattern[step]]+12;add(pluck(m,.65,.65),b*bar+(step*.5+.25)*beat,.055 if full else .026,pan=np.sin(step*1.7)*.65,send=.65,target=atmosphere)
# Original eight-bar melody; long breathing phrases rather than a recognizable cover tune.
melody=[[(.5,74,1),(2,77,.7),(3,76,.8)],[(0,69,1.6),(2.5,72,1)],[(.5,70,1),(2,74,1.5)],[(0,77,1),(1.5,74,.6),(2.5,72,1)],[(0,69,1.5),(2,72,.7),(3,77,.8)],[(.5,76,1),(2.5,72,1)],[(0,67,1.2),(1.5,69,.65),(2.5,72,1)],[(0,76,1.2),(2,74,1.7)]]
def lead(m,beats):
 d=beats*beat+.65;t=np.arange(int(d*SR))/SR;f=hz(m);sig=np.zeros((len(t),2))
 for ch,det in enumerate([-.0009,.0009]):
  phase=2*np.pi*f*(1+det)*t+.006*np.sin(2*np.pi*4.6*t)
  x=np.sin(phase)+.18*np.sin(phase*2)+.045*np.sin(phase*3)
  sig[:,ch]=x*env(len(t),.03,.65)*np.exp(-t*.85)*.23
 return sig
for start in [8,20]:
 for b,phrase in enumerate(melody):
  for pos,m,length in phrase:add(lead(m,length),(start+b)*bar+pos*beat,.32 if start==8 else .37,send=.9,target=atmosphere)
# Reflective break: a few isolated upper notes with long space.
for b,m in [(0,74),(2,69),(16,77),(17,74),(18,70),(19,72),(28,74),(30,69)]:add(pluck(m,3,2.4),b*bar+beat,.13,pan=-.12,send=1,target=atmosphere)
# Soft reverse swells mark section changes without an aggressive noise blast.
for boundary in [8,20]:
 d=bar;t=np.arange(int(d*SR))/SR;n=smooth_noise(len(t),700,5200);swell=n*(t/d)**3*env(len(t),.2,.035)*.016
 add(swell,(boundary-1)*bar,send=.6,target=atmosphere)
# Tempo echo and diffuse stereo reverb, designed as a return bus.
wet=np.zeros_like(dry)
for delay,gain,swap in [(beat*.75,.27,True),(beat*1.5,.15,False),(beat*2.25,.09,True)]:
 off=int(delay*SR);wet[off:]+=wet_send[:-off,::-1] *gain if swap else wet_send[:-off]*gain
for j in range(18):
 off=int((.045+j*.083+(j%3)*.017)*SR);gain=.027*np.exp(-j*.15)
 wet[off:,0]+=wet_send[:-off,j%2]*gain;wet[off:,1]+=wet_send[:-off,(j+1)%2]*gain
# Musical ducking leaves room for the kick, applied only to pads/lead/returns.
t=np.arange(N)/SR;side=np.ones(N)
for b in list(range(4,16))+list(range(20,30)):
 start=int(b*bar*SR);end=min(N,int((b+1)*bar*SR));phase=(t[start:end]-b*bar)%beat
 side[start:end]=.40+.60*(1-np.exp(-phase/ .11))
x=dry+(atmosphere+wet)*side[:,None]
# Remove DC, round transients, preserve headroom and add a natural final fade.
x-=x.mean(axis=0);x=np.tanh(x*1.18);fade=np.ones(N);fade[:int(.06*SR)]=np.linspace(0,1,int(.06*SR));last=int(5.8*SR);fade[-last:]=np.cos(np.linspace(0,np.pi/2,last))**2;x*=fade[:,None]
peak=np.max(np.abs(x));x*=.89/max(peak,1e-8)
out=Path(__file__).parent/'No Particular Hurry.wav'
with wave.open(str(out),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((x*32767).astype('<i2').tobytes())
meta={'title':'No Particular Hurry','type':'Original instrumental melodic house preview','bpm':BPM,'key':'D minor','seconds':round(duration,2),'sample_rate':SR,'peak_dbfs':round(20*np.log10(np.abs(x).max()),2),'rms_dbfs':round(20*np.log10(np.sqrt(np.mean(x*x))),2),'samples_or_borrowed_melodies':False}
(out.parent/'track-info.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta))
