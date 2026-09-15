import { clamp, releaseVelocity, stepBall } from './models.js';
import { control, metrics, fmt, chart, equation } from './common.js';

export function mount(root) {
  root.innerHTML=`<h3>손끝의 속도로 공 던지기</h3><p>공을 잡아 끌다가 놓아보세요. 놓기 직전의 속도로 날아가고 중력에 떨어져 벽과 바닥에서 튕깁니다.</p><div class="mvp-split"><div><canvas class="ball-stage" width="600" height="380" aria-label="드래그해 던질 수 있는 공과 중력 공간"></canvas><div class="mvp-actions"><button data-throw>예시 던지기</button><button data-pause>일시 정지</button><button data-reset>초기화</button></div>${control('ball-gravity','중력 (화면 px/s²)',0,1500,10,600)}${control('ball-bounce','반발계수',0,.95,.05,.8)}<p class="mvp-status" role="status">공을 드래그하세요. 멈춘 뒤 놓으면 던지는 속도는 0이 됩니다.</p></div><aside><div class="mvp-metrics"></div><div class="ball-height"></div><div class="ball-velocity"></div><p class="mvp-note">최근 6초 · 파랑: 바닥에서의 높이 · 주황: 수직 속도(위쪽 +). 충돌 순간 속도는 불연속적으로 바뀝니다.</p></aside></div><details><summary>손끝 위치 → 속도 → 공의 움직임</summary><div class="mvp-equation"></div><p>최근 0.1초의 포인터 위치로 놓는 속도를 추정합니다. 이 값이 공의 초기 속도가 됩니다. 중력으로 속도가 변하고 충돌하면 반발계수만큼 줄어듭니다. 화면 좌표 단위는 px입니다.</p></details>`;
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
  let ball={x:180,y:120,vx:0,vy:0},gravity=600,bounce=.8,paused=false,drag=null,samples=[],history=[],time=0,last=0,accum=0,lastChart=0,frame,release={vx:0,vy:0},impacts=0;
  const pointer=e=>{const rect=canvas.getBoundingClientRect();return{x:(e.clientX-rect.left)*600/rect.width,y:(e.clientY-rect.top)*380/rect.height};};
  const add=(now)=>{samples.push({t:now,x:ball.x,y:ball.y});samples=samples.filter(s=>now-s.t<=150);};
  const down=e=>{if(drag||e.button!==0)return;const p=pointer(e);if(Math.hypot(p.x-ball.x,p.y-ball.y)>30)return;e.preventDefault();drag={id:e.pointerId,dx:p.x-ball.x,dy:p.y-ball.y};canvas.setPointerCapture(e.pointerId);samples=[];ball.vx=ball.vy=0;add(performance.now());paused=false;};
  const move=e=>{if(!drag||drag.id!==e.pointerId)return;const p=pointer(e);ball.x=clamp(p.x-drag.dx,20,580);ball.y=clamp(p.y-drag.dy,20,360);add(performance.now());const v=releaseVelocity(samples,performance.now());ball.vx=v.vx;ball.vy=v.vy;};
  const up=e=>{if(!drag||drag.id!==e.pointerId)return;const now=performance.now();add(now);release=e.type==='pointercancel'?{vx:0,vy:0}:releaseVelocity(samples,now);Object.assign(ball,release);drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);root.querySelector('.mvp-status').textContent=`놓는 속력 ${fmt(Math.hypot(release.vx,release.vy))} px/s · 최근 손끝 움직임에서 추정`;};
  for(const [name,fn] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up]])canvas.addEventListener(name,fn);
  const reset=()=>{if(drag&&canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);drag=null;ball={x:180,y:120,vx:0,vy:0};release={vx:0,vy:0};samples=[];history=[];time=0;impacts=0;paused=false;accum=0;};
  const click=e=>{
    if(e.target.closest('[data-reset]')){reset();root.querySelector('.mvp-status').textContent='공을 드래그하세요.';}
    if(e.target.closest('[data-throw]')){reset();ball.x=100;ball.y=260;ball.vx=470;ball.vy=-500;release={vx:470,vy:-500};root.querySelector('.mvp-status').textContent='예시: 오른쪽 위로 던진 공';}
    if(e.target.closest('[data-pause]'))paused=!paused;
  };
  const input=()=>{gravity=+root.querySelector('#ball-gravity').value;bounce=+root.querySelector('#ball-bounce').value;root.querySelector('#ball-gravity-out').textContent=fmt(gravity);root.querySelector('#ball-bounce-out').textContent=fmt(bounce);};
  root.addEventListener('click',click);root.addEventListener('input',input);
  equation(root.querySelector('.mvp-equation'),String.raw`v_x\approx\frac{\Delta x}{\Delta t},\quad v_h\approx\frac{\Delta h}{\Delta t},\quad a_h=-g`);
  function draw(){
    ctx.clearRect(0,0,600,380);ctx.fillStyle='#f1f5fb';ctx.fillRect(0,0,600,380);
    ctx.fillStyle='#d5dfec';ctx.fillRect(0,372,600,8);
    const trail=history.slice(-35);ctx.strokeStyle='#aac8e766';ctx.lineWidth=3;ctx.beginPath();trail.forEach((p,i)=>i?ctx.lineTo(p.x,380-p.h):ctx.moveTo(p.x,380-p.h));ctx.stroke();
    const gradient=ctx.createRadialGradient(ball.x-7,ball.y-8,2,ball.x,ball.y,23);gradient.addColorStop(0,'#91c9ff');gradient.addColorStop(1,'#2464a9');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(ball.x,ball.y,20,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#e2a33b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ball.x,ball.y);ctx.lineTo(ball.x+ball.vx*.08,ball.y+ball.vy*.08);ctx.stroke();
    ctx.fillStyle='#526c8a';ctx.font='14px sans-serif';ctx.fillText(drag?'잡고 있는 중':paused?'일시 정지':'공을 잡고 튕겨보세요',18,28);
  }
  function graphs(){
    const xmin=Math.max(0,time-6),xmax=Math.max(6,time);
    root.querySelector('.ball-height').innerHTML=chart([{color:'#2464ad',points:history.map(p=>[p.t,p.h])}],{xmin,xmax,ymax:380,label:'시간 (s) → 높이 h (px)'});
    root.querySelector('.ball-velocity').innerHTML=chart([{color:'#d98531',points:history.map(p=>[p.t,p.v])}],{xmin,xmax,ymin:-1600,ymax:1600,label:'시간 (s) → 수직 속도 dh/dt (px/s)'});
    root.querySelector('.mvp-metrics').innerHTML=metrics([['현재 속력',`${fmt(Math.hypot(ball.vx,ball.vy),0)} px/s`],['놓을 때 속력',`${fmt(Math.hypot(release.vx,release.vy),0)} px/s`],['수직 속도 (위쪽 +)',`${fmt(-ball.vy,0)} px/s`],['충돌 횟수',impacts]]);
    root.querySelector('[data-pause]').textContent=paused?'계속 재생':'일시 정지';
  }
  function tick(now){
    const elapsed=last?Math.min((now-last)/1000,.05):0;last=now;
    if(!paused){accum+=elapsed;while(accum>=1/120){
      if(!drag){if(stepBall(ball,1/120,gravity,bounce))impacts++;}
      time+=1/120;accum-=1/120;
    }
    if(drag){const vel=releaseVelocity(samples,performance.now());ball.vx=vel.vx;ball.vy=vel.vy;}
    history.push({t:time,x:ball.x,h:380-ball.y,v:-ball.vy});history=history.filter(p=>p.t>=time-6);
    }
    draw();if(now-lastChart>80){graphs();lastChart=now;}frame=requestAnimationFrame(tick);
  }
  graphs();frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);if(drag&&canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);for(const [name,fn] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up]])canvas.removeEventListener(name,fn);root.removeEventListener('click',click);root.removeEventListener('input',input);};
}
