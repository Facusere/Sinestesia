// Prueba de humo: carga la página en jsdom con AudioContext, canvas y dispositivos simulados y recorre todas las funciones.
const {JSDOM}=require("jsdom"),fs=require("fs"),a=require("assert");
const w=new JSDOM(fs.readFileSync("index.html","utf8").replace(/<script[^>]*><\/script>/g,""),{runScripts:"outside-only",pretendToBeVisual:true}).window,q=[];
const seen=new Set();let K=0,stops=0,killed=0,dl=0,fills=0;
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k==="createLinearGradient"?()=>({addColorStop(){}}):k==="createImageData"?(x,y)=>({data:new Uint8ClampedArray(x*y*4)}):k==="fillRect"?()=>{fills++}:k in o?o[k]:()=>{},set:(o,k,v)=>((k==="fillStyle"||k==="strokeStyle")&&typeof v==="string"&&seen.add(v),o[k]=v,true)});
w.HTMLCanvasElement.prototype.toBlob=function(f){f(new w.Blob(["x"]))};
const P=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}}),N=()=>({connect(){},disconnect(){}});
w.AudioContext=class{constructor(){this.sampleRate=44100;this.currentTime=0;this.destination=N()}resume(){return Promise.resolve()}createGain(){return{...N(),gain:P()}}createOscillator(){return{...N(),frequency:P(),detune:P(),start(){},stop(){stops++}}}createStereoPanner(){return{...N(),pan:P()}}createChannelSplitter(){return N()}createMediaStreamSource(){return N()}createMediaElementSource(){return N()}
 createAnalyser(){return{...N(),fftSize:4096,smoothingTimeConstant:0,get frequencyBinCount(){return this.fftSize/2},getFloatFrequencyData(x){K++;const on=K%15<2;x.fill(-90);x[40]=on?-10:-70;x[39]=x[41]=on?-25:-80},getFloatTimeDomainData(x){for(let i=0;i<x.length;i++)x[i]=.3*Math.sin(i*.06)}}}};
w.MediaStream=class{constructor(t){this.t=t}getTracks(){return this.t}};
w.URL.createObjectURL=()=>"blob:x";w.URL.revokeObjectURL=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.play=()=>Promise.resolve();
w.HTMLAnchorElement.prototype.click=function(){dl++;a.ok(/^sinestesia-.*\.png$/.test(this.download))};
const DP=w.HTMLDialogElement||w.HTMLElement;DP.prototype.showModal=function(){this.open=true};DP.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
w.requestAnimationFrame=f=>q.push(f);w.eval(fs.readFileSync("analysis.js","utf8"));w.eval(fs.readFileSync("app.js","utf8"));
const d=w.document,G=id=>d.getElementById(id),g=id=>G(id).textContent,tick=()=>new Promise(r=>setTimeout(r,20));let t=0;const run=n=>{for(let i=0;i<n;i++){const f=q.shift();t+=16.7;f&&f(t)}};
(async()=>{
 a.ok(!G("bgt"),"el botón de animación ya no existe");a.ok(g("msg").includes("demostración"));
 G("mic").click();await tick();a.ok(g("msg").startsWith("No se pudo usar el micrófono"),g("msg"));
 Object.defineProperty(w.navigator,"mediaDevices",{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){killed++}}]}),getDisplayMedia:async()=>({getAudioTracks:()=>w.__aud||[],getVideoTracks:()=>[{stop(){}}]})}});
 G("mic").click();await tick();a.ok(g("msg").includes("Escuchando el micrófono"),g("msg"));
 G("tab").click();await tick();a.ok(g("msg").includes("No se pudo capturar la pestaña"),g("msg"));
 w.__aud=[{stop(){killed++}}];G("tab").click();await tick();a.ok(g("msg").includes("Capturando"),g("msg"));a.ok(killed>=1,"cambiar de fuente detiene el micrófono");
 await G("file").onchange({target:{files:[{name:"cancion.mp3"}]}});a.ok(g("msg").includes("cancion.mp3"),g("msg"));
 G("demo").click();await tick();a.ok(g("msg").includes("demostración")&&g("msg").includes("120"));run(1200);
 a.ok(g("m-note").startsWith("La4"),g("m-note"));a.ok(g("m-rms").includes("dB"));a.ok(g("m-cen").endsWith("Hz"));
 const bpm=+g("m-bpm");a.ok(bpm>=115&&bpm<=125,"tempo "+g("m-bpm"));a.ok(G("b0").style.width&&G("b2").style.width);a.ok(fills>1000,"el fondo y las vistas dibujan");
 seen.clear();run(150);const S0=new Set(seen),R=document=>w.document.documentElement.style.getPropertyValue("--a1");a.strictEqual(R(),"#ffb347");
 const fft=G("fft");fft.value="8192";fft.dispatchEvent(new w.Event("change"));G("pal").value="1";G("pal").dispatchEvent(new w.Event("change"));a.strictEqual(R(),"#ffd23f","la paleta cambia los acentos");seen.clear();G("sm").value=".5";G("sm").dispatchEvent(new w.Event("input"));run(150);const S1=[...seen];a.ok(S1.length>20&&S1.filter(x=>S0.has(x)).length<S1.length/2,"la paleta cambia los colores dibujados");G("pal").value="2";G("pal").dispatchEvent(new w.Event("change"));a.strictEqual(R(),"#7df9ff");run(10);
 G("frz").click();const k0=K;run(20);a.strictEqual(K,k0,"congelado no analiza");G("frz").click();run(20);a.ok(K>k0);
 const cards=d.querySelectorAll(".card");a.deepStrictEqual([...cards].map(c=>c.querySelector("h3").textContent),["Espectro","Espectrograma","Estela estéreo","Radial","Notas","Autosimilitud"]);a.ok([...cards].every(c=>c.querySelector("p").textContent.length>30));
 for(const c of cards){c.click();a.ok(G("dlg").open);a.strictEqual(g("dt"),c.querySelector("h3").textContent);a.ok(G("dv").querySelector("canvas"));a.ok(G("dctl").contains(G("ctl")));run(5);G("dpng").click();G("dx").click();a.ok(!G("dlg").open);a.strictEqual(G("stage").querySelectorAll("canvas").length,6);a.ok(!G("dctl").contains(G("ctl")))}
 a.strictEqual(dl,6);cards[0].click();G("dlg").onclick({target:G("dlg")});a.ok(!G("dlg").open,"el fondo de la ventana la cierra");
 const s0=stops;G("mic").click();await tick();a.ok(stops>s0,"la demo se detiene al cambiar de fuente");
 console.log("smoke OK");process.exit(0)})().catch(e=>{console.error(e);process.exit(1)});
