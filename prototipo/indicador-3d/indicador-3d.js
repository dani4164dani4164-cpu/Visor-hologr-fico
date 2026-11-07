/* ============================================================
   Escena «Indicador 3D» (three.js)
   Versión tridimensional del indicador:
   - Núcleo que pulsa, con halo y una malla geodésica que gira.
   - Cuatro anillos anidados como un giroscopio real (cada uno
     gira dentro del anterior), con arcos punteados que los recorren.
   - Disco base con pistas de circuito, nodos y pulsos de luz,
     marcas en el borde y arco de barrido.
   - Partículas que suben en espiral alrededor del núcleo.
   Trabajando: color continuo azul↔morado (hue 209–275), cada
   elemento ligeramente desfasado. Reposo: gris plateado visible,
   se detienen pulsos, barrido y partículas; la estructura gira lento.

   Contrato de escena (ver js/escenas/registro.js):
     crear(contenedor, S) -> { redimensionar(w, h), dibujar(t, dT), destruir() }
   Gestos (vienen de app.js): S.rot = giro, S.tilt = inclinación, S.zoom = acercar.
   ============================================================ */
import * as THREE from 'three';

/* ---------- Aleatorio con semilla: el diseño siempre es el mismo ---------- */
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ---------- Textura circular suave (para puntos y halos) ---------- */
function texturaSuave(nitidez=0.25){
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');
  gr.addColorStop(nitidez,'rgba(255,255,255,0.85)');
  gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;return tx;
}

/* ---------- Color: misma fórmula que la versión 2D ---------- */
const _c=new THREE.Color();
function tono(t,off,S,destino=_c){
  const e=S.energy,h=242+33*Math.sin(t*0.00035+(off||0));
  return destino.setHSL(h/360,(8+77*e)/100,(62+4*e)/100,THREE.SRGBColorSpace);
}
const alfa=(a,S)=>Math.min(1,a*(0.55+0.45*S.energy));

/* ---------- Pistas de circuito sobre el disco (plano XZ) ---------- */
function crearPistas(R,n,rand){
  const out=[];
  for(let i=0;i<n;i++){
    let a=rand()*6.28,r=R*(0.3+rand()*0.55);const pts=[[a,r]];
    const pasos=3+Math.floor(rand()*4);
    for(let k=0;k<pasos;k++){
      if(k%2){r+=R*(rand()<0.5?-1:1)*(0.05+rand()*0.1);r=Math.max(R*0.25,Math.min(R*0.9,r));}
      else a+=(rand()-.5)*0.6;
      pts.push([a,r]);
    }
    // Muestreo: los tramos de radio constante se dibujan como arcos
    const v=[];
    pts.forEach((p,j)=>{
      if(j===0){v.push(p);return;}
      const q=pts[j-1];
      if(p[1]===q[1]){const m=Math.max(2,Math.ceil(Math.abs(p[0]-q[0])/0.05));for(let s=1;s<=m;s++)v.push([q[0]+(p[0]-q[0])*s/m,p[1]]);}
      else v.push(p);
    });
    const xyz=v.map(([a,r])=>new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));
    // Longitud acumulada: los pulsos viajan a velocidad uniforme
    const largo=[0];for(let j=1;j<xyz.length;j++)largo.push(largo[j-1]+xyz[j].distanceTo(xyz[j-1]));
    out.push({xyz,largo,total:largo[largo.length-1],ph:rand(),sp:0.5+rand()});
  }
  return out;
}
function puntoEn(p,f,dest){
  const d=f*p.total;let j=1;while(j<p.largo.length-1&&p.largo[j]<d)j++;
  const a=p.largo[j-1],b=p.largo[j],k=b>a?(d-a)/(b-a):0;
  return dest.lerpVectors(p.xyz[j-1],p.xyz[j],k);
}

/* ---------- Materiales holográficos (suma de luz, sin profundidad) ---------- */
const holo=extra=>({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,...extra});

export default {
  id:'indicador-3d',
  nombre:'Indicador 3D',

  crear(contenedor,S){
    const rand=rng(42),R=1;
    const recursos=[];const guardar=o=>(recursos.push(o),o);

    /* Render */
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setClearColor(0x000000,0);
    renderer.domElement.className='escena';
    contenedor.prepend(renderer.domElement);

    const escena=new THREE.Scene();
    const camara=new THREE.PerspectiveCamera(38,1,0.1,50);
    const pivote=new THREE.Group();escena.add(pivote);   // recibe los gestos
    const tex=guardar(texturaSuave(0.2)),texHalo=guardar(texturaSuave(0.02));

    /* ---- Disco base: pistas, nodos, pulsos, marcas y barrido ---- */
    const disco=new THREE.Group();disco.position.y=-0.42;pivote.add(disco);
    const pistas=crearPistas(R,34,rand);
    const lineasPistas=pistas.map(p=>{
      const g=guardar(new THREE.BufferGeometry().setFromPoints(p.xyz));
      const m=guardar(new THREE.LineBasicMaterial(holo({opacity:0.35})));
      const l=new THREE.Line(g,m);disco.add(l);return l;
    });
    // Nodos en los extremos de cada pista
    const nodosPos=[],nodosCol=new Float32Array(pistas.length*2*3);
    pistas.forEach(p=>{nodosPos.push(p.xyz[0],p.xyz[p.xyz.length-1]);});
    const gNodos=guardar(new THREE.BufferGeometry().setFromPoints(nodosPos));
    gNodos.setAttribute('color',new THREE.BufferAttribute(nodosCol,3));
    const mNodos=guardar(new THREE.PointsMaterial(holo({size:0.035,map:tex,vertexColors:true,opacity:0.8})));
    disco.add(new THREE.Points(gNodos,mNodos));
    // Pulsos que viajan por las pistas
    const pulPos=new Float32Array(pistas.length*3),pulCol=new Float32Array(pistas.length*3);
    const gPul=guardar(new THREE.BufferGeometry());
    gPul.setAttribute('position',new THREE.BufferAttribute(pulPos,3));
    gPul.setAttribute('color',new THREE.BufferAttribute(pulCol,3));
    const mPul=guardar(new THREE.PointsMaterial(holo({size:0.06,map:tex,vertexColors:true})));
    const pulsos=new THREE.Points(gPul,mPul);pulsos.frustumCulled=false;disco.add(pulsos);
    // Marcas del borde (72; una larga cada 6)
    const marcas=[];
    for(let i=0;i<72;i++){
      const a=i/72*Math.PI*2,l=i%6?0.04:0.1;
      marcas.push(new THREE.Vector3(Math.cos(a)*R,0,Math.sin(a)*R),new THREE.Vector3(Math.cos(a)*(R-l),0,Math.sin(a)*(R-l)));
    }
    const gMarcas=guardar(new THREE.BufferGeometry().setFromPoints(marcas));
    const mMarcas=guardar(new THREE.LineBasicMaterial(holo({opacity:0.6})));
    const anilloMarcas=new THREE.LineSegments(gMarcas,mMarcas);disco.add(anilloMarcas);
    // Arco de barrido (banda plana sobre el disco)
    const gBarrido=guardar(new THREE.RingGeometry(R*0.9,R*0.96,48,1,0,0.9));
    gBarrido.rotateX(-Math.PI/2);
    const mBarrido=guardar(new THREE.MeshBasicMaterial(holo({side:THREE.DoubleSide,opacity:0.9})));
    const barrido=new THREE.Mesh(gBarrido,mBarrido);disco.add(barrido);
    // Velo del disco (da sensación de superficie proyectada)
    const gVelo=guardar(new THREE.CircleGeometry(R,64));gVelo.rotateX(-Math.PI/2);
    const mVelo=guardar(new THREE.MeshBasicMaterial(holo({opacity:0.05,side:THREE.DoubleSide})));
    disco.add(new THREE.Mesh(gVelo,mVelo));

    /* ---- Giroscopio: 4 anillos anidados ---- */
    const anillos=[];let padre=pivote;
    for(let k=3;k>=0;k--){                       // del exterior al interior
      const rr=R*(0.38+k*0.19)*0.82;
      const cardan=new THREE.Group();padre.add(cardan);
      const gA=guardar(new THREE.TorusGeometry(rr,0.006+0.002*k,8,160));
      const mA=guardar(new THREE.MeshBasicMaterial(holo({opacity:0.55})));
      const aro=new THREE.Mesh(gA,mA);cardan.add(aro);
      // Arco punteado que recorre el anillo
      const curva=new THREE.EllipseCurve(0,0,rr*1.05,rr*1.05,0,3.5);
      const gP=guardar(new THREE.BufferGeometry().setFromPoints(curva.getPoints(120)));
      const mP=guardar(new THREE.LineDashedMaterial(holo({dashSize:0.012,gapSize:0.035,opacity:0.6})));
      const punteado=new THREE.Line(gP,mP);punteado.computeLineDistances();cardan.add(punteado);
      anillos.push({k,cardan,mA,mP,punteado});
      padre=cardan;
    }

    /* ---- Núcleo ---- */
    const gNuc=guardar(new THREE.SphereGeometry(R*0.06,24,16));
    const mNuc=guardar(new THREE.MeshBasicMaterial(holo({opacity:0.8})));
    const nucleo=new THREE.Mesh(gNuc,mNuc);pivote.add(nucleo);
    const gMalla=guardar(new THREE.IcosahedronGeometry(R*0.12,1));
    const mMalla=guardar(new THREE.MeshBasicMaterial(holo({wireframe:true,opacity:0.5})));
    const malla=new THREE.Mesh(gMalla,mMalla);pivote.add(malla);
    const mHalo=guardar(new THREE.SpriteMaterial(holo({map:texHalo,opacity:0.6})));
    const halo=new THREE.Sprite(mHalo);pivote.add(halo);
    // Haz vertical tenue del disco al núcleo
    const gHaz=guardar(new THREE.CylinderGeometry(R*0.05,R*0.16,0.42,24,1,true));gHaz.translate(0,-0.21,0);
    const mHaz=guardar(new THREE.MeshBasicMaterial(holo({opacity:0.06,side:THREE.DoubleSide})));
    pivote.add(new THREE.Mesh(gHaz,mHaz));

    /* ---- Partículas ---- */
    const MAX=160;
    const parts=[];for(let i=0;i<MAX;i++)parts.push({a:rand()*6.28,r:rand()*R,y:-0.4+rand()*0.8,s:(rand()-.5)*0.02,z:rand()});
    const pPos=new Float32Array(MAX*3),pCol=new Float32Array(MAX*3);
    const gPart=guardar(new THREE.BufferGeometry());
    gPart.setAttribute('position',new THREE.BufferAttribute(pPos,3));
    gPart.setAttribute('color',new THREE.BufferAttribute(pCol,3));
    const mPart=guardar(new THREE.PointsMaterial(holo({size:0.04,map:tex,vertexColors:true})));
    const particulas=new THREE.Points(gPart,mPart);particulas.frustumCulled=false;pivote.add(particulas);

    /* ---- Cámara ---- */
    let distBase=4;
    function redimensionar(w,h){
      renderer.setSize(w,h,false);
      camara.aspect=w/h;
      const ajuste=1.25/Math.tan(THREE.MathUtils.degToRad(camara.fov/2));
      distBase=camara.aspect<1?ajuste/camara.aspect:ajuste;
      camara.updateProjectionMatrix();
    }

    const tmp=new THREE.Vector3(),col=new THREE.Color();
    function pintar(arr,i,c,k){arr[i*3]=c.r*k;arr[i*3+1]=c.g*k;arr[i*3+2]=c.b*k;}

    function dibujar(t,dT){
      const T=S.T,e=S.energy,paso=dT/16.7;

      // Gestos → vista
      pivote.rotation.set(0.38+S.tilt*0.9,S.rot,0,'YXZ');
      camara.position.set(0,0.1,distBase/S.zoom);camara.lookAt(0,0,0);

      // Disco
      disco.rotation.y=T*0.00008;
      lineasPistas.forEach((l,i)=>{l.material.color.copy(tono(t,i*0.2,S,col));l.material.opacity=alfa(0.35,S);});
      for(let i=0;i<nodosPos.length;i++)pintar(nodosCol,i,tono(t,Math.floor(i/2)*0.2,S,col),alfa(0.8,S));
      gNodos.attributes.color.needsUpdate=true;
      const visiblesPulsos=Math.max(0,(e-0.3)/0.7);
      pistas.forEach((p,i)=>{
        const f=((T*0.00025*p.sp)+p.ph)%1;puntoEn(p,f,tmp);
        pulPos[i*3]=tmp.x;pulPos[i*3+1]=tmp.y+0.004;pulPos[i*3+2]=tmp.z;
        pintar(pulCol,i,tono(t,i,S,col),visiblesPulsos);
      });
      gPul.attributes.position.needsUpdate=true;gPul.attributes.color.needsUpdate=true;
      anilloMarcas.rotation.y=-T*0.0002-disco.rotation.y;
      mMarcas.color.copy(tono(t,0.5,S,col));mMarcas.opacity=alfa(0.6,S);
      barrido.rotation.y=-T*0.002-disco.rotation.y;
      mBarrido.color.copy(tono(t,1,S,col));mBarrido.opacity=alfa(0.9*e,S);
      mVelo.color.copy(tono(t,0.3,S,col));

      // Giroscopio: cada anillo gira sobre un eje distinto dentro del anterior
      anillos.forEach(({k,cardan,mA,mP,punteado})=>{
        const v=T*0.0004*(k%2?-1:1)+k;
        if(k===3)cardan.rotation.set(Math.PI/2,v,0);
        else if(k%2)cardan.rotation.set(v,0,0);
        else cardan.rotation.set(0,v,0);
        punteado.rotation.z=T*0.001;
        mA.color.copy(tono(t,k,S,col));mA.opacity=alfa(0.55,S);
        mP.color.copy(tono(t,k+0.5,S,col));mP.opacity=alfa(0.6,S);
      });

      // Núcleo que pulsa
      const pulso=0.5+0.5*Math.sin(T*0.004);
      nucleo.scale.setScalar(1+0.25*pulso*e);
      mNuc.color.copy(tono(t,0,S,col));mNuc.opacity=alfa(0.5+0.4*pulso,S);
      malla.rotation.set(T*0.0003,T*0.0005,0);
      mMalla.color.copy(tono(t,0.2,S,col));mMalla.opacity=alfa(0.35+0.25*pulso,S);
      halo.scale.setScalar(R*(0.45+0.15*pulso*e));
      mHalo.color.copy(tono(t,0,S,col));mHalo.opacity=alfa(0.25+0.45*pulso*e,S);
      mHaz.color.copy(tono(t,0.4,S,col));mHaz.opacity=0.04+0.05*e;

      // Partículas: suben en espiral y renacen abajo
      const n=Math.min(MAX,S.particles|0);
      for(let i=0;i<MAX;i++){
        const p=parts[i];
        if(i<n){
          p.a+=p.s*S.speed*3*paso*(0.2+0.8*e);
          p.r+=0.0012*S.speed*e*paso;p.y+=0.0016*S.speed*e*paso;
          if(p.r>R||p.y>0.6){p.r=R*0.1+rand()*0.2;p.y=-0.42;}
          pPos[i*3]=Math.cos(p.a)*p.r;pPos[i*3+1]=p.y;pPos[i*3+2]=Math.sin(p.a)*p.r;
          pintar(pCol,i,tono(t,i*0.1,S,col),(0.3+0.6*p.z)*e);
        }else pintar(pCol,i,col.setRGB(0,0,0),0);
      }
      gPart.attributes.position.needsUpdate=true;gPart.attributes.color.needsUpdate=true;

      renderer.render(escena,camara);
    }

    function destruir(){
      recursos.forEach(r=>r.dispose&&r.dispose());
      renderer.dispose();renderer.domElement.remove();
    }

    return {redimensionar,dibujar,destruir};
  }
};
