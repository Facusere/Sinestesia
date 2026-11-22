const a=require("assert"),A=require("./analysis.js");
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
 for(let l=2;l<=n;l<<=1){const w=-2*Math.PI/l;for(let i=0;i<n;i+=l)for(let k=0;k<l/2;k++){const c=Math.cos(w*k),s=Math.sin(w*k),u=i+k,v=u+l/2,tr=re[v]*c-im[v]*s,ti=re[v]*s+im[v]*c;re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti}}}
const sr=44100,N=4096;function spec(freqs){const re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++){const w=.5-.5*Math.cos(2*Math.PI*i/N);re[i]=w*freqs.reduce((s,f)=>s+Math.sin(2*Math.PI*f*i/sr),0)}fft(re,im);return Float32Array.from({length:N/2},(_,i)=>Math.hypot(re[i],im[i])/N)}
let m=spec([440]);const pf=A.peakFreq(m,sr,N);a.ok(Math.abs(pf-440)<3,"pico "+pf);a.strictEqual(A.noteName(pf),"La4");
a.strictEqual(A.chroma(m,sr,N).indexOf(1),9);a.ok(Math.abs(A.centroid(m,sr,N)-440)<40);
a.strictEqual(A.noteName(261.63),"Do4");a.strictEqual(A.noteName(0),"—");
m=spec([261.63,329.63,392]);const c=A.chroma(m,sr,N);[0,4,7].forEach(i=>a.ok(c[i]>.5,"acorde Do mayor"));
const b=A.bands(spec([100]),sr,N);a.ok(b[0]>.9);
const env=Array.from({length:480},(_,i)=>i%30===0?1:0);a.ok(Math.abs(A.estimateBPM(env,60)-120)<2);
const F=Array.from({length:16},(_,i)=>i%4<2?[1,0]:[0,1]),S=A.selfSim(F);a.ok(S[0*16+4]>.99);a.ok(S[0*16+2]<.01);
a.ok(Math.abs(A.rms(Float32Array.from({length:1000},(_,i)=>Math.sin(i/10)))-Math.SQRT1_2)<.02);
console.log("tests OK")
