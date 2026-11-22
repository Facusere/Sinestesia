(function(root){"use strict";
const NOTES=["Do","Do#","Re","Re#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"],midi=f=>69+12*Math.log2(f/440);
const noteName=f=>{if(!(f>0))return"—";const m=Math.round(midi(f));return NOTES[((m%12)+12)%12]+(Math.floor(m/12)-1)};
// mag: magnitudes lineales (bins 0..N/2). Interpolación parabólica alrededor del máximo.
function peakFreq(mag,sr,n,minHz=30){const k0=Math.max(1,Math.ceil(minHz*n/sr));let k=k0;for(let i=k0;i<mag.length-1;i++)if(mag[i]>mag[k])k=i;
 if(!(mag[k]>1e-6)||k>=mag.length-1)return 0;const a=mag[k-1],b=mag[k],c=mag[k+1],d=a-2*b+c;return(k+(d?.5*(a-c)/d:0))*sr/n}
function chroma(mag,sr,n){const c=new Array(12).fill(0);for(let i=1;i<mag.length;i++){const f=i*sr/n;if(f<55||f>4200)continue;c[((Math.round(midi(f))%12)+12)%12]+=mag[i]*mag[i]}const mx=Math.max(...c)||1;return c.map(v=>v/mx)}
function centroid(mag,sr,n){let a=0,d=0;for(let i=1;i<mag.length;i++){a+=i*mag[i];d+=mag[i]}return d?a/d*sr/n:0}
const rms=x=>{let s=0;for(const v of x)s+=v*v;return Math.sqrt(s/x.length)};
function bands(mag,sr,n){const e=[0,0,0];for(let i=1;i<mag.length;i++){const f=i*sr/n;e[f<250?0:f<4000?1:2]+=mag[i]*mag[i]}const t=e[0]+e[1]+e[2]||1;return e.map(v=>v/t)}
// Tempo por autocorrelación de la envolvente de onsets (60–180 BPM). Puede confundir octavas (x2, /2).
function estimateBPM(env,fps,lo=60,hi=180){const n=env.length;if(n<fps*3)return 0;const m=env.reduce((a,b)=>a+b,0)/n,x=env.map(v=>v-m);let best=0,bl=0;
 for(let l=Math.floor(fps*60/hi);l<=Math.ceil(fps*60/lo)&&l<n/2;l++){let s=0;for(let i=0;i+l<n;i++)s+=x[i]*x[i+l];s/=n-l;if(s>best){best=s;bl=l}}return bl?60*fps/bl:0}
// Matriz de autosimilitud (coseno) entre vectores de características: las repeticiones aparecen como diagonales.
function selfSim(F){const n=F.length,M=new Float32Array(n*n),nr=F.map(v=>Math.hypot(...v)||1);for(let i=0;i<n;i++)for(let j=i;j<n;j++){let s=0;const a=F[i],b=F[j];for(let k=0;k<a.length;k++)s+=a[k]*b[k];M[i*n+j]=M[j*n+i]=s/(nr[i]*nr[j])}return M}
const api={noteName,peakFreq,chroma,centroid,rms,bands,estimateBPM,selfSim};root.A=api;if(typeof module!=="undefined")module.exports=api})(typeof window!=="undefined"?window:globalThis);
