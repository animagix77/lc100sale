"""Five original LC FM instrumentals. Synthesized instruments; no borrowed melodies or samples."""
import numpy as np, wave, json, subprocess
from pathlib import Path
from functools import lru_cache
SR=32000
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',default=str(Path(__file__).parent));args=parser.parse_args()
OUT=Path(args.output_dir);OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(2004100)
def hz(m):return 440*2**((m-69)/12)
def envelope(n,a=.005,r=.09):
 e=np.ones(n,np.float32);a=min(n,int(a*SR));r=min(n-a,int(r*SR));e[:a]=np.linspace(0,1,a)**.7
 if r:e[-r:]=np.linspace(1,0,r)**1.6
 return e
def noise(n,lo=0,hi=8000):
 f=np.fft.rfftfreq(n,1/SR);s=np.fft.rfft(rng.normal(size=n));h=1/(1+(f/hi)**6)
 if lo:h*=1-1/(1+(f/lo)**6)
 x=np.fft.irfft(s*h,n);return (x/(np.std(x)+1e-8)).astype(np.float32)
@lru_cache(maxsize=4096)
def voice(kind,m,d):
 t=np.arange(int(d*SR))/SR;f=hz(m);phase=2*np.pi*f*t
 if kind=='piano':
  x=sum(a*np.sin(phase*k+.9*np.sin(phase*(k+.002))*np.exp(-t*7))*np.exp(-t*(1.4+k*.65)) for k,a in [(1,.75),(2,.25),(3,.14),(4,.07),(6,.025)])
 elif kind=='rhodes':x=np.sin(phase+2.2*np.sin(phase*3)*np.exp(-t*4))*np.exp(-t*2.8)*.6 + .13*np.sin(phase*.5)*np.exp(-t*3)
 elif kind=='upright':x=sum(np.sin(phase*k)*np.exp(-t*(1.8+k*1.4))*.6/k**1.3 for k in range(1,7))
 elif kind=='sub':x=(np.sin(phase)*.8+.15*np.sin(phase*2))*np.exp(-t*.8)
 elif kind=='bass':x=(np.sin(phase)*.7+.22*np.sin(phase*2)+.09*np.sin(phase*3))*np.exp(-t*1.3)
 elif kind in ['guitar','muted']:
  # Plucked, slightly detuned steel strings through a saturated amp/cabinet curve.
  decay=10 if kind=='muted' else 2.5
  raw=sum(np.sin(phase*k*(1+.00009*k))*np.exp(-t*(decay+k*.65))*(.65/k**1.25) for k in range(1,13))
  x=np.tanh(raw*(3.8 if kind=='guitar' else 2.8))*.5
  # Cabinet low-pass, deterministic and free of broadband fuzz.
  ff=np.fft.rfftfreq(len(x),1/SR);x=np.fft.irfft(np.fft.rfft(x)/(1+(ff/3700)**6),len(x))
 elif kind=='lead':
  ph=phase+.028*np.sin(2*np.pi*5*t);x=sum(np.sin(ph*k)*np.exp(-t*(.8+k*.5))*.35/k**1.5 for k in range(1,8))
 elif kind=='pad':x=sum((np.sin(phase*k*.998)+np.sin(phase*k*1.002))*.09/k**2 for k in range(1,6))
 elif kind=='organ':x=(np.sin(phase)+.3*np.sin(phase*2)+.12*np.sin(phase*4))*.18*(.97+.03*np.sin(t*31))
 return (x*envelope(len(t),.12 if kind=='pad' else .003,.3 if kind=='pad' else .06)).astype(np.float32)
def drum(kind):
 d={'kick':.48,'snare':.26,'hat':.09,'ride':.48,'open':.24,'tom':.38,'clap':.24}[kind];t=np.arange(int(d*SR))/SR
 if kind=='kick':x=np.sin(2*np.pi*np.cumsum(48+100*np.exp(-t*50))/SR)*np.exp(-t*11)+noise(len(t),1700,5500)*np.exp(-t*180)*.035
 elif kind in ['snare','clap']:x=noise(len(t),900,6500)*np.exp(-t*22)*.3+np.sin(2*np.pi*185*t)*np.exp(-t*26)*.32
 elif kind=='tom':x=np.sin(2*np.pi*(105*t+1.4*(1-np.exp(-t*20))))*np.exp(-t*13)*.65
 else:
  metal=sum(np.sin(2*np.pi*f*t) for f in [4211,5333,6727,7319,8903])*.022
  x=(noise(len(t),4500,11500)*.10+metal)*np.exp(-t*({'hat':58,'open':17,'ride':10}[kind]))
 return (x*envelope(len(t),.001,.02)).astype(np.float32)
DRUMS={k:drum(k) for k in ['kick','snare','hat','ride','open','tom','clap']}
tracks=[
 dict(id='jazz',title='Glovebox After Hours',bpm=92,bars=80,roots=[48,45,50,43],chords=[[60,64,67,71],[57,60,64,67],[62,65,69,72],[59,62,65,69]]),
 dict(id='hiphop',title='Curb Appeal',bpm=86,bars=72,roots=[41,44,39,46],chords=[[56,60,63,67],[56,60,63,65],[55,58,62,65],[58,62,65,68]]),
 dict(id='edm',title='Low Range, High Spirits',bpm=122,bars=96,roots=[38,34,41,36],chords=[[62,65,69],[58,62,65],[60,65,69],[60,64,67]]),
 dict(id='rock80',title='Hairspray & Horsepower',bpm=118,bars=96,roots=[40,36,43,38],chords=[[52,59,64],[48,55,60],[55,62,67],[50,57,62]]),
 dict(id='rock90',title='Smells Like Wet Floor Mats',bpm=100,bars=80,roots=[40,43,38,45],chords=[[52,59,64],[55,62,67],[50,57,62],[57,64,69]])]
metadata=[]
for cfg in tracks:
 kind=cfg['id'];beat=60/cfg['bpm'];bar=beat*4;seconds=cfg['bars']*bar+3;N=int(seconds*SR)
 dry=np.zeros((N,2),np.float32);wet=np.zeros_like(dry)
 def add(sig,t,level=1,pan=0,send=0):
  start=int(t*SR)
  if start<0:return
  n=min(len(sig),N-start)
  if n<=0:return
  stereo=sig[:n,None]*np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)],np.float32)[None,:]*level
  dry[start:start+n]+=stereo
  if send:wet[start:start+n]+=stereo*send
 def note(inst,m,at,d,level,pan=0,send=.15):add(voice(inst,int(m),round(d,3)),at,level,pan,send)
 # Each station has an intro, two contrasting verses/choruses, a break, and a final refrain.
 for b in range(cfg['bars']):
  start=b*bar;part=b%32;intro=b<8;outro=b>=cfg['bars']-8;breakdown=32<=b<40;chorus=16<=part<32 and not outro
  ci=(b//2)%4;root=cfg['roots'][ci];chord=cfg['chords'][ci];level=.65 if intro or outro else .6 if breakdown else 1
  rock=kind.startswith('rock');jazz=kind=='jazz';hip=kind=='hiphop';edm=kind=='edm'
  if not intro or b>=4:
   for q in range(4):
    at=start+q*beat
    if edm or q in ([0,2] if jazz else [0,2,3] if chorus else [0,2]):add(DRUMS['kick'],at,.35 if jazz else .6*level)
    if q%2:add(DRUMS['clap' if edm else 'snare'],at,.3 if jazz else .62*level,send=.12 if rock else .035)
    if not breakdown:
     add(DRUMS['ride' if jazz else 'hat'],at,.7 if jazz else .9*level,pan=.3)
     swing=.66 if jazz else .57 if hip else .5
     add(DRUMS['hat' if jazz or hip else 'open'],at+swing*beat,.44 if jazz else .58*level,pan=-.2)
   if (b+1)%8==0 and not jazz:
    for step in [2.5,3,3.5,3.75]:add(DRUMS['tom' if rock else 'snare'],start+step*beat,.38*level,pan=(step-3)*.5)
  if jazz:
   for q,m in enumerate([root,root+4,root+7,root+11 if ci!=1 else root+10]):note('upright',m,start+q*beat,beat*.91,.48)
   for pos in [0,.66,2.66] if chorus else [0,2.5]:
    for j,m in enumerate(chord):note('piano',m,start+pos*beat+j*.016,beat*1.4,.20*level,pan=-.25,send=.24)
  elif hip:
   for j,m in enumerate(chord):note('rhodes',m,start+j*.025,bar*.94,.27*level,pan=-.25+j*.13,send=.28)
   for pos,d in [(0,1.35),(1.75,.6),(2.5,.75),(3.5,.42)]:note('sub',root-12 if root>43 else root,start+pos*beat,d*beat,.55*level)
  elif edm:
   for j,m in enumerate(chord):note('pad',m,start,bar+.3,.38*level,pan=(j-1)*.4,send=.38)
   if not intro and not breakdown:
    for q in range(8):note('bass',root,start+(q*.5+.25)*beat,beat*.21,.65*level)
   if b>=4:
    for q in range(8):note('lead',chord[[0,2,1,2,0,1,2,1][q]]+12,start+(q*.5+.25)*beat,beat*.48,.24*level,pan=np.sin(q)*.4,send=.6)
  else:
   inst='guitar' if chorus else 'muted';steps=[0,.5,1,1.5,2,2.5,3,3.5] if not breakdown else [0,2]
   for pos in steps:
    for side in [-1,1]:
     for j,m in enumerate(chord):note(inst,m,start+pos*beat+(.012 if side>0 else 0)+j*.004,beat*(.7 if chorus else .35),.23*level,pan=side*.7,send=.09)
    note('bass',root,start+pos*beat,beat*.43,.45*level)
   if kind=='rock80':
    for j,m in enumerate(chord):note('pad',m+12,start,bar,.22*level,pan=(j-1)*.5,send=.35)
   elif not chorus:
    for q in range(8):note('guitar',chord[[0,1,2,1,0,2,1,2][q]]+12,start+q*.5*beat,beat,.12,pan=.15,send=.45)
  # New composed phrases, with eight-bar call/response and section variation.
  if not intro and not breakdown and not outro and (jazz or hip or chorus):
   motif=[0,2,1,3,2,1,0,2];phrase=b%8;indices=[motif[phrase],(motif[phrase]+1)%len(chord),(motif[phrase]+2)%len(chord)]
   for k,pos in enumerate([.5,1.75,3] if hip else [0,1.5,2.66] if jazz else [.5,2,3.25]):
    m=chord[indices[k]%len(chord)]+(12 if not hip else 0)
    if b>=64 and k==1:m+=12
    note('piano' if jazz else 'rhodes' if hip else 'lead' if edm else 'guitar',m,start+pos*beat,beat*(1.15 if k==2 else .75),.23 if jazz or hip else .32,pan=.1,send=.5)
 # Small room plus tempo delays, with longer tails on the synth stations.
 for delay,amount in [(.037,.10),(.071,.075),(beat*.75,.19),(beat*1.5,.10),(beat*2.25,.05)]:
  n=int(delay*SR);dry[n:]+=wet[:-n,::-1]*amount
 dry-=dry.mean(axis=0);dry=np.tanh(dry*1.15);dry[:int(.06*SR)]*=np.linspace(0,1,int(.06*SR))[:,None];end=int(5*SR);dry[-end:]*=np.cos(np.linspace(0,np.pi/2,end))[:,None]**2
 dry*=.86/max(float(np.abs(dry).max()),1e-8)
 path=OUT/(kind+'.wav')
 with wave.open(str(path),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((dry*32767).astype('<i2').tobytes())
 subprocess.run(['/usr/bin/afconvert','-f','m4af','-d','aac','-b','128000',str(path),str(OUT/(kind+'.m4a'))],check=True)
 meta={**cfg,'seconds':round(seconds,2),'peak_dbfs':round(float(20*np.log10(np.abs(dry).max())),2),'rms_dbfs':round(float(20*np.log10(np.sqrt(np.mean(dry*dry)))),2),'bytes':(OUT/(kind+'.m4a')).stat().st_size,'original':True};metadata.append(meta);print(json.dumps(meta),flush=True)
 del dry,wet
(OUT/'radio-tracks.json').write_text(json.dumps(metadata,indent=2))
