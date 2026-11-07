/* ============================================================
   Escena «Indicador»: canvas 2D con anillos tipo giroscopio,
   pistas de circuito con pulsos, partículas, marcas en el borde,
   arco de barrido y núcleo que pulsa.

   Contrato de escena (ver js/escenas/registro.js):
     crear(contenedor, S) -> { redimensionar(w, h), dibujar(t, dT), destruir() }
   ============================================================ */

/* ---------- Aleatorio con semilla: el diseño no cambia al redimensionar ---------- */
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function makeTraces(R,n,rand){
  const out=[];
  for(let i=0;i<n;i++){
    let a=rand()*6.28,r=R*(0.3+rand()*0.55);const pts=[[a,r]];
    const steps=3+Math.floor(rand()*4);
    for(let k=0;k<steps;k++){
      if(k%2){r+=R*(rand()<0.5?-1:1)*(0.05+rand()*0.1);r=Math.max(R*0.25,Math.min(R*0.9,r));}
      else a+=(rand()-.5)*0.6;
      pts.push([a,r]);
    }
    out.push({pts,ph:rand(),sp:0.5+rand()});
  }
  return out;
}

/* ---------- Un indicador dibujado en un canvas ---------- */
function Indicator(canvas,S,{small=false,interactive=false}={}){
  const x=canvas.getContext('2d');
  let W=0,R=0,u=1,tr=[],parts=[];
  const rand=rng(small?7:42);

  /* Color: azul↔morado al trabajar, gris plateado en reposo */
  function col(t,a,off){
    const e=S.energy, h=242+33*Math.sin(t*0.00035+(off||0));
    return `hsla(${h},${8+77*e}%,${62+4*e}%,${Math.min(1,a*(0.55+0.45*e))})`;
  }

  function resize(cssW,cssH){
    const dpr=Math.min(window.devicePixelRatio||1,2);   // límite de nitidez = rendimiento
    canvas.width=Math.max(1,Math.round(cssW*dpr));canvas.height=Math.max(1,Math.round(cssH*dpr));
    W=Math.min(canvas.width,canvas.height);R=W*0.44;u=W/400;
    const r2=rng(small?7:42);
    tr=makeTraces(R,small?10:34,r2);
    syncParticles(true);
  }
  function syncParticles(rebuild){
    const n=small?16:S.particles;
    if(rebuild)parts=[];
    while(parts.length<n)parts.push({a:rand()*6.28,r:rand()*R,s:(rand()-.5)*0.02,z:rand()});
    parts.length=n;
  }
  const toXY=(a,r)=>[Math.cos(a)*r,Math.sin(a)*r];
  function path(pts){
    x.beginPath();
    pts.forEach((p,i)=>{
      if(i===0){const q=toXY(p[0],p[1]);x.moveTo(q[0],q[1]);return;}
      const pr=pts[i-1];
      if(p[1]===pr[1])x.arc(0,0,p[1],pr[0],p[0],p[0]<pr[0]);
      else{const q=toXY(p[0],p[1]);x.lineTo(q[0],q[1]);}
    });
  }

  function draw(t,dT){
    const T=S.T,e=S.energy;
    if(!small)syncParticles(false);
    x.setTransform(1,0,0,1,0,0);
    x.clearRect(0,0,canvas.width,canvas.height);
    x.globalCompositeOperation='lighter';
    x.translate(canvas.width/2,canvas.height/2);
    if(interactive){x.scale(S.zoom,S.zoom);x.rotate(S.rot);}
    x.lineWidth=Math.max(1,u);

    // Pistas de circuito, nodos y pulsos
    x.save();x.rotate(T*0.00008);
    tr.forEach((q,i)=>{
      x.strokeStyle=col(t,0.35,i*0.2);path(q.pts);x.stroke();
      [q.pts[0],q.pts[q.pts.length-1]].forEach(p=>{
        const v=toXY(p[0],p[1]);x.fillStyle=col(t,0.8,i*0.2);
        x.beginPath();x.arc(v[0],v[1],2.2*u,0,6.28);x.fill();
      });
      if(!small&&e>0.3){
        const f=((T*0.00025*q.sp)+q.ph)%1,n=q.pts.length-1,idx=Math.floor(f*n),loc=f*n-idx;
        const p0=q.pts[idx],p1=q.pts[idx+1];
        const v=toXY(p0[0]+(p1[0]-p0[0])*loc,p0[1]+(p1[1]-p0[1])*loc);
        x.fillStyle=col(t,e,i);x.beginPath();x.arc(v[0],v[1],3*u,0,6.28);x.fill();
      }
    });
    x.restore();

    // Anillos tipo giroscopio (la inclinación responde al arrastre vertical)
    for(let k=0;k<4;k++){
      const rr=R*(0.38+k*0.19);
      let tilt=0.25+0.6*Math.abs(Math.sin(T*0.0003+k));
      if(interactive)tilt=Math.max(0.06,Math.min(1,tilt+S.tilt));
      x.save();x.rotate(T*0.0004*(k%2?-1:1)+k);
      x.strokeStyle=col(t,0.55,k);
      x.beginPath();x.ellipse(0,0,rr,rr*tilt,0,0,6.28);x.stroke();
      x.setLineDash([2*u,6*u]);
      x.beginPath();x.ellipse(0,0,rr*1.04,rr*tilt*1.04,0,T*0.001,T*0.001+3.5);x.stroke();
      x.setLineDash([]);x.restore();
    }

    // Marcas del borde y arco de barrido
    x.save();x.rotate(-T*0.0002);
    for(let i=0;i<72;i++){
      const a=i/72*6.28,l=(i%6?4:10)*u;x.strokeStyle=col(t,0.6,a);
      x.beginPath();x.moveTo(Math.cos(a)*R,Math.sin(a)*R);x.lineTo(Math.cos(a)*(R-l),Math.sin(a)*(R-l));x.stroke();
    }
    const sw=T*0.002;x.strokeStyle=col(t,0.9*e,1);x.lineWidth=W/120;
    x.beginPath();x.arc(0,0,R*0.93,sw,sw+0.9);x.stroke();
    x.restore();x.lineWidth=Math.max(1,u);

    // Partículas
    const k=dT/16.7;
    parts.forEach((p,i)=>{
      p.a+=p.s*S.speed*3*k*(0.2+0.8*e);p.r+=0.15*S.speed*e*k*u*2.5;
      if(p.r>R)p.r=R*0.1;
      x.fillStyle=col(t,(0.3+0.6*p.z)*e,i*0.1);
      x.beginPath();x.arc(Math.cos(p.a)*p.r,Math.sin(p.a)*p.r*0.8,(1+p.z*2)*u,0,6.28);x.fill();
    });

    // Núcleo que pulsa
    const pulse=0.5+0.5*Math.sin(T*0.004);
    x.strokeStyle=col(t,0.6+0.4*pulse,0);x.lineWidth=W/150;
    x.beginPath();x.arc(0,0,R*(0.1+0.03*pulse*e),0,6.28);x.stroke();
    x.fillStyle=col(t,0.3+0.5*pulse*e,0);
    x.beginPath();x.arc(0,0,R*0.06,0,6.28);x.fill();
    x.globalCompositeOperation='source-over';
  }
  return {resize,draw};
}

/* ---------- Escena ---------- */
export default {
  id: 'indicador',
  nombre: 'Indicador',

  crear(contenedor, S){
    // Canvas principal (interactivo) a pantalla completa
    const bigC=document.createElement('canvas');
    bigC.className='escena';
    // Vista previa a 48 px (tamaño de ícono) en la esquina
    const mini=document.createElement('div');
    mini.className='mini';
    const smallC=document.createElement('canvas');
    const etiqueta=document.createElement('span');
    etiqueta.textContent='48 px';
    mini.append(smallC,etiqueta);
    contenedor.prepend(bigC,mini);

    const big=Indicator(bigC,S,{interactive:true});
    const small=Indicator(smallC,S,{small:true});
    small.resize(48,48);

    return {
      redimensionar(w,h){big.resize(w,h);},
      dibujar(t,dT){big.draw(t,dT);small.draw(t,dT);},
      destruir(){bigC.remove();mini.remove();}
    };
  }
};
