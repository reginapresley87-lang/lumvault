// Linkabara – animated 3D mascot (three.js, shell-textured fur). Design preview only.
import * as THREE from './vendor/three.module.min.js';

const instances = [];
window.Linkabara = { instances, setTalking(on){ instances.forEach(i => i.talking = on); } };

function webglOK(){
  try{ const c=document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2')||c.getContext('webgl'))); }
  catch(e){ return false; }
}

// strand noise texture generated on a canvas
function furTexture(){
  const s=256, c=document.createElement('canvas'); c.width=c.height=s;
  const g=c.getContext('2d'), img=g.createImageData(s,s);
  let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let i=0;i<s*s;i++){ const v=Math.pow(rnd(),0.8)*255; img.data[i*4]=v; img.data[i*4+1]=v; img.data[i*4+2]=v; img.data[i*4+3]=255; }
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; return t;
}

const FUR_VS = `
uniform float uLayer; uniform float uLen; uniform vec3 uGravity; uniform float uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vObjN;
void main(){
  vUv=uv; vObjN=normal;
  vec3 p=position+normal*uLen*uLayer;
  float k=uLayer*uLayer;
  p+=uGravity*k + vec3(sin(uTime*1.7+position.y*3.0),0.0,cos(uTime*1.3+position.x*3.0))*0.012*k;
  vN=normalize(normalMatrix*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const FUR_FS = `
uniform sampler2D uTex; uniform float uLayer; uniform vec2 uRepeat;
uniform vec3 uDark; uniform vec3 uLight; uniform vec3 uBelly; uniform float uBellyOn;
varying vec2 vUv; varying vec3 vN; varying vec3 vObjN;
void main(){
  float strand=texture2D(uTex,vUv*uRepeat).r;
  if(uLayer>0.0 && strand < uLayer*0.92+0.04) discard;
  vec3 base=mix(uDark,uLight,uLayer);
  float belly=uBellyOn*smoothstep(0.55,0.85,vObjN.z)*smoothstep(0.35,-0.15,vObjN.y);
  base=mix(base,uBelly*mix(0.8,1.05,uLayer),belly);
  vec3 L=normalize(vec3(0.4,0.8,0.6));
  float d=max(dot(normalize(vN),L),0.0);
  float rim=pow(1.0-max(normalize(vN).z,0.0),2.0);
  vec3 col=base*(0.55+0.7*d)*mix(0.55,1.1,uLayer)+rim*vec3(0.55,0.42,0.95)*0.35*uLayer;
  gl_FragColor=vec4(col,1.0);
}`;

function furry(geo, tex, {shells=22, len=0.12, repeat=[10,10], belly=false, dark=0x3b2414, light=0xa8774a}={}){
  const g=new THREE.Group(), mats=[];
  for(let i=0;i<shells;i++){
    const m=new THREE.ShaderMaterial({ vertexShader:FUR_VS, fragmentShader:FUR_FS, uniforms:{
      uTex:{value:tex}, uLayer:{value:i/(shells-1)}, uLen:{value:len}, uRepeat:{value:new THREE.Vector2(...repeat)},
      uGravity:{value:new THREE.Vector3(0,-0.03,0)}, uTime:{value:0},
      uDark:{value:new THREE.Color(dark)}, uLight:{value:new THREE.Color(light)},
      uBelly:{value:new THREE.Color(0xe9c79a)}, uBellyOn:{value:0} }});
    const mesh=new THREE.Mesh(geo,m); mesh.renderOrder=i; g.add(mesh); mats.push(m);
  }
  g.userData.mats=mats; return g;
}

function knitTexture(){
  const s=256,c=document.createElement('canvas'); c.width=c.height=s; const g=c.getContext('2d');
  g.fillStyle='#4a2a18'; g.fillRect(0,0,s,s);
  for(let y=0;y<s;y+=8){ for(let x=0;x<s;x+=8){
    const sh=40+Math.random()*30; g.fillStyle=`rgba(${sh+60},${sh+20},${sh},0.55)`;
    g.beginPath(); g.ellipse(x+4,y+4,3.2,4.2,((x/8)%2?0.5:-0.5),0,Math.PI*2); g.fill(); } }
  for(let i=0;i<1600;i++){ g.fillStyle=`rgba(255,220,190,${Math.random()*0.06})`; g.fillRect(Math.random()*s,Math.random()*s,1,1); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(6,2); t.colorSpace=THREE.SRGBColorSpace; return t;
}

function build(el){
  const small = el.dataset.size==='small';
  const renderer=new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(30,1,0.1,50); cam.position.set(0,0.35,8.2); cam.lookAt(0,0.2,0);
  scene.add(new THREE.HemisphereLight(0xfff1e0,0x2a1a40,1.5));
  const key=new THREE.DirectionalLight(0xffe2c4,2.4); key.position.set(2,3,4); scene.add(key);
  const rim=new THREE.DirectionalLight(0x2ee6c5,1.4); rim.position.set(-3,1,-2); scene.add(rim);
  const rim2=new THREE.DirectionalLight(0x8b6cff,1.0); rim2.position.set(3,0.5,-2); scene.add(rim2);

  const tex=furTexture();
  const shells = small ? 16 : 26;
  const FUR={dark:0x55270f, light:0xbd7746};
  const root=new THREE.Group(); scene.add(root);
  const bodyG=new THREE.Group(); root.add(bodyG);

  // egg / bean body
  const body=furry(new THREE.SphereGeometry(1,64,48),tex,{shells,len:0.13,repeat:[16,12],...FUR});
  body.scale.set(1,1.18,0.92); bodyG.add(body);

  // knitted bucket hat
  const knit=knitTexture();
  const hatMat=new THREE.MeshStandardMaterial({color:0xd6b496,map:knit,bumpMap:knit,bumpScale:0.06,roughness:0.95,side:THREE.DoubleSide});
  const hat=new THREE.Group(); hat.position.set(0.04,1.02,0); hat.rotation.z=-0.12; hat.rotation.x=-0.08; bodyG.add(hat);
  const crown=new THREE.Mesh(new THREE.CylinderGeometry(0.66,0.86,0.5,48,1,true),hatMat); crown.position.y=0.22; hat.add(crown);
  const topCap=new THREE.Mesh(new THREE.SphereGeometry(0.66,48,16,0,Math.PI*2,0,Math.PI/2),hatMat); topCap.scale.y=0.32; topCap.position.y=0.47; hat.add(topCap);
  const brimPts=[]; for(let i=0;i<=12;i++){ const k=i/12; brimPts.push(new THREE.Vector2(0.84+k*0.5, -0.02 - k*k*0.22)); }
  const brim=new THREE.Mesh(new THREE.LatheGeometry(brimPts,64),hatMat); hat.add(brim);
  const brimEdge=new THREE.Mesh(new THREE.TorusGeometry(1.34,0.045,10,64),hatMat); brimEdge.rotation.x=Math.PI/2; brimEdge.position.y=-0.24; hat.add(brimEdge);
  const band=new THREE.Mesh(new THREE.TorusGeometry(0.85,0.04,10,64),new THREE.MeshStandardMaterial({color:0x3b2012,map:knit,roughness:1}));
  band.rotation.x=Math.PI/2; band.position.y=0.02; hat.add(band);

  // face
  const face=new THREE.Group(); bodyG.add(face);
  const white=new THREE.MeshStandardMaterial({color:0xfaf6f0,roughness:0.15});
  const iris=new THREE.MeshPhysicalMaterial({color:0x1a0d07,roughness:0.05,clearcoat:1,clearcoatRoughness:0.05});
  const shine=new THREE.MeshBasicMaterial({color:0xffffff});
  const frameMat=new THREE.MeshStandardMaterial({color:0x3a2416,roughness:0.35,metalness:0.1});
  const glassMat=new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:0.12,roughness:0.05,clearcoat:1});
  const EY=0.3, EX=0.4, EZ=0.86;
  const eyes=[-1,1].map(s=>{
    const g=new THREE.Group(); g.position.set(EX*s,EY,EZ);
    const w=new THREE.Mesh(new THREE.SphereGeometry(0.29,40,28),white); w.scale.z=0.75; g.add(w);
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.2,40,28),iris); p.position.set(-0.03*s,-0.01,0.12); p.scale.z=0.65; g.add(p);
    const h1=new THREE.Mesh(new THREE.SphereGeometry(0.045,16,12),shine); h1.position.set(-0.02*s+0.04,0.07,0.25); g.add(h1);
    const h2=new THREE.Mesh(new THREE.SphereGeometry(0.02,12,8),shine); h2.position.set(-0.07*s,-0.06,0.25); g.add(h2);
    face.add(g); return g; });
  // round glasses
  const glasses=new THREE.Group(); glasses.position.set(0,EY,EZ+0.28); face.add(glasses);
  [-1,1].forEach(s=>{
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.37,0.045,16,64),frameMat); ring.position.x=EX*1.05*s; glasses.add(ring);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(0.36,48),glassMat); lens.position.x=EX*1.05*s; glasses.add(lens);
    const temple=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.6,10),frameMat);
    temple.rotation.x=Math.PI/2; temple.rotation.z=0; temple.position.set((EX*1.05+0.36)*s,0.05,-0.3); temple.rotation.y=0.35*s; glasses.add(temple);
  });
  const bridge=new THREE.Mesh(new THREE.TorusGeometry(0.08,0.035,10,24,Math.PI),frameMat); bridge.position.y=0.02; glasses.add(bridge);

  // wide open smile (D-shape) with tongue and two fangs
  const mouth=new THREE.Group(); mouth.position.set(0,-0.3,0.95); face.add(mouth);
  const mShape=new THREE.Shape(); const MW=0.33, MH=0.34;
  mShape.moveTo(-MW,0); mShape.quadraticCurveTo(0,0.035,MW,0); mShape.bezierCurveTo(MW,-MH*0.9,-MW,-MH*0.9,-MW,0);
  const mGeo=new THREE.ExtrudeGeometry(mShape,{depth:0.08,bevelEnabled:true,bevelThickness:0.02,bevelSize:0.02,bevelSegments:3,curveSegments:24});
  const mouthIn=new THREE.Mesh(mGeo,new THREE.MeshStandardMaterial({color:0x3a0d10,roughness:0.7})); mouthIn.position.z=-0.02; mouth.add(mouthIn);
  const tongue=new THREE.Mesh(new THREE.SphereGeometry(0.15,32,16),new THREE.MeshStandardMaterial({color:0xf08a92,roughness:0.45}));
  tongue.scale.set(1.35,0.5,0.35); tongue.position.set(0,-0.17,0.1); mouth.add(tongue);
  const fangs=[-1,1].map(s=>{ const f=new THREE.Mesh(new THREE.ConeGeometry(0.035,0.08,16),white); f.rotation.x=Math.PI; f.position.set(0.19*s,-0.035,0.11); mouth.add(f); return f; });

  // stubby arms
  const armGeo=new THREE.SphereGeometry(0.2,24,16);
  const arms=[-1,1].map(s=>{ const pivot=new THREE.Group(); pivot.position.set(0.93*s,-0.25,0.1);
    const a=furry(armGeo,tex,{shells:Math.round(shells/2),len:0.06,repeat:[6,6],...FUR}); a.scale.set(0.85,1.35,0.85); a.position.y=-0.12; pivot.add(a);
    pivot.rotation.z=0.25*s; bodyG.add(pivot); return pivot; });
  // round stubby feet
  const footGeo=new THREE.SphereGeometry(0.26,24,16);
  [-1,1].forEach(s=>{ const f=furry(footGeo,tex,{shells:Math.round(shells/2),len:0.05,repeat:[6,6],dark:0x4e240e,light:0xc07a46});
    f.scale.set(1,0.75,1.1); f.position.set(0.36*s,-1.22,0.12); root.add(f); });
  const sh=new THREE.Mesh(new THREE.CircleGeometry(1.0,32),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.3}));
  sh.rotation.x=-Math.PI/2; sh.position.y=-1.4; root.add(sh);
  root.position.y=0.05;

  const allMats=[]; root.traverse(o=>{ if(o.material && o.material.uniforms && o.material.uniforms.uTime) allMats.push(o.material); });
  const inst={el, talking:false, mouthOpen:0};
  instances.push(inst);
  function resize(){ const w=el.clientWidth||300, h=el.clientHeight||300; renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
  resize(); new ResizeObserver(resize).observe(el);

  const clock=new THREE.Clock(); let nextBlink=1.2;
  function frame(){
    const t=clock.getElapsedTime();
    allMats.forEach(m=>m.uniforms.uTime.value=t);
    const breath=Math.sin(t*2.2);
    bodyG.position.y=breath*0.05; bodyG.scale.set(1+breath*0.012,1-breath*0.012,1+breath*0.012);
    let eyeY=1; if(t>nextBlink){ const k=(t-nextBlink)/0.16; eyeY=k<1?Math.abs(1-2*k)*0.92+0.08:1; if(k>=1) nextBlink=t+2.5+Math.random()*2.5; }
    eyes.forEach(e=>e.scale.y=eyeY);
    const target=inst.talking?Math.abs(Math.sin(t*13))*(0.6+0.4*Math.sin(t*5)):0;
    inst.mouthOpen+=(target-inst.mouthOpen)*0.35;
    const open=0.8+inst.mouthOpen*0.6;   // rest = gentle open smile
    mouthIn.scale.y=open; tongue.position.y=-0.17*open; tongue.scale.y=0.45*(0.7+open*0.3);
    const wig=inst.talking?1:0.3;
    bodyG.rotation.z=Math.sin(t*(inst.talking?9:1.3))*0.045*wig;
    root.rotation.y=Math.sin(t*0.6)*0.22+(inst.talking?Math.sin(t*4)*0.06:0);
    arms[0].rotation.z=-0.25-(inst.talking?Math.abs(Math.sin(t*6))*0.7:Math.sin(t*2.2)*0.06);
    arms[1].rotation.z= 0.25+(inst.talking?Math.abs(Math.sin(t*6+1))*0.45:Math.sin(t*2.2)*0.06);
    hat.rotation.z=-0.12+Math.sin(t*2.2+0.6)*0.02;
    renderer.render(scene,cam);
    requestAnimationFrame(frame);
  }
  frame();
  el.classList.add('gl-on');
}

if(webglOK()){
  document.querySelectorAll('.linkabara').forEach(el=>{
    try{ build(el); }catch(e){ console.warn('Linkabara fallback', e); el.classList.add('gl-fail'); }
  });
  document.documentElement.classList.add('webgl');
}else{
  document.documentElement.classList.add('no-webgl');
}
window.dispatchEvent(new Event('linkabara-ready'));
