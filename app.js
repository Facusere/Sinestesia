(()=>{"use strict";
const $=id=>document.getElementById(id),A=window.A,PANELS={spec:["Espectro","Cuánta energía hay en cada frecuencia, en escala logarítmica. El marcador indica el pico y su nota."],sg:["Espectrograma","El sonido como imagen: el tiempo avanza a la derecha, las frecuencias agudas van arriba y el brillo es la intensidad."],trail:["Estela estéreo","Izquierda contra derecha con rastro que se desvanece. Un sonido mono dibuja una línea vertical; los tonos puros forman figuras."],rad:["Radial","El espectro enrollado en círculo, simétrico y giratorio, con estela."],chroma:["Notas","Cuánto suena cada una de las 12 notas, sin importar la octava. Ayuda a intuir la tonalidad."],ssm:["Autosimilitud","Compara cada instante con todos los demás (últimos ~80 s). Las diagonales claras son partes que se repiten."]};
const C={},X={};for(const k in PANELS){C[k]=$("c-"+k);X[k]=C[k].getContext("2d")}
const hsl=(h,s,l)=>{h=(h%360+360)%360;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))))};return[f(0),f(8),f(4)]};
const PAL=[{f:t=>[250-190*t,.9,.06+.6*t],a:["#ffb347","#ff6f91","#8a7dff"]},{f:t=>[55*t,1,.04+.58*t],a:["#ffd23f","#ff7a1a","#e63946"]},{f:t=>[190+45*t,.8,.05+.65*t],a:["#7df9ff","#4cc9f0","#7b8cff"]}];let lut=[],AC=PAL[0].a;
// La paleta cambia los colores de todas las vistas, del fondo y de los acentos de la interfaz (variables CSS --a1..--a3).
const setPal=i=>{lut=Array.from({length:256},(_,k)=>hsl(...PAL[i].f(k/255)));AC=PAL[i].a;AC.forEach((c,j)=>document.documentElement.style.setProperty("--a"+(j+1),c))},col=t=>"rgb("+lut[Math.round(Math.max(0,Math.min(1,t))*255)].join()+")";setPal(0);
const FMIN=30,msg=t=>{$("msg").textContent=t||""},hid=()=>false,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
let level=0,tT=0,ac,sp,main,anL,anR,src,fileNode,stream,fd,mag,prev,td,tl,tr,frozen=false,hue=0,rot=0,flash=0,fps=60,bpm=0,lastT=0;
const pk=[],cs=new Array(12).fill(0),F=[],ENV=[],EDGES=[30,100,200,400,800,1600,3200,6400,12800];let tF=0,tB=0,tM=0,tD=0;
function setFft(n){main.fftSize=anL.fftSize=anR.fftSize=n;fd=new Float32Array(main.frequencyBinCount);mag=new Float32Array(fd.length);prev=new Float32Array(fd.length);td=new Float32Array(n);tl=new Float32Array(n);tr=new Float32Array(n)}
async function boot(){if(!ac){ac=new AudioContext();main=ac.createAnalyser();anL=ac.createAnalyser();anR=ac.createAnalyser();sp=ac.createChannelSplitter(2);sp.connect(anL,0);sp.connect(anR,1);main.smoothingTimeConstant=+$("sm").value;setFft(+$("fft").value)}await ac.resume()}
let stopDemo=()=>{};function use(node,hear,s){stopDemo();if(src)try{src.disconnect()}catch{}if(stream&&stream!==s)stream.getTracks().forEach(t=>t.stop());stream=s||null;src=node;node.connect(main);node.connect(sp);if(hear)node.connect(ac.destination);F.length=0;ENV.length=0}
$("mic").onclick=async()=>{try{await boot();$("au").pause();const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});use(ac.createMediaStreamSource(s),false,s);msg("Escuchando el micrófono. Usá auriculares para evitar acople.")}catch(e){msg("No se pudo usar el micrófono: "+e.message)}};
$("file").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await boot();const au=$("au");au.src=URL.createObjectURL(f);fileNode||=ac.createMediaElementSource(au);use(fileNode,true);await au.play();msg("Reproduciendo "+f.name)}catch(err){msg("No se pudo reproducir el archivo: "+err.message)}};
$("tab").onclick=async()=>{try{await boot();$("au").pause();const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}),a=s.getAudioTracks();s.getVideoTracks().forEach(t=>t.stop());if(!a.length)throw new Error("elegí una pestaña y marcá “compartir audio”");const as=new MediaStream(a);use(ac.createMediaStreamSource(as),false,as);msg("Capturando el audio de la pestaña.")}catch(e){msg("No se pudo capturar la pestaña: "+e.message)}};
$("demo").onclick=async()=>{try{await boot();$("au").pause();const g=ac.createGain();g.gain.value=.22;
 const mk=(type,det,pan)=>{const o=ac.createOscillator(),e=ac.createGain(),p=ac.createStereoPanner();o.type=type;o.detune.value=det;e.gain.value=0;p.pan.value=pan;o.connect(e);e.connect(p);p.connect(g);o.start();return{o,e}};
 const a=mk("sawtooth",-7,-.8),b=mk("triangle",7,.8),SC=[0,3,7,10,12,10,7,3],ROOT=[220,174.61,196,130.81];let i=0;use(g,true);
 const T=setInterval(()=>{const t=ac.currentTime,s=i%8,f=ROOT[Math.floor(i/8)%4]*2**(SC[s]/12);for(const v of[a,b]){v.o.frequency.setValueAtTime(f*(v===b?2:1),t);v.e.gain.cancelScheduledValues(t);v.e.gain.setValueAtTime(.5,t);v.e.gain.exponentialRampToValueAtTime(.001,t+.22)}
  if(s%2===0){const k=ac.createOscillator(),kg=ac.createGain();k.frequency.setValueAtTime(140,t);k.frequency.exponentialRampToValueAtTime(40,t+.15);kg.gain.setValueAtTime(1,t);kg.gain.exponentialRampToValueAtTime(.001,t+.25);k.connect(kg);kg.connect(g);k.start(t);k.stop(t+.3)}i++},250);
 stopDemo=()=>{clearInterval(T);a.o.stop();b.o.stop()};msg("Sonido de demostración: arpegio estéreo y bombo a 120 BPM.")}catch(e){msg("No se pudo iniciar la demo: "+e.message)}};
$("sm").oninput=()=>main&&(main.smoothingTimeConstant=+$("sm").value);$("fft").onchange=()=>main&&setFft(+$("fft").value);$("pal").onchange=()=>{setPal(+$("pal").value);drawSSM();thumbs()};
$("frz").onclick=()=>{frozen=!frozen;$("frz").classList.toggle("on",frozen);$("frz").textContent=frozen?"Reanudar análisis":"Congelar análisis"};
for(const k in PANELS){const x=X[k],c=C[k];x.fillStyle="#0b0d14";x.fillRect(0,0,c.width,c.height);x.fillStyle="#4a5378";x.font="16px Segoe UI";x.textAlign="center";x.fillText("Esperando audio…",c.width/2,c.height/2);x.textAlign="start"}
const norm=v=>clamp((v+100)/100),fq=(i,W,lg,fmax)=>FMIN*Math.exp(Math.log(fmax/FMIN)*i/W);
function drawSpec(sr,n,pf){const c=C.spec,x=X.spec,W=c.width,H=c.height,fmax=Math.min(16000,sr/2),lg=Math.log(fmax/FMIN);x.fillStyle="#0b0d14";x.fillRect(0,0,W,H);
 x.font="12px Segoe UI";x.fillStyle="#9099b8";x.strokeStyle="#1c2238";for(const f of[100,1000,10000]){const px=Math.log(f/FMIN)/lg*W;x.beginPath();x.moveTo(px,0);x.lineTo(px,H);x.stroke();x.fillText(f>=1000?f/1000+" kHz":f+" Hz",px+4,H-6)}
 for(let i=0,j=0;i<W;i+=3,j++){const f=FMIN*Math.exp(lg*i/W),v=norm(fd[Math.min(fd.length-1,Math.round(f*n/sr))]),h=v*(H-24);pk[j]=Math.max(v,(pk[j]||0)-.006);x.fillStyle=col(v);x.fillRect(i,H-18-h,2,h);x.fillStyle="#ffffff99";x.fillRect(i,H-20-pk[j]*(H-24),2,2)}
 if(pf>0){const px=Math.log(pf/FMIN)/Math.log(fmax/FMIN)*W;x.fillStyle=AC[0];x.fillText(A.noteName(pf)+" · "+Math.round(pf)+" Hz",Math.min(px+6,W-110),16);x.fillRect(px,20,1,H-40)}}
function drawSG(sr,n){const c=C.sg,x=X.sg,W=c.width,H=c.height,fmax=Math.min(16000,sr/2),lg=Math.log(fmax/FMIN);x.drawImage(c,-1,0);const im=x.createImageData(1,H);
 for(let y=0;y<H;y++){const f=FMIN*Math.exp(lg*(1-y/H)),t=norm(fd[Math.min(fd.length-1,Math.round(f*n/sr))]);im.data.set([...lut[Math.round(t*255)],255],y*4)}x.putImageData(im,W-1,0)}
function fade(x,W,H){x.globalCompositeOperation="source-over";x.fillStyle=`rgba(10,12,19,${1-+$("pers").value})`;x.fillRect(0,0,W,H);x.globalCompositeOperation="lighter"}
function drawTrail(rms){const c=C.trail,x=X.trail,W=c.width,H=c.height;fade(x,W,H);hue+=.5;const g=Math.min(6,.3/(rms+.03));x.strokeStyle=col(Math.min(1,.6+.4*Math.pow(Math.sin(hue*.03),2)+flash*.2));x.lineWidth=1.2+flash*2;x.beginPath();
 for(let i=0;i<tl.length;i+=2){const l=tl[i],r=tr[i],px=W/2+(l-r)*.7071*W*.45*g,py=H/2-(l+r)*.7071*H*.45*g;i?x.lineTo(px,py):x.moveTo(px,py)}x.stroke();x.globalCompositeOperation="source-over"}
function drawRad(sr,n,bass){const c=C.rad,x=X.rad,W=c.width,H=c.height,R=W/2,fmax=Math.min(16000,sr/2),lg=Math.log(fmax/FMIN),M=150;fade(x,W,H);rot+=.004+bass*.03;x.lineWidth=2;
 for(let k=0;k<M;k++){const f=FMIN*Math.exp(lg*k/M),v=norm(fd[Math.min(fd.length-1,Math.round(f*n/sr))]),r0=R*.3,r1=r0+v*R*.62,a=k/M*Math.PI+rot;x.strokeStyle=col(v);
  for(const s of[1,-1]){x.beginPath();x.moveTo(R+Math.cos(s*a)*r0,R+Math.sin(s*a)*r0);x.lineTo(R+Math.cos(s*a)*r1,R+Math.sin(s*a)*r1);x.stroke()}}x.globalCompositeOperation="source-over"}
function drawChroma(ch){const c=C.chroma,x=X.chroma,W=c.width,H=c.height,N=["Do","Do#","Re","Re#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"],mx=ch.indexOf(Math.max(...ch));x.fillStyle="#0b0d14";x.fillRect(0,0,W,H);const w=W/12;x.font="13px Segoe UI";x.textAlign="center";
 ch.forEach((v,i)=>{cs[i]=cs[i]*.7+v*.3;const h=cs[i]*(H-40);x.fillStyle=i===mx&&cs[i]>.5?AC[0]:col(.25+cs[i]*.6);x.fillRect(i*w+6,H-26-h,w-12,h);x.fillStyle="#9099b8";x.fillText(N[i],i*w+w/2,H-8)});x.textAlign="start"}
function drawSSM(){if(hid("ssm")||F.length<8)return;const n=F.length,c=C.ssm,x=X.ssm,m=A.selfSim(F),im=x.createImageData(n,n);
 for(let i=0;i<n*n;i++)im.data.set([...lut[Math.round(clamp(Math.pow(Math.max(0,m[i]),5))*255)],255],i*4);const t=document.createElement("canvas");t.width=t.height=n;t.getContext("2d").putImageData(im,0,0);x.imageSmoothingEnabled=false;x.drawImage(t,0,0,c.width,c.height)}
function frame(now){requestAnimationFrame(frame);if(!main||frozen)return;
 main.getFloatFrequencyData(fd);main.getFloatTimeDomainData(td);anL.getFloatTimeDomainData(tl);anR.getFloatTimeDomainData(tr);
 const sr=ac.sampleRate,n=main.fftSize,dt=Math.max(1,now-(lastT||now-16));lastT=now;fps=fps*.95+50/dt;
 const kLo=Math.ceil(30*n/sr),kHi=Math.floor(4000*n/sr);let flux=0;
 for(let i=0;i<fd.length;i++){mag[i]=Math.pow(10,fd[i]/20);if(i>=kLo&&i<=kHi)flux+=Math.max(0,mag[i]-prev[i])}prev.set(mag);ENV.push(flux);if(ENV.length>600)ENV.shift();
 const rms=A.rms(td),pf=A.peakFreq(mag,sr,n),ch=A.chroma(mag,sr,n),bd=A.bands(mag,sr,n),rec=ENV.slice(-60),mean=rec.reduce((a,b)=>a+b,0)/rec.length;
 if(flux>mean*1.5+1e-3&&now-tB>200&&rms>.003){flash=1;tB=now}flash*=.92;
 if(now-tF>400&&rms>.002){tF=now;const bv=[];for(let b=0;b<8;b++){let s=0;for(let i=Math.ceil(EDGES[b]*n/sr);i<EDGES[b+1]*n/sr&&i<mag.length;i++)s+=mag[i]*mag[i];bv.push(Math.log10(1+s*1e4))}const mx=Math.max(...bv)||1;F.push([...ch,...bv.map(v=>v/mx)]);if(F.length>200)F.shift();drawSSM()}
 if(now-tM>500){tM=now;bpm=A.estimateBPM(ENV.slice(-Math.round(fps*8)),fps)}
 if(now-tD>200){tD=now;$("m-rms").textContent=rms>1e-5?(20*Math.log10(rms)).toFixed(1)+" dB":"−∞";$("m-note").textContent=pf?A.noteName(pf)+" · "+Math.round(pf)+" Hz":"—";$("m-cen").textContent=Math.round(A.centroid(mag,sr,n))+" Hz";$("m-bpm").textContent=bpm?Math.round(bpm):"—";bd.forEach((v,i)=>$("b"+i).style.width=Math.max(3,v*100)+"%")}
 $("dot").style.opacity=flash;level=level*.9+rms*.1;if(now-tT>150){tT=now;thumbs()}
 if(!hid("spec"))drawSpec(sr,n,pf);if(!hid("sg"))drawSG(sr,n);if(!hid("trail"))drawTrail(rms);if(!hid("rad"))drawRad(sr,n,bd[0]);if(!hid("chroma"))drawChroma(ch)}
// Tarjetas con miniatura en vivo; al elegir una se abre la vista grande en una ventana.
const dlg=$("dlg"),TH={};let cur;
$("cards").innerHTML=Object.entries(PANELS).map(([k,v])=>`<button class="card" type="button" data-k="${k}"><canvas width="320" height="180"></canvas><h3>${v[0]}</h3><p>${v[1]}</p><b>Abrir →</b></button>`).join("");
document.querySelectorAll(".card").forEach(b=>{TH[b.dataset.k]=b.querySelector("canvas").getContext("2d");b.onclick=()=>openV(b.dataset.k)});
function thumbs(){for(const k in TH){const c=C[k],x=TH[k],s=Math.min(320/c.width,180/c.height),w=c.width*s,h=c.height*s;x.fillStyle="#0b0d14";x.fillRect(0,0,320,180);x.drawImage(c,(320-w)/2,(180-h)/2,w,h)}}
function openV(k){cur=k;const c=C[k];$("dt").textContent=PANELS[k][0];$("dd").textContent=PANELS[k][1];c.style.width=c.width>c.height?"100%":"";$("dv").appendChild(c);$("dctl").appendChild($("ctl"));dlg.showModal?dlg.showModal():dlg.setAttribute("open","")}
dlg.onclose=()=>{C[cur].style.width="";$("stage").appendChild(C[cur]);$("msg").before($("ctl"));thumbs()};
$("dx").onclick=()=>dlg.close();dlg.onclick=e=>e.target===dlg&&dlg.close();
$("dpng").onclick=()=>C[cur].toBlob(bl=>{const a=document.createElement("a");a.href=URL.createObjectURL(bl);a.download="sinestesia-"+cur+".png";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1e3)});
thumbs();
// Fondo: un ecualizador tenue que sigue el espectro real del audio; sin audio "respira" con un movimiento lento.
const bgc=$("bg"),bx=bgc.getContext("2d"),NB=72,BH=new Array(NB).fill(0),calm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches?0.4:1;let bw,bh,bt=0,bp=0;
const bsize=()=>{const d=Math.min(devicePixelRatio||1,1.5);bw=bgc.width=innerWidth*d;bh=bgc.height=innerHeight*d};
function bdraw(){bx.clearRect(0,0,bw,bh);const live=main&&!frozen&&level>2e-4,sr=ac?ac.sampleRate:44100,n=main?main.fftSize:4096,fmax=Math.min(16000,sr/2),w=bw/NB;
 for(let i=0;i<NB;i++){const idle=(.16+.09*Math.sin(bt*.9+i*.32)+.06*Math.sin(bt*.55+i*.85))*calm,au=live?norm(fd[Math.min(fd.length-1,Math.round(FMIN*Math.exp(Math.log(fmax/FMIN)*i/NB)*n/sr))])*1.1:0;BH[i]+=(Math.max(idle,au)-BH[i])*.18;
  const h=BH[i]*bh*.55,[r,gg,b]=lut[Math.round(110+i/NB*145)],g=bx.createLinearGradient(0,bh-h,0,bh);g.addColorStop(0,`rgba(${r},${gg},${b},0)`);g.addColorStop(1,`rgba(${r},${gg},${b},.34)`);bx.fillStyle=g;bx.fillRect(i*w+1,bh-h,w-2,h);bx.fillStyle=`rgba(${r},${gg},${b},.6)`;bx.fillRect(i*w+1,bh-h-2,w-2,2)}}
function bloop(now){requestAnimationFrame(bloop);if(document.hidden||now-bp<33)return;bp=now;bt+=.033;bdraw()}
bsize();addEventListener("resize",()=>{bsize();bdraw()});bdraw();requestAnimationFrame(bloop);
requestAnimationFrame(frame)})();
