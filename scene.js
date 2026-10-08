/* Procedural 3D geometry rendered with WebGL. No remote scripts or models. */
(()=>{
'use strict';
const canvasList=[...document.querySelectorAll('.scene-canvas')];
if(!canvasList.length)return;
const paused=false;
let raf=0,last=0,time=0;const frameInterval=matchMedia('(pointer:coarse)').matches?1000/30:1000/60;
const matrices={
 multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;},
 model(x,y,z,rx,ry,rz,s=1){const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);const X=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]),Y=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]),Z=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);const m=this.multiply(Z,this.multiply(Y,X));for(let i=0;i<12;i++)m[i]*=s;m[12]=x;m[13]=y;m[14]=z;return m;},
 projection(aspect){const f=1/Math.tan(Math.PI/7.5),n=.1,far=35;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0]);}
};
const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(a=>a/d);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function path(t){return[(1.14+.36*Math.cos(3*t))*Math.cos(2*t),(1.14+.36*Math.cos(3*t))*Math.sin(2*t),.49*Math.sin(3*t)];}
function makeKnot(segments=170,sides=18){const positions=[],normals=[],indices=[];for(let i=0;i<=segments;i++){const t=i/segments*Math.PI*2,p=path(t),p2=path(t+.001),tangent=normalize(p2.map((v,j)=>v-p[j])),N=normalize(cross(tangent,[0,0,1])),B=normalize(cross(tangent,N));for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,n=N.map((v,k)=>v*Math.cos(a)+B[k]*Math.sin(a));positions.push(...p.map((v,k)=>v+n[k]*.19));normals.push(...n);}}for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}return{positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint16Array(indices)};}
function makeRing(R,r,segments=96,sides=14){const p=[],n=[],ind=[];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;for(let j=0;j<=sides;j++){const b=j/sides*Math.PI*2;p.push((R+r*Math.cos(b))*Math.cos(a),(R+r*Math.cos(b))*Math.sin(a),r*Math.sin(b));n.push(Math.cos(a)*Math.cos(b),Math.sin(a)*Math.cos(b),Math.sin(b));}}for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;ind.push(a,b,a+1,b,b+1,a+1);}return{positions:new Float32Array(p),normals:new Float32Array(n),indices:new Uint16Array(ind)};}
const geometry={knot:makeKnot(),ring:makeRing(1.84,.027),small:makeRing(.22,.065,40,14)};
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uProjection;uniform mat4 uModel;varying vec3 vNormal;varying vec3 vPosition;void main(){vec4 p=uModel*vec4(aPosition,1.0);vPosition=p.xyz;vNormal=mat3(uModel)*aNormal;gl_Position=uProjection*p;}`;
const fragment=`precision mediump float;varying vec3 vNormal;varying vec3 vPosition;uniform vec3 uColor;uniform float uMetal;void main(){vec3 N=normalize(vNormal);vec3 V=normalize(-vPosition);vec3 L=normalize(vec3(-4.0,6.0,4.0)-vPosition);vec3 L2=normalize(vec3(5.0,-1.0,2.0)-vPosition);float diffuse=max(dot(N,L),0.0);vec3 R=reflect(-V,N);float strip=pow(max(dot(R,normalize(vec3(-.6,.9,1.0))),0.0),23.0);float strip2=pow(max(dot(R,normalize(vec3(.9,-.2,.5))),0.0),40.0);float spec=pow(max(dot(N,normalize(L+V)),0.0),85.0);float fresnel=pow(1.0-max(dot(N,V),0.0),3.0);vec3 base=uColor*(.12+diffuse*.53+max(dot(N,L2),0.0)*.18);vec3 highlights=mix(vec3(1.0,.69,.77),vec3(.93,.92,1.0),uMetal);vec3 c=base+highlights*(strip*.7+strip2*.65+spec*.75)+uColor*fresnel*.55;float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);c+=vec3((noise-.5)/255.0);c=c/(c+vec3(.8));c=pow(c,vec3(.88));gl_FragColor=vec4(c,1.0);}`;
const states=[];
function create(canvas){const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});if(!gl){canvas.remove();return;}
const hero=canvas.id==='hero-canvas',container=hero?canvas.closest('.portrait-stage'):canvas.closest('.project-art'),card=hero?container:canvas.closest('.project');
try{
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('3D shader link failed');gl.useProgram(program);
const uniforms={model:gl.getUniformLocation(program,'uModel'),proj:gl.getUniformLocation(program,'uProjection'),color:gl.getUniformLocation(program,'uColor'),metal:gl.getUniformLocation(program,'uMetal')},attributes={pos:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal')};
const meshes={};Object.entries(geometry).forEach(([name,data])=>{const buffers=[data.positions,data.normals].map(array=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);return b;});const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);meshes[name]={buffers,index,count:data.indices.length};});
gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
const state={canvas,gl,hero,container,card,active:true,lost:false,x:0,y:0,tx:0,ty:0,hover:false,scroll:0,start:performance.now(),uniforms,attributes,meshes,program};
state.tint=hero?[1,.035,.17]:card.dataset.project==='tlt'?[.73,.23,.88]:card.dataset.project==='hrm'?[1,.31,.49]:[.36,.79,.64];
function draw(name,m,color,metal){const mesh=meshes[name];gl.uniformMatrix4fv(uniforms.model,false,m);gl.uniform3fv(uniforms.color,color);gl.uniform1f(uniforms.metal,metal);mesh.buffers.forEach((b,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);const a=i===0?attributes.pos:attributes.normal;gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,0,0);});gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.index);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);}
state.render=(now)=>{if(state.lost)return;const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,hero?1.6:1.25),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(uniforms.proj,false,matrices.projection(w/h));state.x+=(state.tx-state.x)*.055;state.y+=(state.ty-state.y)*.055;const t=paused?0:time*.00024;
if(hero){const intro=paused?1:Math.min((now-state.start)/1900,1),dolly=1-Math.pow(1-Math.max(0,intro),4),scroll=paused?0:state.scroll;const z=-7.6+dolly*1.6-scroll*.9;draw('knot',matrices.model(.05,-.04-Math.sin(scroll)*.22,z,.4+state.y*.5+scroll*.6,.55+state.x*.55,Math.sin(t)*.25+scroll*.45,1.18),state.tint,0);draw('ring',matrices.model(.05,-.03,z+.06,-.62+Math.sin(t)*.12,-.3+state.x*.2,t*.25+scroll*.7,1.1),[.56,.42,.59],1);draw('small',matrices.model(-1.5,1.52+Math.sin(t*3)*.1,z+.1,t*2,.7,t,1),[.82,.59,.71],1);draw('small',matrices.model(1.49,-1.54+Math.cos(t*3)*.12,z+.2,.5,t*2,-t,1),[1,.075,.23],0);}
else{draw('knot',matrices.model(1.15,.16,-5.2,.6+state.y*.3,.6+state.x*.5,t*.33+state.x*.15,.88),state.tint,.45);draw('ring',matrices.model(1.1,.1,-5.1,-.8,.35,t*.2,.93),state.tint,1);}
};
if(matchMedia('(pointer:fine)').matches){card.addEventListener('pointermove',e=>{if(paused)return;const r=card.getBoundingClientRect();state.tx=(e.clientX-r.left)/r.width-.5;state.ty=(e.clientY-r.top)/r.height-.5;});card.addEventListener('pointerleave',()=>{state.tx=state.ty=0;});}
if('IntersectionObserver'in window)new IntersectionObserver(es=>{state.active=es[0].isIntersecting;schedule();},{rootMargin:'100px'}).observe(container);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.lost=true;});canvas.addEventListener('webglcontextrestored',()=>{state.lost=true;canvas.remove();});
states.push(state);
}catch(e){canvas.remove();console.warn('3D background unavailable. Content remains accessible.',e);}}
function onScroll(){const h=document.querySelector('.hero'),r=h.getBoundingClientRect(),p=Math.max(0,Math.min(1.5,-r.top/Math.max(1,r.height)));states.forEach(s=>{if(s.hero)s.scroll=p;});if(paused)renderStill();}
function renderStill(){const now=performance.now();states.forEach(s=>{if(s.active&&!s.lost)s.render(now);});}
function schedule(){if(!raf&&!document.hidden&&!paused&&states.some(s=>s.active&&!s.lost))raf=requestAnimationFrame(frame);else if(paused&&!document.hidden)renderStill();}
function frame(now){raf=0;if(document.hidden)return;if(last&&now-last<frameInterval-1){schedule();return;}time+=last?Math.min(now-last,50):0;last=now;states.forEach(s=>{if(s.active&&!s.lost)s.render(now);});schedule();}
canvasList.forEach(create);onScroll();schedule();addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',()=>{renderStill();schedule();},{passive:true});document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else schedule();});
})();
