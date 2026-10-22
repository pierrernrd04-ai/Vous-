/* Ambrel V4 « Film cinématique » : WebGL2 shot shaders + post (grain, bloom, light leaks, letterbox).
   Classic script -> window.FILM. Everything is a pure function of the uniforms set from t. */
(function () {
  'use strict';

  const COMMON = `
precision highp float;
uniform vec2 uRes;
uniform float uT;
out vec4 outColor;
#define PI 3.14159265
#define S(a,b,x) smoothstep(a,b,x)
float sat(float x){return clamp(x,0.,1.);}
float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
vec3 hash32(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yxz+33.33);return fract((p3.xxy+p3.yzz)*p3.zyx);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y);}
float noise1(float x){float i=floor(x),f=fract(x);return mix(hash11(i),hash11(i+1.),f*f*(3.-2.*f));}
const mat2 RM=mat2(1.6,1.2,-1.2,1.6);
float fbm(vec2 p,int o){float s=0.,a=.5,n=0.;for(int i=0;i<8;i++){if(i>=o)break;s+=a*vnoise(p);n+=a;p=RM*p+vec2(3.1,1.7);a*=.5;}return s/n;}
float fbmB(vec2 p,int o,float blur){float s=0.,a=.5,n=0.,f=1.;for(int i=0;i<8;i++){if(i>=o)break;float w=exp(-f*f*blur*blur*3.);s+=a*w*(vnoise(p)-.5);n+=a;p=RM*p+vec2(3.1,1.7);a*=.5;f*=2.;}return .5+1.6*s/n;}
float fbm1(float x,int o){float s=0.,a=.5,n=0.;for(int i=0;i<8;i++){if(i>=o)break;s+=a*noise1(x);n+=a;x=x*2.03+1.37;a*=.5;}return s/n;}
vec2 P(){return (gl_FragCoord.xy-.5*uRes)/uRes.y;}
// one soft bokeh disc per grid cell (radius < .2 cell): returns intensity
float bokeh(vec2 p,float cell,float seed,float rmin,float rmax,float dens,float soft){
  vec2 g=p/cell;vec2 id=floor(g);vec2 f=fract(g);
  vec3 h=hash32(id+seed*13.1);
  if(h.z>dens)return 0.;
  vec2 c=.25+.5*h.xy;float r=mix(rmin,rmax,hash12(id+seed+7.3))/cell;
  float d=length(f-c);
  float disc=S(r,r*(1.-soft),d);
  float ring=S(r*.55,r*.98,d)*disc;
  return (disc*.7+ring*.45)*(.35+.65*hash12(id+seed+3.7));
}
const vec3 NIGHT=vec3(.122,.165,.220), DAWN=vec3(.310,.380,.459), MIST=vec3(.780,.824,.855);
const vec3 HONEY=vec3(.929,.706,.404), AMBER=vec3(.769,.435,.157), AMBERD=vec3(.494,.247,.078);
const vec3 CREAM=vec3(.965,.937,.894), STONE=vec3(.847,.808,.749), CLAYD=vec3(.431,.353,.271);
`;

  // ------------------------------------------------------------------ S1 Éveil : vallée minérale, aube bleue
  const S1 = `
uniform float uZoom, uDrift, uDawn;
const vec2 SUN=vec2(.30,-.035);
vec3 skyCol(vec2 p){
  vec3 c=mix(MIST*.93,vec3(.30,.39,.50),S(-.07,.17,p.y));
  c=mix(c,vec3(.13,.18,.26),S(.14,.40,p.y));
  vec2 d=(p-SUN)*vec2(.55,1.3);float r=length(d);
  float glow=exp(-r*2.8);
  c+=HONEY*glow*(.13+.20*uDawn);
  c+=vec3(1.,.90,.78)*exp(-r*9.)*(.20+.22*uDawn);
  float cl=fbm(vec2(p.x*1.25+uT*.010,p.y*11.+2.),5);
  float band=S(.02,.10,p.y)*S(.33,.14,p.y);
  c=mix(c,c*1.05+HONEY*glow*.45+vec3(.035),S(.50,.72,cl)*band*.6);
  return c;
}
float baseY(float fi){return -.012-.052*fi;}
float ridgeH(float x,float fi){
  float amp=.060+.018*fi;
  float fr=1.35+.55*fi;
  float v=S(.02,.80,abs(x-.06*sin(fi*2.3)));
  float n=fbm1(x*fr+fi*17.3,6);
  float rg=1.-abs(2.*fbm1(x*fr*1.7+fi*5.1,5)-1.);
  float h=mix(n,rg,.45);
  return baseY(fi)+amp*(.25+1.25*v)*h*1.5-amp*(.55-.25*fi/4.)*(1.-v);
}
vec3 layerCol(float fi,float dy,float x){
  float haze=mix(.86,.05,fi/4.);
  vec3 c=mix(NIGHT*.60,mix(DAWN,MIST,.50),haze);
  float fog=S(.0,.14,dy)*(.30+.45*haze);
  c=mix(c,mix(DAWN,MIST,.62+.3*haze),fog*.55);
  float rim=exp(-dy*uRes.y*.010)*(.20+.80*exp(-abs(x-SUN.x)*2.4))*(1.-fi*.2);
  c+=vec3(.80,.80,.84)*rim*.16+HONEY*rim*.10*(.4+uDawn);
  // faint rock texture on near layers
  c*=1.+(fbm(vec2(x*14.,dy*30.+fi),3)-.5)*.10*(fi/4.);
  return c;
}
vec2 lay(vec2 p,float fi){float k=.12+.88*fi/4.;return p/(1.+(uZoom-1.)*(.25+.75*k))+vec2(uDrift*k,0.);}
// sky + layers 0..nL (with valley mist); sm = remaining sky visibility
vec3 farScene(vec2 p,float nL,out float sm){
  vec3 col=skyCol(p/(1.+(uZoom-1.)*.2)+vec2(uDrift*.04,0.));
  sm=1.;
  for(int i=0;i<4;i++){
    float fi=float(i); if(fi>nL)break;
    vec2 q=lay(p,fi);
    float h=ridgeH(q.x,fi);
    float aa=(1.2+3.5*(1.-fi/4.))/uRes.y;
    float cov=S(-aa,aa,h-q.y);
    if(cov>0.){col=mix(col,layerCol(fi,h-q.y,q.x),cov);sm*=1.-cov;}
    float b=baseY(fi);
    float band=S(b-.12,b-.04,q.y)*S(b+.075,b+.005,q.y);
    if(band>.002){
      float m=fbm(vec2(q.x*2.0+uT*(.020+.014*fi)+fi*7.,q.y*8.5+fi*3.),4);
      m=S(.40,.80,m)*band;
      vec3 mc=mix(MIST,vec3(1.),.18)+HONEY*.16*exp(-abs(q.x-SUN.x)*2.2)*(.3+uDawn);
      col=mix(col,mc,m*(.42+.08*fi));
    }
  }
  return col;
}
void main(){
  vec2 p=P();
  float sm;
  vec3 col=farScene(p,3.,sm);
  // crepuscular rays from the hidden sun
  vec2 dv=p-SUN;float ang=atan(dv.y,dv.x);
  float ray=noise1(ang*21.+1.3)*noise1(ang*8.-uT*.05+4.)*1.7;
  col+=vec3(.95,.93,.90)*ray*exp(-length(dv)*1.9)*S(-.01,.12,dv.y)*sm*(.06+.06*uDawn);
  // lake in the valley bottom (reflection of the far scene)
  float lakeY=-.205;
  vec2 q4=lay(p,3.6);
  if(q4.y<lakeY){
    float dd=lakeY-q4.y;
    vec2 rp=vec2(p.x,2.*lakeY-p.y);
    float w1=vnoise(vec2(p.x*26.,dd*260.+uT*.9))-.5;
    float w2=vnoise(vec2(p.x*60.+3.,dd*520.-uT*1.3))-.5;
    rp.x+=(w1*.010+w2*.004)*(.3+dd*6.);
    rp.y+=(w1*.010)*(.3+dd*5.);
    float smr;
    vec3 rc=farScene(rp,3.,smr);
    rc=mix(rc,NIGHT*.9,.22+dd*1.2);
    float glint=exp(-abs(p.x-SUN.x)*7.)*S(.0,.6,w2+.25);
    rc+=vec3(.95,.90,.82)*glint*.14*(1.-dd*3.);
    float edge=S(0.,.004,dd);
    col=mix(col,rc,edge);
    // low mist on the water
    float m=fbm(vec2(p.x*2.6-uT*.03,dd*18.+uT*.02),4);
    col=mix(col,MIST*1.02,S(.45,.85,m)*S(.07,.0,dd)*.45);
  }
  // nearest shore ridges (layer 4), framing the lake
  {
    vec2 q=lay(p,4.);
    float h=-.43+.30*pow(S(.10,.95,abs(q.x+.02)),.9)*(.7+.6*fbm1(q.x*3.1+40.,6))+.012*fbm1(q.x*24.,3);
    float aa=1.3/uRes.y;
    float cov=S(-aa,aa,h-q.y);
    vec3 lc=layerCol(4.,h-q.y,q.x);
    col=mix(col,lc,cov);
  }
  // floating mist droplets (foreground bokeh), two depths
  float bk=bokeh(p*(1.+(uZoom-1.)*1.6)+vec2(uT*.020,uT*.006),.16,2.,.006,.016,.35,.45);
  bk+=.6*bokeh(p*(1.+(uZoom-1.)*2.4)+vec2(uT*.035,-uT*.004),.24,5.,.012,.028,.25,.6);
  col+=vec3(.86,.90,.98)*bk*.10;
  // gentle filmic lift + cool grade
  col=col*.95+vec3(.012,.016,.022);
  outColor=vec4(col,1.);
}`;

  // ------------------------------------------------------------------ S3 Texture : goutte, onde, pierre polie, gélule
  const S3 = `
uniform float uCamX, uCamZ, uFocus, uWarm, uDropH, uStretch, uJet, uCapA, uCapLod;
uniform vec4 uCap;           // x, z, height, rot (rad)
uniform sampler2D uCapTex;
const float FOC=1.6, PITCH=.42, CAMH=1.0, DR=.05, CR=.08, COC=.20;
const vec2 DROP=vec2(0.,2.30);
const vec2 CAPH=vec2(.21,.08);   // capsule half length / radius (world)
vec3 ro,fw,up,rt;
void cam(){ro=vec3(uCamX,CAMH,uCamZ);fw=vec3(0.,-sin(PITCH),cos(PITCH));up=vec3(0.,cos(PITCH),sin(PITCH));rt=vec3(1.,0.,0.);}
vec2 proj(vec3 w){vec3 d=w-ro;float z=dot(d,fw);return vec2(dot(d,rt),dot(d,up))*FOC/z;}
float depthOf(vec3 w){return dot(w-ro,fw);}
// what the wet stone reflects: a soft window (with a cross bar) in a dim room
vec3 env(vec3 r,float blur){
  vec2 a=r.xy/max(r.z,.05);
  vec3 dark=mix(vec3(.075,.085,.10),vec3(.11,.09,.08),uWarm*.6);
  vec3 lightC=mix(vec3(.78,.86,.94),vec3(1.,.87,.68),uWarm*.55);
  float b=.03+blur;
  float win=S(-1.25-b,-1.25+b,a.x)*S(.95+b,.95-b,a.x)*S(.05-b,.05+b,a.y)*S(.70+b,.70-b,a.y);
  float grad=.50+.50*S(.75,.12,a.y)-.18*S(.05,.0,abs(a.x+.2)-.6);
  float mul=S(.018+b,.018-b*.6,abs(a.y-.43));
  win*=1.-.86*sat(mul);
  vec3 c=mix(dark,lightC*1.02*grad,win);
  c+=lightC*.07*exp(-abs(a.y-.3)*2.5);
  return c;
}
vec3 stone(vec2 xz,float blur){
  vec2 q=xz*2.4;
  float w=fbmB(q*.5,4,blur*.5);
  float n=fbmB(q+w*1.5,5,blur);
  float vv=fbmB(q*.7+vec2(w*2.4,.3),6,blur*.7);
  float vw=.010+.045*S(.3,.8,fbmB(q*.9+3.,3,blur));
  float vein=(1.-S(.0,vw+blur*.05,abs(vv-.5)))*(.45+.55*fbmB(q*3.+9.,3,blur*3.));
  float vein2=1.-S(.0,.008+blur*.05,abs(fbmB(q*1.6+vec2(.7,w),5,blur*1.6)-.5));
  vec3 c=mix(vec3(.16,.175,.195),vec3(.30,.32,.35),sat(n));
  c=mix(c,vec3(.62,.66,.70),(vein*.34+vein2*.12)*(1.-sat(blur*1.2)));
  return c;
}
vec2 rippleG(vec2 xz,vec2 c,float tau,float amp,float k,float spd){
  if(tau<=0.)return vec2(0.);
  vec2 d=xz-c;float r=length(d)+1e-4;
  float front=spd*tau+.012;
  float env=S(front,front-.16,r)*exp(-r*1.15)*exp(-tau*.32)*S(0.,.025,r);
  float ph=k*(r-spd*tau);
  return amp*env*cos(ph)*d/r;
}
float sdSeg(vec2 p,vec2 a,vec2 b,out float h){vec2 pa=p-a,ba=b-a;h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
vec3 dropShade(vec2 d,vec3 bg){ // d = local disc coords (|d|<1)
  float r2=dot(d,d);vec3 n=vec3(d,sqrt(max(0.,1.-r2)));
  vec3 inner=mix(vec3(.05,.06,.07),env(vec3(-n.x*.7,.35-n.y*.5,1.),.03),S(.55,-.75,n.y));
  inner=mix(inner,bg,.25);
  float spec=pow(max(dot(n,normalize(vec3(-.35,.55,1.))),0.),70.);
  float spec2=pow(max(dot(n,normalize(vec3(.4,-.6,1.))),0.),18.);
  float fres=pow(1.-n.z,2.5);
  return inner*(1.-fres*.55)+vec3(1.)*spec*1.3+vec3(.9,.95,1.)*spec2*.25+env(vec3(n.x,n.y+.45,1.),.03)*fres*.55;
}
void main(){
  cam();
  vec2 p=P();
  vec3 rd=normalize(p.x*rt+p.y*up+FOC*fw);
  float tt=-ro.y/rd.y;vec3 hp=ro+rd*tt;float dep=dot(hp-ro,fw);
  float coc=abs(1./dep-1./uFocus)*COC;
  float grazing=max(-rd.y,.12);
  float wb=coc*dep/FOC/grazing+dep/(FOC*uRes.y)/grazing*1.6;
  vec2 g=rippleG(hp.xz,DROP,uT-4.6,.14,44.,.42)+rippleG(hp.xz,DROP,uT-5.02,.08,56.,.34)+rippleG(hp.xz,uCap.xy,uT-6.2,.05,60.,.30);
  g/=1.+wb*30.;
  vec3 n=normalize(vec3(-g.x,1.,-g.y));
  vec3 rr=reflect(rd,n);
  float F=.04+.96*pow(1.-max(dot(-rd,n),0.),5.);
  vec3 st=stone(hp.xz+g*.25,wb*2.4);
  float lit=.70+.40*S(1.5,4.5,dep);
  vec3 col=st*lit*mix(vec3(.86,.92,1.),vec3(1.,.91,.80),uWarm*.6);
  vec3 e=env(rr,coc*.6+.006);
  col=mix(col,e,sat(F*2.3+.06));
  // thin water film: slight darkening + sheen
  col*=.94;
  // mineral sparkles
  vec2 sp=hp.xz*90.;vec2 sid=floor(sp);vec2 sf=fract(sp)-.5;
  float hs=hash12(sid);
  float spark=step(.982,hs)*S(.2,.0,length(sf))*pow(.5+.5*sin(uT*2.6+hs*60.),6.)*(1.-sat(wb*14.));
  col+=vec3(.9,.95,1.)*spark*.6;
  // ---- capsule: contact shadow, reflection, sprite
  if(uCapA>0.){
    vec3 cw=vec3(uCap.x,uCap.z+CR,uCap.y);
    vec2 sc=proj(cw);float dc=depthOf(cw);float scl=FOC/dc;
    vec2 hsz=CAPH*scl*vec2(1.07,1.12);
    float cr=cos(uCap.w),sr=sin(uCap.w);
    vec2 cont=proj(vec3(uCap.x,0.,uCap.y));
    float land=S(.4,.0,uCap.z);
    vec2 dq=(p-cont-vec2(.0,.004))/vec2(hsz.x*1.02,hsz.y*.55);
    dq=mat2(cr,sr,-sr,cr)*dq;
    col*=1.-.60*land*exp(-dot(dq,dq)*1.5)*uCapA;
    // reflection in the water film
    vec2 pr=vec2(p.x,2.*cont.y-p.y)+g*.04;
    vec2 lr=mat2(cr,sr,-sr,cr)*(pr-sc);
    vec2 uvr=lr/(hsz*2.)+.5;
    if(uvr.x>0.&&uvr.x<1.&&uvr.y>0.&&uvr.y<1.){
      vec4 cr4=textureLod(uCapTex,uvr,uCapLod+1.8);
      float ra=cr4.a*.22*uCapA*land;
      col=col*(1.-ra)+cr4.rgb*.22*uCapA*land*vec3(.85,.9,.95);
    }
    vec2 l=mat2(cr,sr,-sr,cr)*(p-sc);
    vec2 uv=l/(hsz*2.)+.5;
    if(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.){
      vec4 c4=textureLod(uCapTex,uv,uCapLod);
      vec3 tint=mix(vec3(.70,.75,.81),vec3(.92,.87,.80),uWarm*.6);
      float top=S(.40,.95,uv.y)*c4.a;
      col=col*(1.-c4.a*uCapA)+(c4.rgb*tint+vec3(.08)*top)*uCapA;
    }
  }
  // ---- falling drop
  if(uDropH>-.5){
    vec3 wc=vec3(0.,uDropH+DR,DROP.y);
    vec2 sc=proj(wc);float dd0=depthOf(wc);
    float rs=DR*FOC/dd0;
    float bl=abs(1./dd0-1./uFocus)*COC*.5+1.2/uRes.y;
    vec2 d=(p-sc)/vec2(rs,rs*uStretch);
    float r=length(d);
    float m=S(1.+bl/rs,1.-bl/rs,r);
    if(m>0.){vec2 dd=r>.999?d*(.999/r):d;col=mix(col,dropShade(dd,col),m);}
  }
  // ---- Worthington jet + rebound droplet + crown droplets
  if(uJet>0.&&uJet<.62){
    float tau=uJet;
    vec3 base=vec3(0.,0.,DROP.y);
    float dj=depthOf(base);float scl=FOC/dj;
    float hj=.20*sin(PI*sat(tau/.34))*S(.0,.04,tau);
    float bl=abs(1./dj-1./uFocus)*COC*.5+1.2/uRes.y;
    if(tau<.34){
      vec2 a=proj(base),b=proj(base+vec3(0.,hj,0.));
      float h;float ds=sdSeg(p,a,b,h);
      float rr2=mix(.024,.012,h)*scl;
      float m=S(rr2+bl,rr2-bl,ds);
      if(m>0.){vec2 dd=vec2((p.x-mix(a.x,b.x,h))/rr2,(h-.5)*1.6);col=mix(col,dropShade(clamp(dd,-.99,.99)*.9,col),m*.95);}
    }
    if(tau>.15){
      float t2=tau-.15;float y=.19+.75*t2-3.2*t2*t2;
      if(y>0.){
        vec3 wc=base+vec3(0.,y+.02,0.);vec2 sc=proj(wc);float rs=.02*scl;
        vec2 d=(p-sc)/rs;float r=length(d);
        float m=S(1.+bl/rs,1.-bl/rs,r);
        if(m>0.){vec2 dd=r>.999?d*(.999/r):d;col=mix(col,dropShade(dd,col),m);}
      }
    }
    if(tau<.30){
      for(int i=0;i<8;i++){
        float fi=float(i);float an=fi*.785+.4;float spd=.40+.30*hash11(fi*3.7);
        float y=.75*tau-4.5*tau*tau;
        if(y<=0.)continue;
        vec3 wc=base+vec3(cos(an)*spd*tau,y+.008,sin(an)*spd*tau);
        vec2 sc=proj(wc);float rs=(.007+.006*hash11(fi))*scl;
        float r=length(p-sc)/rs;
        float m=S(1.25,.75,r);
        col=mix(col,vec3(.92,.96,1.)*(.55+.45*S(.2,-.6,(p.y-sc.y)/rs)),m*.85);
      }
    }
  }
  col=col*.97+vec3(.008,.010,.013);
  outColor=vec4(col,1.);
}
`;

  // ------------------------------------------------------------------ S4 Geste : fenêtre en lin, mains, verre d'eau
  const S4 = `
uniform float uWarm, uRoll, uZoom, uPour;
uniform sampler2D uFG;
vec3 lightBehind(vec2 p){
  vec3 cold=vec3(.62,.70,.80),warm=vec3(1.,.79,.52);
  vec3 c=mix(cold,warm,uWarm);
  vec2 hs=vec2(-.30,.20+.05*uWarm);
  float hot=exp(-length((p-hs)*vec2(.75,1.))*2.4);
  return c*(.50+.30*uWarm)+mix(vec3(.85,.90,.97),vec3(1.,.90,.72),uWarm)*hot*(.55+.75*uWarm);
}
vec3 curtain(vec2 p,vec3 L){
  float f=sin(p.x*31.+2.3*sin(p.x*5.5+uT*.32)+.8*sin(p.y*2.4+uT*.50+p.x*3.6));
  float f2=sin(p.x*12.-uT*.18+1.2*sin(p.y*1.6+uT*.38));
  float trans=.60+.15*f+.11*f2;
  float hem=S(.30,.36,p.y)*.0;
  vec3 c=L*trans*vec3(1.,.975,.94);
  // linen slub texture (soft, out of focus)
  c*=1.+(vnoise(vec2(p.x*90.,p.y*9.))-.5)*.05;
  return c;
}
void main(){
  vec2 p0=P();
  float cr=cos(uRoll),sr=sin(uRoll);
  vec2 p=mat2(cr,-sr,sr,cr)*p0/uZoom+vec2(0.,.0);
  vec3 L=lightBehind(p);
  vec3 col;
  float tableY=-.165;
  if(p.y>tableY){
    // gap between the two linen panels: the bright morning outside
    float gapL=-.40+.012*sin(uT*.6+p.y*3.), gapR=-.27+.015*sin(uT*.5+p.y*2.6+1.);
    float gap=S(gapL-.05,gapL+.05,p.x)*S(gapR+.05,gapR-.05,p.x)*.85;
    vec3 outside=L*1.12+vec3(.05);
    vec3 cur=curtain(p,L);
    // folds gather near the gap (darker edge of each panel)
    float edge=exp(-abs(p.x-gapL)*40.)+exp(-abs(p.x-gapR)*40.);
    cur*=1.-.20*edge;
    col=mix(cur,outside,gap);
    // window frame (dark, backlit, out of focus)
    float fr=S(.040,.015,abs(abs(p.x+.02)-.80));
    float inWin=S(.82,.78,abs(p.x+.02));
    vec3 wall=mix(vec3(.075,.07,.07),vec3(.20,.14,.10),uWarm)*(1.+.25*p.y);
    col=mix(wall,col,inWin);
    col=mix(col,wall*.8,fr*.9);
    // sill line
    float sill=S(.03,.0,p.y-tableY);
    col=mix(col,col*.55,sill*.6);
  }else{
    // stone table, perspective, lit from the window behind
    float z=.09/(tableY-p.y+.035);
    vec2 tq=vec2(p.x*z*3.,z*2.);
    float n=fbmB(tq*1.2,4,.25/z);
    vec3 st=mix(vec3(.50,.47,.43),vec3(.62,.58,.53),n);
    st=mix(st*.55,st,S(-.37,tableY,p.y));
    vec3 c=st*mix(vec3(.72,.78,.86),vec3(1.,.86,.68),uWarm)*.85;
    // polished sheen reflecting the window
    float sheen=exp(-(tableY-p.y)*9.)*(.55+.45*S(.85,.2,abs(p.x+.1)));
    c+=lightBehind(vec2(p.x,tableY+(tableY-p.y)*.8))*sheen*.38;
    // glass shadow toward the camera with a bright caustic inside
    vec2 gs=vec2(0.,-.270);
    vec2 sd=(p-gs)*vec2(1.,1.);
    float sh=S(.13,.04,abs(sd.x*1.2+sd.y*.15))*S(.02,-.02,sd.y)*S(-.20,-.06,sd.y);
    c*=1.-.40*sh;
    float caus=exp(-pow((sd.x+.01)/.035,2.)-pow((sd.y+.08)/.03,2.))*(.4+.6*uPour);
    c+=mix(vec3(.8,.9,1.),HONEY,uWarm)*caus*.55;
    col=c;
  }
  // volumetric shafts from the gap
  vec2 src=vec2(-.33,.42);
  vec2 dv=p-src;float ang=atan(dv.x,-dv.y);
  float ray=noise1(ang*16.+uT*.12)*noise1(ang*41.-uT*.07+3.)*1.6;
  float beam=S(.05,.32,ang+.10)*S(1.05,.55,ang);
  float shaft=ray*beam*exp(-length(dv)*.9)*S(.25,-.1,p.y-.2);
  vec3 shaftC=mix(vec3(.80,.88,.98),vec3(1.,.84,.58),uWarm);
  // dust in the shafts
  float dust=bokeh(p+vec2(-uT*.010,uT*.012),.035,11.,.0012,.0030,.5,.5)*beam;
  // foreground (hands, carafe, glass) with light wrap
  vec2 uv=gl_FragCoord.xy/uRes;
  vec4 fg=texture(uFG,uv);
  float ab=textureLod(uFG,uv,2.2).a;
  float wrap=sat(fg.a*(1.-ab)*1.6);
  vec3 wrapC=mix(vec3(.70,.78,.90),vec3(1.,.62,.34),uWarm)*(.55+.6*uWarm);
  vec3 fgc=fg.rgb+wrapC*wrap*.45*fg.a;
  col=col*(1.-fg.a)+fgc;
  col+=shaftC*(shaft*(.13+.14*uWarm)+dust*.35);
  col=col*.97+vec3(.010,.008,.007);
  outColor=vec4(col,1.);
}`;

  // ------------------------------------------------------------------ S7 Héros : pot sur socle de pierre, rayon, orbite
  const S7 = `
uniform float uOrbit, uZoom, uBeam, uLift;
uniform vec3 uPed;           // pedestal top centre (p coords x,y), radius
uniform sampler2D uFG;
vec3 backdrop(vec2 p){
  vec2 q=p+vec2(-uOrbit*.35,0.);
  vec3 c=mix(vec3(.16,.095,.055),vec3(.30,.18,.10),S(-.4,.3,q.y));
  // halo behind the jar
  float h=exp(-length((p-vec2(uPed.x,.04))*vec2(.95,.75))*2.6);
  c+=vec3(.86,.52,.24)*h*.55+HONEY*exp(-length((p-vec2(uPed.x,.06))*vec2(1.,.8))*6.)*.30;
  // big soft window shape upper left (light source), out of focus
  vec2 w=q-vec2(-.70,.24);
  float win=S(.16,.05,max(abs(w.x)-.10,abs(w.y)-.20));
  c+=vec3(1.,.82,.58)*win*.38*uBeam;
  // stone wall texture, very soft
  c*=1.+(fbm(q*3.+vec2(1.,2.),4)-.5)*.16;
  // background bokeh
  float bk=bokeh(q*1.0+vec2(4.,0.),.11,21.,.010,.026,.40,.35);
  c+=vec3(1.,.74,.42)*bk*.16;
  return c;
}
void main(){
  vec2 p=(P()-vec2(0.,0.))/uZoom;
  vec3 col=backdrop(p);
  float R=uPed.z, ry=R*.15;
  vec2 c0=uPed.xy;
  float dx=(p.x-c0.x)/R;
  // pedestal body (cylinder) + top
  if(abs(dx)<1.){
    float yFront=c0.y-ry*sqrt(1.-dx*dx);
    float yBack=c0.y+ry*sqrt(1.-dx*dx);
    float th=asin(dx);
    vec3 n=vec3(dx,0.,cos(th));
    vec3 Ld=normalize(vec3(-.65,.35,.70));
    float aa=1.5/uRes.y;
    if(p.y<yFront+aa){
      float u=th+uOrbit;
      float str=fbm(vec2(u*2.2,(p.y-c0.y)*26.),5);
      float pores=S(.78,.86,fbm(vec2(u*9.,(p.y-c0.y)*60.)+7.,4));
      vec3 base=mix(vec3(.62,.56,.49),STONE,str*.9);
      base*=1.-.20*pores;
      float dif=max(dot(n,Ld),0.);
      vec3 sc=base*(.18+.95*dif)*vec3(1.,.93,.84);
      sc+=vec3(1.,.8,.55)*pow(max(dot(reflect(-Ld,n),vec3(0.,0.,1.)),0.),18.)*.12;
      // top edge highlight (bevel)
      sc+=vec3(1.,.88,.70)*exp(-(yFront-p.y)*uRes.y*.08)*.35*(.4+dif);
      // darker toward the bottom (falloff)
      sc*=S(-.62,c0.y-.02,p.y)*.55+.45;
      float m=S(yFront+aa,yFront-aa,p.y);
      col=mix(col,sc,m);
    }
    if(p.y>=yFront-aa&&p.y<=yBack+aa){
      // top surface
      vec2 tq=vec2(dx,(p.y-c0.y)/ry);
      float tex=fbm(vec2(tq.x*3.+uOrbit*1.5,tq.y*1.2)*2.,4);
      vec3 top=mix(vec3(.74,.68,.60),vec3(.90,.85,.78),tex)*1.02;
      top*=.80+.25*S(.8,-.6,tq.x);
      // jar shadow (light from upper left -> falls to the right/back)
      vec2 sq=(tq-vec2(.22,.30))/vec2(.62,.55);
      float sh=exp(-dot(sq,sq)*1.6);
      top*=1.-.55*sh;
      // amber caustic: light through the amber glass
      vec2 cq=(tq-vec2(.30,.18))/vec2(.30,.42);
      float cm=exp(-dot(cq,cq)*2.);
      float ct=.6+.4*sin(tq.x*24.+uT*.8+sin(tq.y*9.))*sin(tq.y*14.-uT*.6);
      top+=vec3(.95,.55,.18)*cm*ct*.55*uBeam;
      // contact occlusion under the jar base
      vec2 oq=tq/vec2(.62,.62);
      top*=1.-.45*S(1.1,.55,length(oq));
      top*=1.-.55*exp(-pow((tq.y+.06)/.16,2.))*S(.66,.48,abs(tq.x));
      float inTop=S(yBack+aa,yBack-aa,p.y)*S(yFront-aa,yFront+aa,p.y);
      col=mix(col,top,inTop);
    }
  }
  // jar (foreground canvas) with light wrap from the halo
  vec2 uv=gl_FragCoord.xy/uRes;
  vec4 fg=texture(uFG,uv);
  float ab=textureLod(uFG,uv,3.).a;
  float wrap=sat(fg.a*(1.-ab)*2.2);
  col=col*(1.-fg.a)+fg.rgb+vec3(1.,.70,.40)*wrap*.28*fg.a;
  // volumetric beam from upper left toward the jar + golden dust
  vec2 a=vec2(-1.05,.62),b=vec2(uPed.x+.05,-.05);
  vec2 ba=b-a,pa=p-a;float h=dot(pa,ba)/dot(ba,ba);
  float dist=length(pa-ba*h);
  float wdt=mix(.05,.20,sat(h));
  float beam=S(wdt,wdt*.25,dist)*S(-.05,.25,h)*S(1.25,.75,h);
  float haze=.65+.35*fbm(vec2(h*4.-uT*.08,dist*14.+uT*.05),4);
  col+=vec3(1.,.80,.52)*beam*haze*.13*uBeam;
  float dust=bokeh(p+vec2(uOrbit*.25-uT*.006,uT*.010),.036,31.,.0014,.0032,.30,.5);
  float dust2=bokeh(p*1.0+vec2(uOrbit*.6+uT*.004,uT*.016),.075,37.,.004,.010,.30,.65);
  col+=vec3(1.,.83,.55)*(dust*(.25+1.3*beam)+dust2*.10*(.3+beam))*uBeam;
  // foreground out-of-focus golden dust (strong parallax)
  float fgB=bokeh(p*.8+vec2(uOrbit*1.4,uT*.012),.30,41.,.022,.05,.35,.7);
  col+=vec3(1.,.72,.38)*fgB*.08*uBeam;
  col=col*.98+vec3(.012,.008,.005);
  outColor=vec4(col,1.);
}`;

  // ------------------------------------------------------------------ S9 Détail lumière : verre ambré, caustiques
  const S9 = `
uniform float uSlide, uSweep, uDim, uLight;
float caustic(vec2 uv,float t){
  vec2 p=mod(uv*6.2831,6.2831)-250.;
  vec2 i=p;float c=1.;float inten=.005;
  for(int n=0;n<5;n++){
    float tt=t*(1.-(3.5/float(n+1)));
    i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));
    c+=1./length(vec2(p.x/(sin(i.x+tt)/inten),p.y/(cos(i.y+tt)/inten)));
  }
  c/=5.;c=1.17-pow(c,1.4);
  return pow(abs(c),8.);
}
void main(){
  vec2 p0=P();
  float ra=-.09;vec2 p=mat2(cos(ra),-sin(ra),sin(ra),cos(ra))*p0+vec2(uSlide,0.);
  // the jar seen slightly from above: horizontal edges bow into a gentle smile
  float bow=.05*p.x*p.x;
  float lidY=.250+bow;
  float labY=-.250+bow;
  // glass curvature across x (very large cylinder)
  float cx=p.x*.55;
  float curv=1.-cx*cx;
  vec3 deep=vec3(.15,.055,.012), mid=vec3(.50,.21,.05), hot=vec3(.98,.62,.24);
  float back=exp(-pow((p.x-.35)/.75,2.))*(.55+.45*uLight);
  vec3 glass=mix(deep,mid,back*curv);
  // capsules inside, out of focus
  float caps=0.;
  for(int i=0;i<6;i++){
    float fi=float(i);
    vec2 c=vec2(-1.05+fi*.44+.10*sin(fi*2.1),-.05+.17*sin(fi*1.9+.5));
    float an=.7*sin(fi*2.9)+.3;
    vec2 d=p-c;d=mat2(cos(an),-sin(an),sin(an),cos(an))*d;
    float sdv=length(vec2(max(abs(d.x)-.13,0.),d.y))-.065;
    caps+=S(.045,-.035,sdv)*(.55+.45*hash11(fi));
  }
  glass=mix(glass,mix(vec3(.80,.45,.15),hot,.35*back),sat(caps)*.55);
  // caustics through the glass
  float ca=caustic(p*vec2(.9,1.3)+vec2(uT*.02,0.),uT*.35+3.);
  float ca2=caustic(p*vec2(1.7,2.2)+vec2(.3,-uT*.015),uT*.27+11.);
  float cmask=(.35+.65*back)*(1.-uDim*.8*S(.16,.0,abs(p0.y-.03)));
  glass+=hot*(ca*.85+ca2*.45)*cmask*.55;
  // sweeping highlight + fixed sheen
  float sw=exp(-pow((p0.x-uSweep)/.035,2.))*.55+exp(-pow((p0.x-uSweep)/.20,2.))*.18;
  float fix=exp(-pow((p.x+.62)/.05,2.))*.22;
  glass+=vec3(1.,.90,.75)*(sw*(1.-uDim*.55*S(.17,.0,abs(p0.y-.03)))+fix);
  vec3 col=glass;
  // lid (stone colour, ribbed), soft
  float aa=2.5/uRes.y;
  if(p.y>lidY-aa){
    float rib=.5+.5*sin(p.x*70.);
    vec3 lid=mix(vec3(.36,.31,.27),vec3(.60,.54,.47),.62+.38*rib*.35);
    lid*=.75+.35*S(lidY+.12,lidY,p.y);
    lid+=vec3(1.,.9,.75)*(sw*.5+fix*.6);
    lid=mix(lid,lid*.35,S(lidY+.02,lidY,p.y));
    col=mix(col,lid,S(lidY-aa,lidY+aa,p.y));
  }
  // label edge (cream paper), warm light from inside the glass
  if(p.y<labY+aa){
    vec3 pap=CREAM*(.62+.40*back)*vec3(1.,.93,.84);
    pap*=1.+(vnoise(p*vec2(300.,300.))-.5)*.03;
    pap+=hot*ca2*.20*back;
    pap+=vec3(1.,.93,.82)*sw*.25;
    // printed rule of the label (out of focus)
    pap=mix(pap,AMBER*.8,S(.012,.004,abs(p.y-labY+.075))*.55);
    float shade=S(labY-.03,labY,p.y);
    pap*=1.-.35*shade;
    col=mix(col,pap,S(labY+aa,labY-aa,p.y));
  }
  // golden dust in front (bokeh) + tiny sparkles
  float bk=bokeh(p0+vec2(uT*.012,uT*.018),.17,51.,.016,.040,.40,.55);
  float bk2=bokeh(p0+vec2(-uT*.008,uT*.024),.06,57.,.003,.007,.50,.45);
  col+=vec3(1.,.78,.45)*(bk*.14+bk2*.35)*(1.-uDim*.6*S(.16,.0,abs(p0.y-.045)));
  // darken behind the claim
  col*=1.-uDim*.55*S(.19,.0,abs(p0.y-.03))*S(1.1,.25,abs(p0.x));
  outColor=vec4(col,1.);
}`;

  // ------------------------------------------------------------------ S10 Signature : aplat ambre profond
  const S10 = `
void main(){
  vec2 p=P();
  vec3 c=AMBERD*(1.04-.16*length(p*vec2(.8,1.1)));
  c+=vec3(.12,.06,.02)*exp(-length((p-vec2(0.,.22))*vec2(.6,1.2))*3.);
  outColor=vec4(c,1.);
}`;

  // ------------------------------------------------------------------ POST
  const POST = `
uniform sampler2D uA,uB;
uniform float uMix,uFrame,uGrain,uVig,uBloom,uBar,uFlash,uLeakA,uLeakB,uLeakX;
vec3 bloomOf(sampler2D s,vec2 uv){
  return textureLod(s,uv,3.).rgb*.30+textureLod(s,uv,4.5).rgb*.40+textureLod(s,uv,6.).rgb*.30;
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec3 a=texture(uA,uv).rgb;
  vec3 col=a;vec3 bl=bloomOf(uA,uv);
  if(uMix>0.){vec3 b=texture(uB,uv).rgb;col=mix(a,b,uMix);bl=mix(bl,bloomOf(uB,uv),uMix);}
  col+=uBloom*max(bl-.50,0.)*vec3(1.05,.95,.85)*1.3;
  col+=vec3(1.,.86,.64)*uFlash*(.55+.45*bl);
  vec2 q=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float l1=exp(-length((q-vec2(-.98+.06*sin(uT*.31),.22+.05*sin(uT*.21)))*vec2(.85,.55))*2.4);
  float l2=exp(-length((q-vec2(.98+.05*sin(uT*.27+1.),-.20+.06*sin(uT*.19)))*vec2(.9,.6))*2.7);
  float l3=exp(-length((q-vec2(uLeakX,.30))*vec2(.6,.9))*3.2);
  vec3 leak=vec3(1.,.42,.12)*l1*uLeakA+vec3(1.,.66,.30)*l2*uLeakB+vec3(1.,.55,.22)*l3*uLeakB*.8;
  col=1.-(1.-col)*(1.-clamp(leak,0.,1.));
  float v=S(1.30,.30,length(q*vec2(.82,1.)));
  col*=mix(1.,v,uVig);
  // film grain (two scales, stronger in midtones)
  float g1=hash12(gl_FragCoord.xy+vec2(fract(uFrame*.618)*911.,fract(uFrame*.382)*577.));
  float g2=hash12(floor(gl_FragCoord.xy*.5)+vec2(uFrame*13.,uFrame*7.));
  float g=(g1*.6+g2*.4)-.5;
  float lum=dot(col,vec3(.299,.587,.114));
  col+=g*uGrain*(.55+1.6*lum*(1.-lum));
  float bar=step(gl_FragCoord.y,uBar)+step(uRes.y-uBar,gl_FragCoord.y);
  col=mix(col,vec3(0.),sat(bar));
  outColor=vec4(clamp(col,0.,1.),1.);
}`;

  const SRC = { s1: S1, s3: S3, s4: S4, s7: S7, s9: S9, s10: S10 };

  function Film(canvas) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl; this.W = canvas.width; this.H = canvas.height;
    const vs = '#version 300 es\nin vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}';
    const compile = (type, src, name) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        throw new Error('shader ' + name + ': ' + log);
      }
      return s;
    };
    const vsh = compile(gl.VERTEX_SHADER, vs, 'vs');
    this.progs = {};
    const all = Object.assign({}, SRC, { post: POST });
    for (const k of Object.keys(all)) {
      const pr = gl.createProgram();
      gl.attachShader(pr, vsh);
      gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, '#version 300 es\n' + COMMON + all[k], k));
      gl.bindAttribLocation(pr, 0, 'aPos');
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link ' + k + ': ' + gl.getProgramInfoLog(pr));
      this.progs[k] = { pr, loc: {} };
    }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.targets = [this.makeTarget(), this.makeTarget()];
    this.texs = {};
  }
  Film.prototype.makeTarget = function () {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 8, gl.RGBA8, this.W, this.H);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb };
  };
  /** texture from an image or canvas (premultiplied, flipped to GL orientation, mipmapped) */
  Film.prototype.texture = function (name, source) {
    const gl = this.gl;
    let tex = this.texs[name];
    if (!tex) {
      tex = this.texs[name] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  };
  Film.prototype.use = function (name) {
    const p = this.progs[name]; this.gl.useProgram(p.pr); this.cur = p; return p;
  };
  Film.prototype.u = function (name, ...v) {
    const gl = this.gl, p = this.cur;
    let l = p.loc[name];
    if (l === undefined) l = p.loc[name] = gl.getUniformLocation(p.pr, name);
    if (l === null) return;
    if (v.length === 1) gl.uniform1f(l, v[0]);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
  };
  Film.prototype.sampler = function (name, unit, tex) {
    const gl = this.gl, p = this.cur;
    let l = p.loc[name];
    if (l === undefined) l = p.loc[name] = gl.getUniformLocation(p.pr, name);
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
    if (l !== null) gl.uniform1i(l, unit);
  };
  /** render shot `name` into target slot k; setUniforms(film) sets the shot uniforms */
  Film.prototype.shot = function (k, name, t, setUniforms) {
    const gl = this.gl, tg = this.targets[k];
    gl.bindFramebuffer(gl.FRAMEBUFFER, tg.fb);
    gl.viewport(0, 0, this.W, this.H);
    this.use(name);
    this.u('uRes', this.W, this.H); this.u('uT', t);
    if (setUniforms) setUniforms(this);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, tg.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  Film.prototype.post = function (t, o) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    this.use('post');
    this.u('uRes', this.W, this.H); this.u('uT', t);
    this.sampler('uA', 0, this.targets[0].tex);
    this.sampler('uB', 1, this.targets[1].tex);
    this.u('uMix', o.mix || 0); this.u('uFrame', o.frame || 0);
    this.u('uGrain', o.grain); this.u('uVig', o.vig); this.u('uBloom', o.bloom);
    this.u('uBar', o.bar); this.u('uFlash', o.flash || 0);
    this.u('uLeakA', o.leakA || 0); this.u('uLeakB', o.leakB || 0); this.u('uLeakX', o.leakX || 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  };

  window.FILM = { Film };
})();
