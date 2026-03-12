import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { isConfigured } from "./supabase.js";
import * as DB from "./db.js";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Cell,
  PieChart, Pie, AreaChart, Area, CartesianGrid, FunnelChart, Funnel, LabelList
} from "recharts";

/* ═══════════════════════════════════════════════════
   ORBIT v5 — Complete Upgrades
   ✦ Landing: news bar removed
   ✦ Admin Overview: pipeline funnel, dept health, alerts, activity
   ✦ Placement Filter: company presets, shortlist, tier stats, export
   ✦ Section Incharge: direct messaging to students
   ✦ Community: DM system (student ↔ student, incharge → student)
   ✦ All 4 dashboards upgraded
═══════════════════════════════════════════════════ */

const D = {
  bg0:"#07070A", bg1:"#0F0F14", bg2:"#161620", bg3:"#1E1E2A", bg4:"#252534",
  orange:"#FF6B2B", orangeD:"#CC4A0E", violet:"#7C3FFF", violetL:"#A070FF",
  green:"#00E87A", amber:"#FFB547", red:"#FF3D5A", blue:"#3D8EFF", cyan:"#00D4FF",
  t1:"#F2F2F8", t2:"#BCBCCC", t3:"#9898A8", t4:"#4A4A5A",
  b1:"rgba(255,255,255,0.06)", b2:"rgba(255,255,255,0.10)",
  bO:"rgba(255,107,43,0.25)", bV:"rgba(124,63,255,0.25)",
  gO:"rgba(255,107,43,0.4)", gV:"rgba(124,63,255,0.4)", gG:"rgba(0,232,122,0.4)",
};

const TIER = {
  Elite:        { color:"#FF6B2B", glow:"rgba(255,107,43,0.45)",  icon:"◆", bg:"rgba(255,107,43,0.10)" },
  Advanced:     { color:"#7C3FFF", glow:"rgba(124,63,255,0.40)",  icon:"▲", bg:"rgba(124,63,255,0.10)" },
  Intermediate: { color:"#00E87A", glow:"rgba(0,232,122,0.38)",   icon:"●", bg:"rgba(0,232,122,0.08)"  },
  Beginner:     { color:"#7878A8", glow:"rgba(120,120,168,0.3)",  icon:"○", bg:"rgba(120,120,168,0.06)"},
};

const BADGES = [
  { id:"streak7",  icon:"🔥", label:"Week Warrior",  desc:"7-day streak",        color:D.orange, req:s=>s.streak>=7   },
  { id:"streak30", icon:"⚡", label:"Month Master",  desc:"30-day streak",       color:D.amber,  req:s=>s.streak>=30  },
  { id:"streak90", icon:"💎", label:"Legend Streak", desc:"90-day streak",       color:D.violet, req:s=>s.streak>=90  },
  { id:"lc100",    icon:"🎯", label:"Century",       desc:"100+ LC solved",      color:D.orange, req:s=>(s.easy+s.medium+s.hard)>=100 },
  { id:"lc300",    icon:"🏹", label:"Sharpshooter",  desc:"300+ LC solved",      color:D.red,    req:s=>(s.easy+s.medium+s.hard)>=300 },
  { id:"hard50",   icon:"🦅", label:"Hard Crusher",  desc:"50+ hard solved",     color:D.red,    req:s=>s.hard>=50    },
  { id:"cf1400",   icon:"⚔️", label:"Specialist",   desc:"CF rating 1400+",     color:D.blue,   req:s=>s.cfRating>=1400 },
  { id:"cf2000",   icon:"👑", label:"Master",        desc:"CF rating 2000+",     color:D.amber,  req:s=>s.cfRating>=2000 },
  { id:"gh100",    icon:"🐙", label:"Commit King",   desc:"100+ GH commits",     color:D.violet, req:s=>s.ghCommits>=100 },
  { id:"elite",    icon:"◆",  label:"Elite Orbit",   desc:"Elite tier",          color:D.orange, req:s=>s.tier==="Elite" },
  { id:"ready",    icon:"🚀", label:"Launch Ready",  desc:"Placement ready",     color:D.green,  req:s=>s.placementReady },
  { id:"verified", icon:"✅", label:"Verified",      desc:"All handles verified", color:D.cyan,  req:s=>s.lcVerified&&s.ghVerified },
];
function getEarnedBadges(s) { return BADGES.filter(b=>b.req(s)); }

function getRanks(student,allStudents) {
  const active=allStudents.filter(s=>s.status==="ACTIVE");
  const sorted=[...active].sort((a,b)=>b.score-a.score);
  const clgRank=sorted.findIndex(s=>s.id===student.id)+1;
  const deptStudents=active.filter(s=>s.dept===student.dept);
  const deptSorted=[...deptStudents].sort((a,b)=>b.score-a.score);
  const deptRank=deptSorted.findIndex(s=>s.id===student.id)+1;
  const secStudents=active.filter(s=>s.section===student.section&&s.dept===student.dept);
  const secSorted=[...secStudents].sort((a,b)=>b.score-a.score);
  const secRank=secSorted.findIndex(s=>s.id===student.id)+1;
  return {
    college:{rank:clgRank,total:active.length},
    dept:{rank:deptRank,total:deptStudents.length},
    section:{rank:secRank,total:secStudents.length},
  };
}

function computeScore(s) {
  const lc_score=((s.easy*1+s.medium*2+s.hard*4)*0.3)||0;
  const cf_score=(s.cfRating*0.02)||0;
  const cc_score=(s.ccStars*5)||0;
  const gh_score=((s.ghCommits||0)*0.05+(s.ghPRs||0)*2)||0;
  const cw_score=((s.cwProblems||0)*0.5+(s.streak||0)*10)||0;
  const total=Math.round(lc_score+cf_score+cc_score+gh_score+cw_score);
  const tier=total>=400?"Elite":total>=250?"Advanced":total>=120?"Intermediate":"Beginner";
  const ready=s.cfRating>1400&&(s.easy+s.medium+s.hard)>100;
  return {total,tier,ready,lc_score:Math.round(lc_score),cf_score:Math.round(cf_score),cc_score:Math.round(cc_score),gh_score:Math.round(gh_score),cw_score:Math.round(cw_score)};
}

const NAMES=["Arjun Sharma","Priya Nair","Ravi Kiran","Sneha Reddy","Mohit Jain","Divya Krishnan","Karthik Iyer","Ananya Reddy","Vikram Singh","Deepa Nair","Rohan Gupta","Meera Subramaniam","Aditya Rao","Lakshmi Venkat","Nikhil Bose","Pooja Agarwal","Harish Tiwari","Riya Desai","Zara Ahmed","Tanvi Joshi"];
const DEPTS=["CSE","ECE","MECH","IT","AIDS"];
const LANGS=["Python","Java","C++","JavaScript","Go","Rust"];
const COS=["Google","Microsoft","Amazon","Flipkart","Adobe","Infosys","TCS","Zoho","Freshworks"];
const MOODS=["😊","🚀","😐","🤯","😔","😴"];
const NEWS=[
  {text:"Infosys opens 12,000 fresher positions for 2025 batch",time:"2h ago"},
  {text:"TCS NQT registration closes June 30 — apply now",time:"5h ago"},
  {text:"Amazon India campus drive dates announced for 2026 batch",time:"8h ago"},
  {text:"FAANG interview prep bootcamp — register by June 20",time:"1d ago"},
];
const DRIVES=[
  {company:"Google",role:"SWE Intern",pkg:"₹2L/mo",deadline:"15 Jun",logo:"G",status:"open"},
  {company:"Microsoft",role:"FTE SDE",pkg:"₹45 LPA",deadline:"22 Jun",logo:"M",status:"open"},
  {company:"Flipkart",role:"SDE-1",pkg:"₹32 LPA",deadline:"10 Jun",logo:"F",status:"closing"},
];
const ACHIEVEMENTS_MOCK=[
  {title:"Google DSC Lead",status:"verified",category:"leadership",date:"Jan 2025"},
  {title:"HackIndia Finalist",status:"verified",category:"hackathon",date:"Mar 2025"},
  {title:"AWS Cloud Practitioner",status:"pending",category:"certification",date:"May 2025"},
];

/* Company eligibility presets */
const COMPANY_PRESETS={
  "Any":        {minLC:0,   minCF:0,    minGPA:0,   minCGPA:0  },
  "Google":     {minLC:200, minCF:1800, minGPA:9.0, minCGPA:8.5},
  "Microsoft":  {minLC:150, minCF:1600, minGPA:8.5, minCGPA:8.0},
  "Amazon":     {minLC:100, minCF:1400, minGPA:8.0, minCGPA:7.5},
  "Infosys":    {minLC:30,  minCF:0,    minGPA:6.5, minCGPA:6.0},
  "TCS":        {minLC:20,  minCF:0,    minGPA:6.0, minCGPA:6.0},
  "Zoho":       {minLC:50,  minCF:1000, minGPA:7.0, minCGPA:7.0},
  "Adobe":      {minLC:120, minCF:1500, minGPA:8.0, minCGPA:7.5},
};

function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}

function genMonthlyLogs(){
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const daysInMonth=[31,28,31,30,31,30,31,31,30,31,30,31];
  return months.map((month,mi)=>{
    const days=Array.from({length:daysInMonth[mi]},(_,d)=>{
      const lc=Math.random()>0.58?rnd(1,4):0;
      const cf=Math.random()>0.80?rnd(1,2):0;
      const gh=Math.random()>0.50?rnd(1,6):0;
      const cw=Math.random()>0.68?rnd(1,3):0;
      return{day:d+1,lc,cf,gh,cw};
    });
    return{month,mi,lc:days.reduce((a,d)=>a+d.lc,0),cf:days.reduce((a,d)=>a+d.cf,0),gh:days.reduce((a,d)=>a+d.gh,0),cw:days.reduce((a,d)=>a+d.cw,0),days};
  });
}

function genStudent(i){
  const dept=pick(DEPTS);
  const easy=rnd(20,200),medium=rnd(10,130),hard=rnd(0,65);
  const cfRating=rnd(800,2400),ccRating=rnd(1400,2600);
  const ghCommits=rnd(0,800),ghPRs=rnd(0,80);
  const cwProblems=rnd(20,300),streak=rnd(0,120);
  const base={
    id:i+1,name:NAMES[i%NAMES.length],
    roll:`21${dept}${String(i+1).padStart(3,"0")}`,
    dept,section:pick(["A","B","C"]),
    cgpa:(rnd(65,98)/10).toFixed(1),
    language:pick(LANGS),email:`${NAMES[i%NAMES.length].split(" ")[0].toLowerCase()}@vit.ac.in`,
    batch:"2021-25",
    avatar:NAMES[i%NAMES.length].split(" ").map(w=>w[0]).join("").substring(0,2),
    status:Math.random()>0.15?"ACTIVE":"PENDING",
    easy,medium,hard,cfRating,ccStars:Math.min(7,Math.floor(ccRating/400)),
    ghCommits,ghPRs,ghActive:rnd(0,96)<=48,cwProblems,streak,
    lcVerified:Math.random()>0.3,ghVerified:Math.random()>0.4,
    leetcode:NAMES[i%NAMES.length].split(" ")[0].toLowerCase()+"_lc",
    github:NAMES[i%NAMES.length].split(" ")[0].toLowerCase()+"-dev",
    codeforces:NAMES[i%NAMES.length].split(" ")[0].toLowerCase()+"_cf",
    codechef:NAMES[i%NAMES.length].split(" ")[0].toLowerCase()+"_cc",
    password:"Pass@123",
    targetCos:Array.from({length:rnd(1,3)},()=>pick(COS)),
    monthlyLogs:genMonthlyLogs(),
    sgpaData:[
      {sem:"S1",sgpa:(rnd(72,85)/10)},{sem:"S2",sgpa:(rnd(75,88)/10)},
      {sem:"S3",sgpa:(rnd(78,92)/10)},{sem:"S4",sgpa:(rnd(74,90)/10)},
      {sem:"S5",sgpa:(rnd(80,95)/10)},{sem:"S6",sgpa:(rnd(78,92)/10)},
    ],
    codingRadar:[
      {subject:"LeetCode",A:rnd(40,95)},{subject:"GitHub",A:rnd(35,90)},
      {subject:"CF Rating",A:rnd(30,85)},{subject:"Contests",A:rnd(40,80)},
      {subject:"Streaks",A:rnd(50,95)},{subject:"Projects",A:rnd(45,85)},
    ],
    achievements:ACHIEVEMENTS_MOCK,
    moodLog:null,
    weeklyActivity:[
      {day:"Mon",hours:rnd(10,55)/10},{day:"Tue",hours:rnd(20,72)/10},
      {day:"Wed",hours:rnd(8,50)/10},{day:"Thu",hours:rnd(30,75)/10},
      {day:"Fri",hours:rnd(20,65)/10},{day:"Sat",hours:rnd(40,80)/10},
      {day:"Sun",hours:rnd(5,40)/10},
    ],
    arenaStats:{wins:rnd(10,40),losses:rnd(3,20),elo:rnd(900,1800)},
    offersCount:0,
  };
  const score=computeScore(base);
  return{...base,score:score.total,tier:score.tier,placementReady:score.ready,composite:score};
}

let STUDENTS=Array.from({length:20},(_,i)=>genStudent(i));

const MOCK_AUDIT=[
  {id:1,action:"ACTIVATED",target:"Arjun Sharma",by:"Admin",ts:"2025-06-10 09:14"},
  {id:2,action:"REJECTED",target:"Temp User",by:"Admin",ts:"2025-06-10 09:20"},
  {id:3,action:"HANDLE_VERIFIED",target:"Sneha Reddy → LeetCode",by:"System",ts:"2025-06-10 10:05"},
  {id:4,action:"SCORE_RECOMPUTED",target:"Batch 2021-25",by:"Cron Job",ts:"2025-06-11 00:00"},
  {id:5,action:"MSG_SENT",target:"Prof. Arun S → Arjun Sharma",by:"Section Incharge",ts:"2025-06-11 10:30"},
];
let MOCK_OFFERS=[
  {id:1,company:"Google",package:"45 LPA",student:NAMES[3],status:"ACCEPTED",date:"2025-06-08"},
  {id:2,company:"Microsoft",package:"38 LPA",student:NAMES[0],status:"ACCEPTED",date:"2025-06-09"},
  {id:3,company:"Amazon",package:"32 LPA",student:NAMES[1],status:"PENDING",date:"2025-06-11"},
  {id:4,company:"Zoho",package:"12 LPA",student:NAMES[2],status:"ACCEPTED",date:"2025-06-10"},
];
const MOCK_COMMUNITY=[
  {id:1,user:NAMES[3],msg:"Anyone solved LC 2127? The DP transition is tricky.",ts:"2h ago",avatar:"SR"},
  {id:2,user:NAMES[0],msg:"Yes! Think of it as bipartite matching. DM me.",ts:"1h 45m ago",avatar:"AS"},
  {id:3,user:NAMES[1],msg:"Infosys drive tomorrow 10 AM · Hall 3.",ts:"1h ago",avatar:"PN"},
  {id:4,user:NAMES[2],msg:"Thanks for the heads up Priya!",ts:"55m ago",avatar:"RK"},
  {id:5,user:NAMES[4],msg:"Anyone using NeetCode for system design prep?",ts:"30m ago",avatar:"MJ"},
];
/* Initial DMs: some from incharge to students */
const INIT_DMS=[
  {id:1,fromId:"si.cse.a",fromName:"Prof. Arun S",fromAvatar:"AS",toId:1,toName:NAMES[0],msg:"Hi Arjun! Great work on your Codeforces rating this month. Keep it up! Please check your LeetCode verification code.",ts:"10:30 AM",read:false},
  {id:2,fromId:"si.cse.a",fromName:"Prof. Arun S",fromAvatar:"AS",toId:4,toName:NAMES[3],msg:"Sneha, your placement readiness score is outstanding. Please register for the Google drive by June 15.",ts:"10:32 AM",read:true},
  {id:3,fromId:2,fromName:NAMES[1],fromAvatar:"PN",toId:1,toName:NAMES[0],msg:"Arjun, can you share your CF template for segment trees?",ts:"11:00 AM",read:false},
];
const DEPT_DATA=DEPTS.map(d=>({
  dept:d,
  elite:STUDENTS.filter(s=>s.dept===d&&s.tier==="Elite").length,
  advanced:STUDENTS.filter(s=>s.dept===d&&s.tier==="Advanced").length,
  intermediate:STUDENTS.filter(s=>s.dept===d&&s.tier==="Intermediate").length,
  beginner:STUDENTS.filter(s=>s.dept===d&&s.tier==="Beginner").length,
}));

/* ─── AUTH ─── */
const ADMIN_ACCOUNT={email:"admin@orbit.edu",password:"Admin@123"};
const HOD_ACCOUNTS=[
  {email:"hod.cse@orbit.edu",password:"Hod@CSE1",dept:"CSE",name:"Dr. Ramesh Kumar",avatar:"RK"},
  {email:"hod.ece@orbit.edu",password:"Hod@ECE1",dept:"ECE",name:"Dr. Priya Menon",avatar:"PM"},
  {email:"hod.mech@orbit.edu",password:"Hod@MECH1",dept:"MECH",name:"Dr. Suresh Babu",avatar:"SB"},
  {email:"hod.it@orbit.edu",password:"Hod@IT1",dept:"IT",name:"Dr. Anjali Nair",avatar:"AN"},
  {email:"hod.aids@orbit.edu",password:"Hod@AIDS1",dept:"AIDS",name:"Dr. Vikram Pillai",avatar:"VP"},
];
const INCHARGE_ACCOUNTS=[
  {email:"si.cse.a@orbit.edu",password:"SI@CSEa1",dept:"CSE",section:"A",name:"Prof. Arun S",avatar:"AU",id:"si.cse.a"},
  {email:"si.cse.b@orbit.edu",password:"SI@CSEb1",dept:"CSE",section:"B",name:"Prof. Meera R",avatar:"MR",id:"si.cse.b"},
  {email:"si.ece.a@orbit.edu",password:"SI@ECEa1",dept:"ECE",section:"A",name:"Prof. Divya K",avatar:"DK",id:"si.ece.a"},
  {email:"si.it.a@orbit.edu",password:"SI@ITa1",dept:"IT",section:"A",name:"Prof. Sneha P",avatar:"SP",id:"si.it.a"},
];
function authenticate(loginType,identifier,password,students){
  if(loginType==="admin"){
    if(identifier===ADMIN_ACCOUNT.email&&password===ADMIN_ACCOUNT.password)
      return{role:"admin",user:{name:"System Admin",avatar:"AD",email:identifier}};
    return null;
  }
  if(loginType==="hod"){const acc=HOD_ACCOUNTS.find(h=>h.email===identifier&&h.password===password);return acc?{role:"hod",user:acc}:null;}
  if(loginType==="incharge"){const acc=INCHARGE_ACCOUNTS.find(h=>h.email===identifier&&h.password===password);return acc?{role:"incharge",user:acc}:null;}
  if(loginType==="student"){const stu=students.find(s=>s.roll.toLowerCase()===identifier.toLowerCase()&&s.password===password);return stu?{role:"student",user:stu}:null;}
  return null;
}

/* ══════════════════════════════════════════
   GLOBAL CSS
══════════════════════════════════════════ */
const GLOBAL_CSS=`
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#07070A;font-family:'Space Grotesk',sans-serif;}
::selection{background:rgba(255,107,43,0.35);color:#F2F2F8;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:#0F0F14;}
::-webkit-scrollbar-thumb{background:#2A2A3A;border-radius:4px;}
input,select,textarea{font-family:'Space Grotesk',sans-serif;}
@keyframes orbitSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulsate{0%,100%{opacity:1}50%{opacity:0.4}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 12px rgba(255,107,43,0.3)}50%{box-shadow:0 0 28px rgba(255,107,43,0.7)}}
.fade-up{animation:fadeUp 0.35s ease-out both;}
.fade-up-1{animation:fadeUp 0.35s 0.07s ease-out both;}
.fade-up-2{animation:fadeUp 0.35s 0.14s ease-out both;}
.fade-up-3{animation:fadeUp 0.35s 0.21s ease-out both;}
.fade-up-4{animation:fadeUp 0.35s 0.28s ease-out both;}
.slide-in{animation:slideIn 0.28s ease-out both;}
.orbit-spin{animation:orbitSpin 8s linear infinite;}
`;

/* ─── SHARED COMPONENTS ─── */
function Card({children,style,accent,glow,className,onClick}){
  return(
    <div className={className} onClick={onClick} style={{
      background:D.bg2,borderRadius:16,
      border:`1px solid ${accent?`${accent}22`:D.b1}`,
      ...(glow&&accent?{boxShadow:`0 0 0 1px ${accent}15, 0 0 32px ${accent}14`}:{}),
      ...style
    }}>{children}</div>
  );
}
function Chip({children,color,style}){
  return(
    <span style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,background:`${color}14`,color,border:`1px solid ${color}30`,...style}}>
      {children}
    </span>
  );
}
function SectionLabel({children,accent=D.orange}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
      <div style={{width:3,height:14,borderRadius:2,background:accent,flexShrink:0}}/>
      <span style={{fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:700,letterSpacing:0.5,color:D.t2,textTransform:"uppercase"}}>{children}</span>
    </div>
  );
}
function LiveClock(){
  const[t,setT]=useState(new Date());
  useEffect(()=>{const i=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(i);},[]);
  return(
    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t3}}>
      {t.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
    </span>
  );
}
function CustomTooltip({active,payload,label}){
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:D.bg4,border:`1px solid ${D.b2}`,borderRadius:10,padding:"10px 14px"}}>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginBottom:6}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:p.color||D.t1}}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

/* ─── BEACON AI ─── */
function BeaconAI({student,role,currentUser}){
  const[open,setOpen]=useState(false);
  const[messages,setMessages]=useState([{role:"assistant",text:"👋 I'm Beacon. Ask me about gap analysis, platform strategy, or placement prep."}]);
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const endRef=useRef(null);
  const context=role==="admin"?"System Admin managing all departments":role==="hod"?`HOD of ${currentUser?.dept} department`:role==="incharge"?`Section Incharge of ${currentUser?.dept}-${currentUser?.section}`:`Student: ${JSON.stringify(student)}`;
  const quickPrompts=role==="student"?["Analyze my gaps","Best next steps","Contest strategy","Mock interview prep"]:["Dept performance","Low performers alert","Placement readiness","Top students analysis"];
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const send=async()=>{
    if(!input.trim()||loading)return;
    const q=input;setInput("");
    setMessages(p=>[...p,{role:"user",text:q}]);
    setLoading(true);
    try{
      const gemKey=window.__GEMINI_KEY||"";
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system_instruction:{parts:[{text:`You are Beacon, an AI embedded in ORBIT — a college placement & competitive programming dashboard. Context: ${context}. Be concise, insightful, and data-aware. No markdown.`}]},
          contents:[...messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.text}]})),{role:"user",parts:[{text:q}]}],
          generationConfig:{maxOutputTokens:1000}
        })
      });
      const data=await res.json();
      setMessages(p=>[...p,{role:"assistant",text:data.candidates?.[0]?.content?.parts?.[0]?.text||"Something went wrong."}]);
    }catch{setMessages(p=>[...p,{role:"assistant",text:"Connection issue. Please try again."}]);}
    setLoading(false);
  };
  return(
    <>
      <button onClick={()=>setOpen(!open)} style={{
        position:"fixed",bottom:28,right:28,width:56,height:56,borderRadius:"50%",zIndex:9000,
        background:`linear-gradient(135deg,${D.orange},#FF3D00)`,border:"none",cursor:"pointer",
        fontSize:22,color:"#fff",boxShadow:`0 0 28px rgba(255,107,43,0.5),0 8px 24px rgba(0,0,0,0.4)`,
        animation:"glowPulse 3s infinite",transition:"all 0.2s",
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>{open?"✕":"✦"}</button>
      {open&&(
        <div className="slide-in" style={{
          position:"fixed",bottom:96,right:24,width:360,height:500,zIndex:9000,
          borderRadius:20,overflow:"hidden",display:"flex",flexDirection:"column",
          background:"rgba(10,10,14,0.96)",backdropFilter:"blur(24px)",
          border:`1px solid ${D.bO}`,boxShadow:`0 0 60px rgba(255,107,43,0.15),0 24px 80px rgba(0,0,0,0.7)`,
        }}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${D.b1}`,display:"flex",alignItems:"center",gap:10,background:`linear-gradient(135deg,rgba(255,107,43,0.08),transparent)`}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${D.orange},#FF3D00)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:D.t1}}>Beacon AI</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.orange,letterSpacing:1}}>CONTEXTUAL CAREER GUIDE</div>
            </div>
            <button onClick={()=>setOpen(false)} style={{marginLeft:"auto",background:"none",border:"none",color:D.t4,cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((m,i)=>(
              <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"88%"}}>
                <div style={{
                  padding:"11px 15px",
                  borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                  background:m.role==="user"?`linear-gradient(135deg,${D.orangeD},#CC2800)`:`rgba(26,26,34,0.98)`,
                  border:m.role==="assistant"?`1px solid ${D.b1}`:"none",
                  color:D.t1,fontSize:13,lineHeight:1.65,
                }}>{m.text}</div>
              </div>
            ))}
            {loading&&<div style={{alignSelf:"flex-start"}}><div style={{padding:"12px 16px",borderRadius:"18px 18px 18px 4px",background:`rgba(26,26,34,0.98)`,border:`1px solid ${D.b1}`,display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:D.orange,animation:`bounce 1s ${i*0.2}s infinite`}}/>)}</div></div>}
            <div ref={endRef}/>
          </div>
          {messages.length<3&&<div style={{padding:"0 14px 8px",display:"flex",flexWrap:"wrap",gap:6}}>{quickPrompts.map((q,i)=><button key={i} onClick={()=>setInput(q)} style={{padding:"5px 11px",borderRadius:20,fontSize:10,background:`rgba(255,107,43,0.08)`,border:`1px solid rgba(255,107,43,0.25)`,color:"#FF9966",cursor:"pointer"}}>{q}</button>)}</div>}
          <div style={{padding:"12px 14px",borderTop:`1px solid ${D.b1}`,display:"flex",gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask Beacon anything…"
              style={{flex:1,background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b2}`,borderRadius:11,color:D.t1,padding:"10px 13px",fontSize:13,outline:"none"}}/>
            <button onClick={send} disabled={loading} style={{width:42,height:42,borderRadius:11,background:loading?`rgba(255,107,43,0.2)`:`linear-gradient(135deg,${D.orange},#FF3D00)`,border:"none",color:"#fff",cursor:loading?"not-allowed":"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:loading?"none":`0 4px 16px rgba(255,107,43,0.4)`}}>↑</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── MONTHLY HEATMAP ─── */
function MonthlyHeatmap({monthlyLogs,compact=false}){
  const[hovered,setHovered]=useState(null);
  const[tooltip,setTooltip]=useState({x:0,y:0});
  const PLAT={lc:{color:D.orange,label:"LeetCode"},cf:{color:D.blue,label:"Codeforces"},gh:{color:D.violet,label:"GitHub"},cw:{color:D.cyan,label:"CodeWaves"}};
  function getDayColor(day){
    const total=day.lc+day.cf+day.gh+day.cw;
    if(total===0)return"rgba(255,255,255,0.04)";
    const max=Math.max(day.lc,day.cf,day.gh,day.cw);
    const dominant=day.lc===max?"lc":day.cf===max?"cf":day.cw===max?"cw":"gh";
    const intensity=Math.min(1,total/10);
    const hex=PLAT[dominant].color;
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return`rgba(${r},${g},${b},${0.15+intensity*0.75})`;
  }
  return(
    <Card style={{padding:compact?16:20}} accent={D.orange}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:compact?10:14}}>
        <span style={{fontFamily:"'Syne',sans-serif",fontSize:compact?12:14,fontWeight:700,color:D.t1}}>Activity Heatmap</span>
        {!compact&&<div style={{display:"flex",gap:12}}>{Object.entries(PLAT).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:5,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}><div style={{width:8,height:8,borderRadius:2,background:v.color}}/>{v.label}</div>)}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:compact?"repeat(6,1fr)":"repeat(4,1fr)",gap:compact?6:12}}>
        {monthlyLogs.map(m=>(
          <div key={m.month}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:compact?8:9,color:D.t4,marginBottom:4}}>{m.month}</div>
            <div style={{display:"grid",gridTemplateColumns:compact?"repeat(5,1fr)":"repeat(7,1fr)",gap:compact?1.5:2}}>
              {m.days.map((day,di)=>(
                <div key={di}
                  onMouseEnter={e=>{setHovered({day,month:m.month});setTooltip({x:e.clientX,y:e.clientY});}}
                  onMouseLeave={()=>setHovered(null)}
                  style={{paddingBottom:compact?"85%":"100%",borderRadius:2,background:getDayColor(day),cursor:"default"}}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {hovered&&(
        <div style={{position:"fixed",left:tooltip.x+12,top:tooltip.y-40,zIndex:9999,padding:"8px 12px",borderRadius:10,background:D.bg4,border:`1px solid ${D.b2}`,pointerEvents:"none",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginBottom:4}}>{hovered.month} · Day {hovered.day.day}</div>
          {Object.entries(PLAT).map(([k,v])=>hovered.day[k]>0&&<div key={k} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:v.color}}>{v.label}: {hovered.day[k]}</div>)}
          {(hovered.day.lc+hovered.day.cf+hovered.day.gh+hovered.day.cw)===0&&<div style={{color:D.t4,fontSize:10}}>No activity</div>}
        </div>
      )}
    </Card>
  );
}

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function OrbitApp(){
  const[role,setRole]=useState(null);
  const[currentUser,setCurrentUser]=useState(null);
  const[activeStudent,setActiveStudent]=useState(null);
  const[view,setView]=useState("dashboard");
  const[students,setStudents]=useState(STUDENTS);
  const[communityMsgs,setCommunityMsgs]=useState(MOCK_COMMUNITY);
  const[dms,setDms]=useState(INIT_DMS);
  const[chatInput,setChatInput]=useState("");
  const[notif,setNotif]=useState(null);
  const[regForm,setRegForm]=useState({name:"",roll:"",dept:"CSE",section:"A",cgpa:"",leetcode:"",github:"",codeforces:"",codechef:""});
  const[showReg,setShowReg]=useState(false);
  const[verifyCode]=useState("ORBIT-"+Math.random().toString(36).substring(2,8).toUpperCase());
  const[dmModal,setDmModal]=useState({open:false,student:null,msg:""});
  const[interviewRequests,setInterviewRequests]=useState([]);
  const[geminiKey,setGeminiKey]=useState(()=>localStorage.getItem("orbit_gemini_key")||"");
  const[showKeyModal,setShowKeyModal]=useState(()=>!localStorage.getItem("orbit_gemini_key"));
  const[dbLoading,setDbLoading]=useState(isConfigured);
  const realtimeRefs=useRef([]);

  /* ── Gemini key sync ── */
  useEffect(()=>{
    window.__GEMINI_KEY=geminiKey;
    if(geminiKey)localStorage.setItem("orbit_gemini_key",geminiKey);
  },[geminiKey]);

  /* ── Supabase: bootstrap data on mount (when configured) ── */
  useEffect(()=>{
    if(!isConfigured){setDbLoading(false);return;}
    (async()=>{
      try{
        const studs=await DB.fetchAllStudents();
        if(studs)setStudents(studs);
        const msgs=await DB.fetchCommunityMessages();
        if(msgs&&msgs.length)setCommunityMsgs(msgs);
      }catch(e){console.warn("[ORBIT] bootstrap error:",e.message);}
      finally{setDbLoading(false);}
    })();
  },[]);

  /* ── Supabase: realtime community messages ── */
  useEffect(()=>{
    if(!isConfigured)return;
    const ch=DB.subscribeToCommunity(msg=>setCommunityMsgs(p=>[...p,msg]));
    realtimeRefs.current.push(ch);
    return()=>realtimeRefs.current.forEach(DB.unsubscribe);
  },[]);

  /* ── Supabase: realtime DMs when logged in as student ── */
  useEffect(()=>{
    if(!isConfigured||!activeStudent)return;
    const ch=DB.subscribeToDms(activeStudent.id,dm=>setDms(p=>[...p,dm]));
    realtimeRefs.current.push(ch);
    return()=>DB.unsubscribe(ch);
  },[activeStudent]);

  /* ── Supabase: load DMs + interview requests after student login ── */
  useEffect(()=>{
    if(!isConfigured||!role)return;
    (async()=>{
      if(role==="student"&&activeStudent){
        try{const d=await DB.fetchStudentDms(activeStudent.id);setDms(d);}catch(e){}
        try{const r=await DB.fetchInterviewRequests();setInterviewRequests(r.filter(x=>x.studentId===activeStudent.id));}catch(e){}
      }
      if(role==="incharge"&&currentUser){
        try{const r=await DB.fetchInterviewRequests(currentUser.dept,currentUser.section);setInterviewRequests(r);}catch(e){}
      }
    })();
  },[role,activeStudent,currentUser]);

  useEffect(()=>{
    const style=document.createElement("style");
    style.textContent=GLOBAL_CSS;
    document.head.appendChild(style);
    return()=>document.head.removeChild(style);
  },[]);

  const showNotif=(msg,type="info")=>{setNotif({msg,type});setTimeout(()=>setNotif(null),3200);};

  const handleApprove=async(id)=>{
    setStudents(p=>p.map(s=>s.id===id?{...s,status:"ACTIVE"}:s));
    showNotif("✅ Student activated","success");
    if(isConfigured){try{await DB.approveStudent(id);}catch(e){showNotif("DB error: "+e.message,"error");}}
  };
  const handleReject=async(id)=>{
    setStudents(p=>p.filter(s=>s.id!==id));
    showNotif("❌ Registration rejected","error");
    if(isConfigured){try{await DB.rejectStudent(id);}catch(e){}}
  };
  const handleRegSubmit=async()=>{
    if(!regForm.name||!regForm.roll)return showNotif("Fill required fields","error");
    const newS={...genStudent(students.length),name:regForm.name,roll:regForm.roll,dept:regForm.dept,section:regForm.section,cgpa:parseFloat(regForm.cgpa)||7.0,status:"PENDING"};
    setStudents(p=>[...p,newS]);setShowReg(false);
    showNotif("✅ Registration submitted — pending approval","success");
    if(isConfigured){
      try{await DB.registerStudent(regForm);}
      catch(e){showNotif("Registration error: "+e.message,"error");}
    }
  };
  const handleLogin=async(loginType,identifier,password)=>{
    /* Always try local mock auth first (works in demo mode) */
    const localResult=authenticate(loginType,identifier,password,students);
    if(localResult){
      setRole(localResult.role);setCurrentUser(localResult.user);
      if(localResult.role==="student")setActiveStudent(localResult.user);
      setView("dashboard");return;
    }
    /* If Supabase configured, try real auth */
    if(isConfigured){
      try{
        let result;
        if(loginType==="student") result=await DB.loginStudent(identifier,password);
        else result=await DB.loginStaff(identifier,password);
        setRole(result.role);setCurrentUser(result.user);
        if(result.role==="student")setActiveStudent(result.user);
        setView("dashboard");
      }catch(e){showNotif("❌ "+e.message,"error");}
    }else{
      showNotif("❌ Invalid credentials","error");
    }
  };

  /* Send DM from incharge to student */
  const sendDMFromIncharge=async(student,msg)=>{
    if(!msg.trim())return;
    const cu=currentUser;
    const dmObj={fromId:cu.id||cu.email,fromName:cu.name,fromAvatar:cu.avatar,toId:student.id,toName:student.name,msg};
    const newDm={id:Date.now(),...dmObj,ts:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),read:false};
    setDms(p=>[...p,newDm]);
    showNotif(`✉ Message sent to ${student.name}`,"success");
    setDmModal({open:false,student:null,msg:""});
    if(isConfigured){try{await DB.sendDm(dmObj);}catch(e){console.warn("DM error:",e.message);}}
  };
  /* Send DM between students */
  const sendStudentDM=async(toStudent,msg)=>{
    if(!msg.trim()||!activeStudent)return;
    const dmObj={fromId:activeStudent.id,fromName:activeStudent.name,fromAvatar:activeStudent.avatar,toId:toStudent.id,toName:toStudent.name,msg};
    const newDm={id:Date.now(),...dmObj,ts:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),read:false};
    setDms(p=>[...p,newDm]);
    if(isConfigured){try{await DB.sendDm(dmObj);}catch(e){console.warn("DM error:",e.message);}}
  };

  const scopedStudents=useMemo(()=>{
    if(!currentUser||!role)return students;
    if(role==="hod")return students.filter(s=>s.dept===currentUser.dept);
    if(role==="incharge")return students.filter(s=>s.dept===currentUser.dept&&s.section===currentUser.section);
    return students;
  },[role,currentUser,students]);

  /* My DMs (for student) */
  const myDms=useMemo(()=>{
    if(!activeStudent)return[];
    return dms.filter(d=>d.toId===activeStudent.id||d.fromId===activeStudent.id);
  },[dms,activeStudent]);

  const myUnread=myDms.filter(d=>d.toId===activeStudent?.id&&!d.read).length;

  if(dbLoading)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0A0A0E",flexDirection:"column",gap:20}}>
      <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#FF6B2B,#FF3D00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,animation:"glowPulse 1.2s infinite"}}>✦</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:"#F2F2F8"}}>Loading ORBIT…</div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"rgba(255,107,43,0.6)",letterSpacing:1}}>CONNECTING TO DATABASE</div>
    </div>
  );

  if(showKeyModal)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0A0A0E",fontFamily:"'Space Grotesk',sans-serif"}}>
      <div style={{width:480,padding:48,borderRadius:24,background:"#0F0F1A",border:"1px solid rgba(255,107,43,0.2)",boxShadow:"0 0 80px rgba(255,107,43,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:32}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#FF6B2B,#FF3D00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✦</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:"#F2F2F8"}}><span style={{color:"#FF6B2B"}}>OR</span>BIT</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#FF6B2B",letterSpacing:2}}>SETUP REQUIRED</div>
          </div>
        </div>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:"#F2F2F8",marginBottom:8}}>Connect Gemini AI</h2>
        <p style={{fontSize:13,color:"rgba(242,242,248,0.5)",lineHeight:1.7,marginBottom:24}}>
          ORBIT uses Google Gemini for Beacon AI, Mock Tests, and Mock Interviews. Enter your Gemini API key to continue.<br/><br/>
          Get a free key at <span style={{color:"#FF6B2B"}}>aistudio.google.com</span> → Get API Key (free with Google account, works with Gemini Pro subscription too).
        </p>
        <label style={{display:"block",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"rgba(242,242,248,0.4)",letterSpacing:1,marginBottom:8}}>GEMINI API KEY</label>
        <input
          type="password"
          value={geminiKey}
          onChange={e=>setGeminiKey(e.target.value)}
          placeholder="AIzaSy..."
          style={{width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,107,43,0.25)",borderRadius:12,color:"#F2F2F8",fontSize:14,outline:"none",marginBottom:20}}
        />
        <div style={{display:"flex",gap:12}}>
          <button onClick={()=>{if(geminiKey.trim()){window.__GEMINI_KEY=geminiKey;localStorage.setItem("orbit_gemini_key",geminiKey);setShowKeyModal(false);}}} style={{flex:1,padding:"14px",background:"linear-gradient(135deg,#FF6B2B,#FF3D00)",border:"none",borderRadius:12,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 0 24px rgba(255,107,43,0.4)"}}>
            Connect & Launch →
          </button>
          <button onClick={()=>setShowKeyModal(false)} style={{padding:"14px 20px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,color:"rgba(242,242,248,0.5)",fontSize:14,cursor:"pointer"}}>
            Skip
          </button>
        </div>
        <p style={{marginTop:20,fontSize:11,color:"rgba(242,242,248,0.3)",fontFamily:"'JetBrains Mono',monospace",lineHeight:1.6}}>🔒 Stored locally in your browser only. Never sent to any ORBIT server.</p>
      </div>
    </div>
  );

  if(!role) return (<LandingPage handleLogin={handleLogin} setShowReg={setShowReg} showReg={showReg} regForm={regForm} setRegForm={setRegForm} handleRegSubmit={handleRegSubmit} showNotif={showNotif} students={students}/>);

  return(
    <div style={{fontFamily:"'Space Grotesk',sans-serif",background:D.bg0,minHeight:"100vh",color:D.t1}}>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",top:-200,left:-200,width:600,height:600,borderRadius:"50%",background:`radial-gradient(circle,rgba(255,107,43,0.06) 0%,transparent 65%)`,filter:"blur(40px)"}}/>
        <div style={{position:"absolute",bottom:-150,right:-150,width:500,height:500,borderRadius:"50%",background:`radial-gradient(circle,rgba(124,63,255,0.05) 0%,transparent 65%)`,filter:"blur(40px)"}}/>
      </div>
      {notif&&(
        <div className="fade-up" style={{position:"fixed",top:20,right:20,zIndex:9999,padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:500,backdropFilter:"blur(16px)",background:notif.type==="success"?"rgba(0,232,122,0.12)":notif.type==="error"?"rgba(255,61,90,0.12)":"rgba(255,107,43,0.12)",border:`1px solid ${notif.type==="success"?D.green:notif.type==="error"?D.red:D.orange}`,color:D.t1,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
          {notif.msg}
        </div>
      )}
      {/* Incharge DM Modal */}
      {dmModal.open&&(
        <div style={{position:"fixed",inset:0,zIndex:8000,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setDmModal({open:false,student:null,msg:""});}}>
          <div className="slide-in" style={{background:D.bg2,borderRadius:20,padding:36,width:440,border:`1px solid ${D.blue}30`,boxShadow:`0 0 60px rgba(61,142,255,0.2),0 24px 80px rgba(0,0,0,0.7)`}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
              <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${TIER[dmModal.student?.tier]?.color||D.blue},${D.blue}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>{dmModal.student?.avatar}</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:D.t1}}>Message {dmModal.student?.name}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>{dmModal.student?.roll} · {dmModal.student?.dept}-{dmModal.student?.section}</div>
              </div>
              <button onClick={()=>setDmModal({open:false,student:null,msg:""})} style={{marginLeft:"auto",background:"none",border:"none",color:D.t4,cursor:"pointer",fontSize:20}}>✕</button>
            </div>
            <div style={{marginBottom:8}}>
              <label style={{display:"block",fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,letterSpacing:1,marginBottom:8}}>MESSAGE</label>
              <textarea value={dmModal.msg} onChange={e=>setDmModal(p=>({...p,msg:e.target.value}))} placeholder="Type your message to the student…" rows={5}
                style={{width:"100%",padding:"12px 14px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b2}`,borderRadius:12,color:D.t1,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.6}}/>
            </div>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button onClick={()=>sendDMFromIncharge(dmModal.student,dmModal.msg)} style={{flex:1,padding:"13px",background:`linear-gradient(135deg,${D.blue},#1A5FCC)`,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:`0 0 20px rgba(61,142,255,0.35)`}}>
                Send Message →
              </button>
              <button onClick={()=>setDmModal({open:false,student:null,msg:""})} style={{padding:"13px 20px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b1}`,borderRadius:12,color:D.t3,cursor:"pointer",fontSize:14}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <Sidebar role={role} view={view} setView={setView} setRole={setRole} currentUser={currentUser} activeStudent={activeStudent} pendingCount={students.filter(s=>s.status==="PENDING").length} dmUnread={myUnread}/>
      <div style={{marginLeft:230,minHeight:"100vh",position:"relative",zIndex:1}}>
        <TopBar role={role} activeStudent={activeStudent} currentUser={currentUser}/>
        <div style={{padding:"24px 28px"}}>
          {role==="admin"&&(
            <>
              {view==="dashboard" &&<AdminDashboard students={students} offers={MOCK_OFFERS} deptData={DEPT_DATA} setView={setView}/>}
              {view==="students"  &&<StudentsPage students={students} setView={setView} setActiveStudent={setActiveStudent}/>}
              {view==="approvals" &&<ApprovalQueue students={students} handleApprove={handleApprove} handleReject={handleReject} showNotif={showNotif}/>}
              {view==="placement" &&<PlacementFilter students={students} setActiveStudent={setActiveStudent} setView={setView} showNotif={showNotif}/>}
              {view==="audit"     &&<AuditLog logs={MOCK_AUDIT}/>}
              {view==="edit"      &&<EditProfiles students={students} setStudents={setStudents} showNotif={showNotif}/>}
              {view==="offers"    &&<OffersManager offers={MOCK_OFFERS} showNotif={showNotif}/>}
              {view==="community" &&<Community messages={communityMsgs} setMessages={setCommunityMsgs} chatInput={chatInput} setChatInput={setChatInput} activeUser={{name:"Admin",avatar:"AD",id:"admin"}} allStudents={students} dms={dms} sendDM={sendStudentDM} role="admin"/>}
            </>
          )}
          {role==="hod"&&(
            <>
              {view==="dashboard" &&<HODDashboard students={scopedStudents} offers={MOCK_OFFERS.filter(o=>scopedStudents.some(s=>s.name===o.student))} currentUser={currentUser} setView={setView}/>}
              {view==="students"  &&<StudentsPage students={scopedStudents} setView={setView} setActiveStudent={setActiveStudent} readOnly/>}
              {view==="placement" &&<PlacementFilter students={scopedStudents} setActiveStudent={setActiveStudent} setView={setView} showNotif={showNotif}/>}
              {view==="offers"    &&<OffersManager offers={MOCK_OFFERS.filter(o=>scopedStudents.some(s=>s.name===o.student))} showNotif={showNotif}/>}
              {view==="community" &&<Community messages={communityMsgs} setMessages={setCommunityMsgs} chatInput={chatInput} setChatInput={setChatInput} activeUser={currentUser} allStudents={scopedStudents} dms={dms} sendDM={sendStudentDM} role="hod"/>}
            </>
          )}
          {role==="incharge"&&(
            <>
              {view==="dashboard" &&<SectionDashboard students={scopedStudents} setView={setView} currentUser={currentUser} onMessageStudent={s=>setDmModal({open:true,student:s,msg:""})}/>}
              {view==="students"  &&<StudentsPage students={scopedStudents} setView={setView} setActiveStudent={setActiveStudent} readOnly onMessageStudent={s=>setDmModal({open:true,student:s,msg:""})}/>}
              {view==="community" &&<Community messages={communityMsgs} setMessages={setCommunityMsgs} chatInput={chatInput} setChatInput={setChatInput} activeUser={currentUser} allStudents={scopedStudents} dms={dms} sendDM={sendStudentDM} role="incharge"/>}
              {view==="interviews" &&<InterviewApprovals requests={interviewRequests} setRequests={setInterviewRequests} currentUser={currentUser} students={scopedStudents} showNotif={showNotif}/>}
            </>
          )}
          {role==="student"&&activeStudent&&(
            <>
              {view==="dashboard"  &&<StudentDashboard student={activeStudent} allStudents={students} verifyCode={verifyCode} showNotif={showNotif} myDms={myDms} setView={setView}/>}
              {view==="profile"    &&<StudentProfile student={activeStudent} verifyCode={verifyCode} showNotif={showNotif}/>}
              {view==="leaderboard"&&<Leaderboard students={students.filter(s=>s.status==="ACTIVE")} activeStudent={activeStudent}/>}
              {view==="offers"     &&<OffersManager offers={MOCK_OFFERS.filter(o=>o.student===activeStudent.name)} showNotif={showNotif} isStudent/>}
              {view==="community"  &&<Community messages={communityMsgs} setMessages={setCommunityMsgs} chatInput={chatInput} setChatInput={setChatInput} activeUser={activeStudent} allStudents={students.filter(s=>s.status==="ACTIVE"&&s.id!==activeStudent.id)} dms={myDms} sendDM={sendStudentDM} role="student" setDmsRead={async(dmId)=>{setDms(p=>p.map(d=>d.id===dmId?{...d,read:true}:d));if(isConfigured)await DB.markDmRead(dmId);}}/>}
              {view==="platforms"  &&<PlatformsHub student={activeStudent}/>}
              {view==="resume"      &&<ResumeBuilder student={activeStudent} showNotif={showNotif}/>}
              {view==="mocktest"    &&<MockTest student={activeStudent} showNotif={showNotif}/>}
              {view==="interview"   &&<MockInterview student={activeStudent} requests={interviewRequests.filter(r=>r.studentId===activeStudent.id)} setRequests={setInterviewRequests} showNotif={showNotif}/>}
            </>
          )}
        </div>
      </div>
      <BeaconAI student={activeStudent} role={role} currentUser={currentUser}/>
    </div>
  );
}

/* ══════════════════════════════════════════
   LANDING PAGE — News bar REMOVED
══════════════════════════════════════════ */
function LandingPage({handleLogin,setShowReg,showReg,regForm,setRegForm,handleRegSubmit,showNotif,students}){
  const[loginType,setLoginType]=useState(null);
  const[identifier,setIdentifier]=useState("");
  const[password,setPassword]=useState("");
  const[showPw,setShowPw]=useState(false);
  const ROLES=[
    {r:"admin",    label:"Admin",           sub:"Full System Control",  icon:"⬡", color:D.red,    hint:"Email + Password"},
    {r:"hod",      label:"Head of Dept",    sub:"Dept Analytics",       icon:"◈", color:D.violet, hint:"Email + Password"},
    {r:"incharge", label:"Section Incharge",sub:"Section Dashboard",    icon:"◎", color:D.blue,   hint:"Email + Password"},
    {r:"student",  label:"Student",         sub:"Personal Dashboard",   icon:"▲", color:D.orange, hint:"Roll No + Password"},
  ];
  const DEMO={
    admin:[["Email","admin@orbit.edu"],["Password","Admin@123"]],
    hod:[["Email (CSE)","hod.cse@orbit.edu"],["Password","Hod@CSE1"]],
    incharge:[["Email (CSE-A)","si.cse.a@orbit.edu"],["Password","SI@CSEa1"]],
    student:[["Roll No",(students&&students.length>0)?students.find(s=>s.status==="ACTIVE")?.roll||"21CSE001":"21CSE001"],["Password","Pass@123"]],
  };
  const chosen=ROLES.find(r=>r.r===loginType);
  const tryLogin=()=>{
    if(!identifier.trim()||!password.trim()){showNotif("Enter credentials","error");return;}
    handleLogin(loginType,identifier.trim(),password.trim());
  };
  if(showReg) return (<RegistrationForm regForm={regForm} setRegForm={setRegForm} handleRegSubmit={handleRegSubmit} setShowReg={setShowReg}/>);
  return(
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 20% 15%,rgba(255,107,43,0.08) 0%,transparent 45%), radial-gradient(ellipse at 80% 85%,rgba(124,63,255,0.07) 0%,transparent 45%), ${D.bg0}`,display:"flex",flexDirection:"column",fontFamily:"'Space Grotesk',sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)`,backgroundSize:"40px 40px",pointerEvents:"none"}}/>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:32}}>
        {loginType?(
          <div className="fade-up" style={{width:420,background:"rgba(10,10,14,0.92)",backdropFilter:"blur(32px)",border:`1px solid ${chosen.color}30`,borderRadius:24,padding:44,position:"relative",boxShadow:`0 0 0 1px ${chosen.color}15, 0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)`}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${chosen.color},transparent)`,borderRadius:"24px 24px 0 0"}}/>
            <button onClick={()=>{setLoginType(null);setIdentifier("");setPassword("");}} style={{position:"absolute",top:18,left:18,background:"none",border:"none",color:D.t4,fontSize:18,cursor:"pointer"}}>←</button>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:32,marginTop:4}}>
              <div style={{width:46,height:46,borderRadius:14,background:`${chosen.color}18`,border:`1px solid ${chosen.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:chosen.color}}>{chosen.icon}</div>
              <div><div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:D.t1}}>{chosen.label}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:chosen.color,letterSpacing:1,marginTop:2}}>{chosen.hint}</div></div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,letterSpacing:1.5,marginBottom:8}}>{loginType==="student"?"ROLL NUMBER":"EMAIL ADDRESS"}</label>
              <input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder={loginType==="student"?"e.g. 21CSE001":"e.g. hod.cse@orbit.edu"} style={{width:"100%",padding:"13px 16px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b2}`,borderRadius:12,color:D.t1,fontSize:14,outline:"none"}} onFocus={e=>e.target.style.borderColor=chosen.color} onBlur={e=>e.target.style.borderColor=D.b2}/>
            </div>
            <div style={{marginBottom:28,position:"relative"}}>
              <label style={{display:"block",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,letterSpacing:1.5,marginBottom:8}}>PASSWORD</label>
              <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="Enter password" style={{width:"100%",padding:"13px 48px 13px 16px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b2}`,borderRadius:12,color:D.t1,fontSize:14,outline:"none"}} onFocus={e=>e.target.style.borderColor=chosen.color} onBlur={e=>e.target.style.borderColor=D.b2}/>
              <button onClick={()=>setShowPw(!showPw)} style={{position:"absolute",right:14,top:34,background:"none",border:"none",color:D.t4,cursor:"pointer",fontSize:14}}>{showPw?"🙈":"👁"}</button>
            </div>
            <button onClick={tryLogin} style={{width:"100%",padding:"15px",background:`linear-gradient(135deg,${chosen.color},${chosen.color}cc)`,border:"none",borderRadius:13,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:`0 0 28px ${chosen.color}40, 0 4px 16px rgba(0,0,0,0.3)`}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";}}>Sign In →</button>
            <div style={{marginTop:20,padding:"14px 16px",borderRadius:12,background:`rgba(255,255,255,0.02)`,border:`1px solid ${D.b1}`}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,letterSpacing:2,marginBottom:10}}>DEMO CREDENTIALS</div>
              {(DEMO[loginType]||[]).map(([label,val])=>(
                <div key={label} style={{display:"flex",gap:8,marginBottom:5,alignItems:"center"}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,minWidth:88}}>{label}</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t2,cursor:"pointer"}} onClick={()=>{if(label.toLowerCase().includes("password"))setPassword(val);else setIdentifier(val);}}>
                    {val} <span style={{color:chosen.color,fontSize:8}}>(click)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ):(
          <div style={{textAlign:"center",maxWidth:600}}>
            <div style={{position:"relative",width:96,height:96,margin:"0 auto 32px"}}>
              <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`2px solid rgba(255,107,43,0.3)`,animation:"orbitSpin 8s linear infinite"}}/>
              <div style={{position:"absolute",inset:8,borderRadius:"50%",border:`1px solid rgba(124,63,255,0.2)`}}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:D.orange}}>✦</div>
              <div style={{position:"absolute",top:4,left:"50%",width:10,height:10,borderRadius:"50%",background:D.orange,transform:"translateX(-50%)",boxShadow:`0 0 12px ${D.orange}`,animation:"orbitSpin 8s linear infinite"}}/>
            </div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:72,fontWeight:900,letterSpacing:-4,background:`linear-gradient(135deg,${D.t1} 0%,${D.orange} 60%,${D.violet} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>ORBIT</h1>
            <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.orange,letterSpacing:5,marginTop:12}}>PLACEMENT & ACADEMIC INTELLIGENCE</p>
            <p style={{color:D.t3,fontSize:14,marginTop:18,lineHeight:1.8}}>Schema v2 composite scoring · Beacon AI · Live platform tracking · Badges & Ranks</p>
            <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginTop:36,marginBottom:16,letterSpacing:3}}>SELECT YOUR ROLE</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,maxWidth:500,margin:"0 auto"}}>
              {ROLES.map((btn,idx)=>(
                <button key={btn.r} className={`fade-up-${idx+1}`} onClick={()=>{setLoginType(btn.r);setIdentifier("");setPassword("");}}
                  style={{padding:"22px 20px",background:D.bg2,border:`1px solid ${btn.color}30`,borderRadius:18,color:D.t1,textAlign:"left",cursor:"pointer",position:"relative",overflow:"hidden",transition:"all 0.22s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=`${btn.color}60`;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 0 32px ${btn.color}25,0 12px 40px rgba(0,0,0,0.5)`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=`${btn.color}30`;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${btn.color},transparent)`,opacity:0.5}}/>
                  <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:btn.color,opacity:0.05,filter:"blur(20px)"}}/>
                  <div style={{width:40,height:40,borderRadius:12,background:`${btn.color}14`,border:`1px solid ${btn.color}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:btn.color,marginBottom:14}}>{btn.icon}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:D.t1}}>{btn.label}</div>
                  <div style={{fontSize:12,color:D.t3,marginTop:3}}>{btn.sub}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:8}}>{btn.hint}</div>
                  <div style={{position:"absolute",bottom:16,right:18,fontSize:13,color:D.t4}}>→</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setShowReg(true)} style={{marginTop:20,background:"none",border:"none",color:D.orange,fontSize:13,cursor:"pointer",textDecoration:"underline"}}>New student? Register →</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── REGISTRATION FORM ─── */
function RegistrationForm({regForm,setRegForm,handleRegSubmit,setShowReg}){
  const fields=[{key:"name",label:"Full Name",placeholder:"Arjun Sharma"},{key:"roll",label:"Roll Number",placeholder:"21CS101"},{key:"cgpa",label:"CGPA",placeholder:"8.5"},{key:"leetcode",label:"LeetCode Handle",placeholder:"arjun_lc"},{key:"github",label:"GitHub Username",placeholder:"arjun-dev"},{key:"codeforces",label:"Codeforces Handle",placeholder:"arjun_cf"},{key:"codechef",label:"CodeChef Handle",placeholder:"arjun_cc"}];
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:D.bg0}}>
      <Card style={{padding:40,width:520,position:"relative"}} accent={D.orange}>
        <button onClick={()=>setShowReg(false)} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:D.t4,fontSize:20,cursor:"pointer"}}>✕</button>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:800,marginBottom:6,color:D.t1}}>Create Account</h2>
        <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.orange,marginBottom:28,letterSpacing:1}}>STATUS → PENDING ADMIN APPROVAL</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {fields.map(f=><div key={f.key}><label style={{fontSize:10,color:D.t4,fontFamily:"'JetBrains Mono',monospace",display:"block",marginBottom:5,letterSpacing:1}}>{f.label.toUpperCase()}</label><input value={regForm[f.key]||""} onChange={e=>setRegForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} style={{width:"100%",padding:"11px 14px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b1}`,borderRadius:10,color:D.t1,fontSize:13,outline:"none"}}/></div>)}
          <div><label style={{fontSize:10,color:D.t4,fontFamily:"'JetBrains Mono',monospace",display:"block",marginBottom:5,letterSpacing:1}}>DEPT</label><select value={regForm.dept} onChange={e=>setRegForm(p=>({...p,dept:e.target.value}))} style={{width:"100%",padding:"11px 14px",background:D.bg3,border:`1px solid ${D.b1}`,borderRadius:10,color:D.t1,fontSize:13,outline:"none"}}>{["CSE","ECE","MECH","IT","AIDS"].map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label style={{fontSize:10,color:D.t4,fontFamily:"'JetBrains Mono',monospace",display:"block",marginBottom:5,letterSpacing:1}}>SECTION</label><select value={regForm.section} onChange={e=>setRegForm(p=>({...p,section:e.target.value}))} style={{width:"100%",padding:"11px 14px",background:D.bg3,border:`1px solid ${D.b1}`,borderRadius:10,color:D.t1,fontSize:13,outline:"none"}}>{["A","B","C","D"].map(s=><option key={s}>{s}</option>)}</select></div>
        </div>
        <button onClick={handleRegSubmit} style={{marginTop:24,width:"100%",padding:"14px",background:`linear-gradient(135deg,${D.orange},#FF3D00)`,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:`0 0 24px rgba(255,107,43,0.4)`}}>Submit Registration →</button>
      </Card>
    </div>
  );
}

/* ─── SIDEBAR ─── */
function Sidebar({role,view,setView,setRole,currentUser,activeStudent,pendingCount,dmUnread}){
  const NAV={
    admin:[{id:"dashboard",icon:"◈",label:"Overview"},{id:"students",icon:"◉",label:"All Students"},{id:"placement",icon:"◇",label:"Placement Filter"},{id:"approvals",icon:"⬡",label:"Approvals",badge:pendingCount},{id:"offers",icon:"◆",label:"Offers"},{id:"edit",icon:"✏",label:"Edit Profiles"},{id:"audit",icon:"◎",label:"Audit Trail"},{id:"community",icon:"▲",label:"Community"}],
    hod:[{id:"dashboard",icon:"◈",label:"Dept Overview"},{id:"students",icon:"◉",label:"My Dept"},{id:"placement",icon:"◇",label:"Placement Filter"},{id:"offers",icon:"◆",label:"Offers"},{id:"community",icon:"▲",label:"Community"}],
    incharge:[{id:"dashboard",icon:"◈",label:"Section Overview"},{id:"students",icon:"◉",label:"My Section"},{id:"interviews",icon:"⚔",label:"Interview Requests"},{id:"community",icon:"▲",label:"Community"}],
    student:[{id:"dashboard",icon:"◈",label:"Dashboard"},{id:"profile",icon:"◎",label:"My Profile"},{id:"platforms",icon:"◇",label:"Platforms"},{id:"resume",icon:"◆",label:"Resume Builder"},{id:"mocktest",icon:"⬡",label:"Mock Test"},{id:"interview",icon:"⚔",label:"Mock Interview"},{id:"leaderboard",icon:"▲",label:"Leaderboard"},{id:"offers",icon:"◉",label:"My Offers"},{id:"community",icon:"▲",label:"Community",badge:dmUnread}],
  };
  const ROLE_COLOR={admin:D.red,hod:D.violet,incharge:D.blue,student:D.orange};
  const cu=currentUser||activeStudent||{};
  const roleColor=ROLE_COLOR[role]||D.orange;
  const roleSub=role==="hod"?`${cu.dept||""} Dept`:role==="incharge"?`${cu.dept||""}-${cu.section||""}`:role==="student"?(activeStudent?.dept||""):"All Depts";
  return(
    <div style={{position:"fixed",left:0,top:0,bottom:0,width:230,background:D.bg1,borderRight:`1px solid ${D.b1}`,zIndex:200,display:"flex",flexDirection:"column",padding:"0 0 20px"}}>
      <div style={{padding:"22px 20px 20px",borderBottom:`1px solid ${D.b1}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{position:"relative",width:32,height:32,flexShrink:0}}>
            <div className="orbit-spin" style={{position:"absolute",inset:0,borderRadius:"50%",border:`1.5px solid ${D.orange}40`}}/>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:D.orange}}>✦</div>
          </div>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,letterSpacing:-1}}><span style={{color:D.orange}}>OR</span><span style={{color:D.t2}}>BIT</span></span>
        </div>
      </div>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${D.b1}`}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg,${roleColor},${roleColor}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:800,boxShadow:`0 0 16px ${roleColor}40`,flexShrink:0}}>{role==="student"?(activeStudent?.avatar||"ST"):(cu.avatar||"??")}</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:D.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{role==="student"?(activeStudent?.name?.split(" ")[0]||"Student"):(cu.name||"User")}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:roleColor,letterSpacing:1,marginTop:1}}>{roleSub||role?.toUpperCase()}</div>
          </div>
        </div>
      </div>
      <nav style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
        {(NAV[role]||[]).map(item=>{
          const active=view===item.id;
          return(
            <button key={item.id} onClick={()=>setView(item.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,border:"none",cursor:"pointer",background:active?`${roleColor}14`:"transparent",color:active?roleColor:D.t4,fontSize:13,fontWeight:active?600:400,marginBottom:2,textAlign:"left",transition:"all 0.15s",borderLeft:active?`2px solid ${roleColor}`:"2px solid transparent"}}
              onMouseEnter={e=>{if(!active){e.currentTarget.style.background=`rgba(255,255,255,0.04)`;e.currentTarget.style.color=D.t2;}}}
              onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color=D.t4;}}}>
              <span style={{fontSize:14,width:16,textAlign:"center",flexShrink:0}}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge>0&&<span style={{marginLeft:"auto",minWidth:20,height:20,borderRadius:10,background:D.red,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace"}}>{item.badge}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{padding:"0 10px"}}>
        <button onClick={()=>setRole(null)} style={{width:"100%",padding:"10px 12px",background:`rgba(255,61,90,0.08)`,border:`1px solid rgba(255,61,90,0.15)`,borderRadius:12,color:"#FF6B7A",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          <span>↩</span> Sign Out
        </button>
      </div>
    </div>
  );
}

/* ─── TOP BAR — news bar only for logged-in users ─── */
function TopBar({role,activeStudent,currentUser}){
  const cu=currentUser||activeStudent;
  const[newsIdx,setNewsIdx]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setNewsIdx(i=>(i+1)%NEWS.length),5000);return()=>clearInterval(t);},[]);
  return(
    <div style={{position:"sticky",top:0,zIndex:100,background:`rgba(7,7,10,0.92)`,backdropFilter:"blur(20px)",borderBottom:`1px solid ${D.b1}`,padding:"0 28px",height:56,display:"flex",alignItems:"center",gap:16,boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
      <div style={{flex:1,overflow:"hidden",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.orange,letterSpacing:3,whiteSpace:"nowrap",animation:"pulsate 2s infinite"}}>◉ LIVE</span>
        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:12,color:D.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{NEWS[newsIdx].text}</span>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,whiteSpace:"nowrap",flexShrink:0}}>{NEWS[newsIdx].time}</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        {cu&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,padding:"5px 12px",background:`rgba(255,255,255,0.04)`,borderRadius:8,border:`1px solid ${D.b1}`}}>{role==="student"?`${activeStudent?.roll||""} · ${activeStudent?.dept||""}`:role==="hod"?`HOD · ${cu.dept||""}`:role==="incharge"?`${cu.dept||""}-${cu.section||""} · Incharge`:"Admin · All Depts"}</div>}
        <LiveClock/>
        <div style={{width:8,height:8,borderRadius:"50%",background:D.green,boxShadow:`0 0 8px ${D.green}`,animation:"pulsate 2s infinite"}}/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ADMIN DASHBOARD — UPGRADED
══════════════════════════════════════════ */
function AdminDashboard({students,offers,deptData,setView}){
  const active=students.filter(s=>s.status==="ACTIVE");
  const pending=students.filter(s=>s.status==="PENDING");
  const ready=active.filter(s=>s.placementReady);
  const acceptedOffers=MOCK_OFFERS.filter(o=>o.status==="ACCEPTED");
  const tierDist=["Elite","Advanced","Intermediate","Beginner"].map(t=>({name:t,value:active.filter(s=>s.tier===t).length,color:TIER[t].color}));
  const deptBarData=DEPTS.map(d=>({dept:d,elite:active.filter(s=>s.dept===d&&s.tier==="Elite").length,advanced:active.filter(s=>s.dept===d&&s.tier==="Advanced").length,intermediate:active.filter(s=>s.dept===d&&s.tier==="Intermediate").length}));
  const avgScore=active.length?Math.round(active.reduce((a,s)=>a+s.score,0)/active.length):0;
  const lowStreak=active.filter(s=>s.streak<5);
  const unverified=active.filter(s=>!s.lcVerified||!s.ghVerified);

  /* Pipeline funnel data */
  const pipeline=[
    {name:"Registered",value:students.length,fill:D.violet},
    {name:"Active",value:active.length,fill:D.blue},
    {name:"Placement Ready",value:ready.length,fill:D.orange},
    {name:"Offers Out",value:MOCK_OFFERS.length,fill:D.amber},
    {name:"Accepted",value:acceptedOffers.length,fill:D.green},
  ];

  /* Dept health scores */
  const deptHealth=DEPTS.map(d=>{
    const ds=active.filter(s=>s.dept===d);
    if(!ds.length)return{dept:d,health:0,avg:0,ready:0};
    const avg=Math.round(ds.reduce((a,s)=>a+s.score,0)/ds.length);
    const readyPct=Math.round((ds.filter(s=>s.placementReady).length/ds.length)*100);
    const health=Math.round((avg/600)*50+(readyPct/100)*50);
    return{dept:d,health,avg,ready:readyPct,count:ds.length};
  });

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,letterSpacing:-1,color:D.t1}}>System Overview</h1>
        <p style={{color:D.t4,fontSize:13,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>ORBIT Admin · All departments · {new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
      </div>

      {/* KPI Strip */}
      <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
        {[
          {label:"Total Active",value:active.length,color:D.green,sub:`${pending.length} pending`,icon:"◈"},
          {label:"Elite Tier",value:active.filter(s=>s.tier==="Elite").length,color:D.orange,sub:"Score ≥ 400",icon:"◆"},
          {label:"Placement Ready",value:ready.length,color:D.cyan,sub:"CF>1400 & LC>100",icon:"🚀"},
          {label:"Avg Score",value:avgScore,color:D.violet,sub:`${DEPTS.length} depts`,icon:"▲"},
          {label:"Offers Accepted",value:acceptedOffers.length,color:D.amber,sub:`${MOCK_OFFERS.length} total`,icon:"◇"},
        ].map(kpi=>(
          <Card key={kpi.label} glow accent={kpi.color} style={{padding:"18px 20px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-10,right:-10,width:60,height:60,borderRadius:"50%",background:kpi.color,opacity:0.06,filter:"blur(20px)"}}/>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginBottom:8,letterSpacing:1}}>{kpi.icon} {kpi.label.toUpperCase()}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:34,fontWeight:900,color:kpi.color,lineHeight:1}}>{kpi.value}</div>
            {kpi.sub&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:kpi.color,marginTop:6,opacity:0.7}}>{kpi.sub}</div>}
          </Card>
        ))}
      </div>

      <div className="fade-up-1" style={{display:"grid",gridTemplateColumns:"1.1fr 1fr",gap:16,marginBottom:16}}>
        {/* Placement Pipeline Funnel */}
        <Card style={{padding:24}} accent={D.orange}>
          <SectionLabel>Placement Pipeline</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pipeline.map((stage,i)=>{
              const pct=Math.round((stage.value/students.length)*100);
              return(
                <div key={stage.name}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t3}}>{stage.name}</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:stage.fill}}>{stage.value}</span>
                  </div>
                  <div style={{height:10,background:`rgba(255,255,255,0.04)`,borderRadius:5,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${stage.fill}99,${stage.fill})`,borderRadius:5,transition:"width 0.8s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:18,display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={()=>setView("approvals")} style={{padding:"7px 14px",background:`rgba(255,61,90,0.1)`,border:`1px solid rgba(255,61,90,0.25)`,borderRadius:8,color:D.red,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>⬡ {pending.length} Pending</button>
            <button onClick={()=>setView("placement")} style={{padding:"7px 14px",background:`rgba(0,232,122,0.08)`,border:`1px solid rgba(0,232,122,0.2)`,borderRadius:8,color:D.green,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>◇ Filter Students</button>
          </div>
        </Card>

        {/* Dept Performance */}
        <Card style={{padding:24}}>
          <SectionLabel>Dept Performance</SectionLabel>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="dept" stroke={D.t4} tick={{fill:D.t4,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}/>
              <YAxis stroke={D.t4} tick={{fill:D.t4,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="elite" name="Elite" fill={D.orange} stackId="a" radius={[0,0,0,0]}/>
              <Bar dataKey="advanced" name="Advanced" fill={D.violet} stackId="a"/>
              <Bar dataKey="intermediate" name="Intermediate" fill={D.green} stackId="a" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="fade-up-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
        {/* Dept Health Cards */}
        {deptHealth.slice(0,3).map(d=>(
          <Card key={d.dept} style={{padding:20}} accent={d.health>70?D.green:d.health>45?D.amber:D.red}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:D.t1}}>{d.dept}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:2}}>{d.count} students</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:d.health>70?D.green:d.health>45?D.amber:D.red}}>{d.health}%</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>Health</div>
              </div>
            </div>
            <div style={{height:4,background:`rgba(255,255,255,0.06)`,borderRadius:4}}>
              <div style={{height:"100%",width:`${d.health}%`,background:`linear-gradient(90deg,${d.health>70?D.green:d.health>45?D.amber:D.red}88,${d.health>70?D.green:d.health>45?D.amber:D.red})`,borderRadius:4}}/>
            </div>
            <div style={{display:"flex",gap:12,marginTop:10}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>Avg <span style={{color:D.violet}}>{d.avg}</span></div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>Ready <span style={{color:D.cyan}}>{d.ready}%</span></div>
            </div>
          </Card>
        ))}
      </div>

      <div className="fade-up-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Alert: Low Streak */}
        <Card style={{padding:20,border:`1px solid rgba(255,61,90,0.18)`}} accent={D.red}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:16}}>⚠</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:D.red}}>Low Streak Alert</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.red,marginLeft:"auto"}}>{lowStreak.length} students</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {lowStreak.slice(0,8).map(s=>(
              <div key={s.id} style={{padding:"4px 10px",borderRadius:8,background:`rgba(255,61,90,0.07)`,border:`1px solid rgba(255,61,90,0.15)`,fontSize:11,display:"flex",gap:6,alignItems:"center"}}>
                <span style={{color:D.t2}}>{s.name.split(" ")[0]}</span>
                <span style={{color:D.red,fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>{s.streak}d</span>
              </div>
            ))}
          </div>
        </Card>
        {/* Alert: Unverified Handles */}
        <Card style={{padding:20,border:`1px solid rgba(255,181,71,0.18)`}} accent={D.amber}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:16}}>🔗</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:D.amber}}>Unverified Handles</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.amber,marginLeft:"auto"}}>{unverified.length} students</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {unverified.slice(0,8).map(s=>(
              <div key={s.id} style={{padding:"4px 10px",borderRadius:8,background:`rgba(255,181,71,0.07)`,border:`1px solid rgba(255,181,71,0.15)`,fontSize:11,display:"flex",gap:6,alignItems:"center"}}>
                <span style={{color:D.t2}}>{s.name.split(" ")[0]}</span>
                <span style={{color:D.amber,fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>{!s.lcVerified?"LC ":""}{ !s.ghVerified?"GH":""}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top Students */}
      <Card className="fade-up-4" style={{padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <SectionLabel accent={D.amber}>Top 10 Students — All Departments</SectionLabel>
          <button onClick={()=>setView("students")} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.orange,background:"none",border:"none",cursor:"pointer"}}>View All →</button>
        </div>
        {[...active].sort((a,b)=>b.score-a.score).slice(0,10).map((s,i)=>(
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<9?`1px solid ${D.b1}`:"none"}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:i<3?D.amber:D.t4,minWidth:20}}>#{i+1}</span>
            <div style={{width:30,height:30,borderRadius:9,background:`linear-gradient(135deg,${TIER[s.tier].color},${TIER[s.tier].color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:900,flexShrink:0}}>{s.avatar}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:D.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:D.t4}}>{s.dept} · {s.roll}</div>
            </div>
            <Chip color={TIER[s.tier].color} style={{fontSize:9}}>{s.tier}</Chip>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,color:TIER[s.tier].color,minWidth:40,textAlign:"right"}}>{s.score}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════
   PLACEMENT FILTER — UPGRADED
══════════════════════════════════════════ */
function PlacementFilter({students,setActiveStudent,setView,showNotif}){
  const[company,setCompany]=useState("Any");
  const[minLC,setMinLC]=useState(0);
  const[minCF,setMinCF]=useState(0);
  const[minGPA,setMinGPA]=useState(0);
  const[minCGPA,setMinCGPA]=useState(0);
  const[filterDept,setFilterDept]=useState("All");
  const[filterSection,setFilterSection]=useState("All");
  const[filterTier,setFilterTier]=useState("All");
  const[onlyReady,setOnlyReady]=useState(false);
  const[shortlist,setShortlist]=useState(new Set());
  const[tab,setTab]=useState("filter"); // "filter" | "shortlist"

  /* Apply company preset */
  const applyPreset=(co)=>{
    setCompany(co);
    const p=COMPANY_PRESETS[co]||COMPANY_PRESETS["Any"];
    setMinLC(p.minLC);setMinCF(p.minCF);setMinGPA(p.minGPA);setMinCGPA(p.minCGPA);
  };

  const matched=students.filter(s=>{
    if(s.status!=="ACTIVE")return false;
    if((s.easy+s.medium+s.hard)<minLC)return false;
    if(s.cfRating<minCF)return false;
    if(s.score<minGPA)return false;
    if(parseFloat(s.cgpa)<minCGPA)return false;
    if(filterDept!=="All"&&s.dept!==filterDept)return false;
    if(filterSection!=="All"&&s.section!==filterSection)return false;
    if(filterTier!=="All"&&s.tier!==filterTier)return false;
    if(onlyReady&&!s.placementReady)return false;
    return true;
  });

  const tierBreakdown=["Elite","Advanced","Intermediate","Beginner"].map(t=>({name:t,value:matched.filter(s=>s.tier===t).length,color:TIER[t].color})).filter(x=>x.value>0);

  const toggleShortlist=(id)=>{
    setShortlist(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n;});
  };
  const exportShortlist=()=>{
    const sl=matched.filter(s=>shortlist.has(s.id));
    const text=sl.map(s=>`${s.name} | ${s.roll} | ${s.dept}-${s.section} | Score:${s.score} | CF:${s.cfRating} | LC:${s.easy+s.medium+s.hard} | CGPA:${s.cgpa}`).join("\n");
    const blob=new Blob([`ORBIT Shortlist — ${company}\n${"=".repeat(60)}\n${text}`],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`orbit-shortlist-${company.toLowerCase()}.txt`;a.click();
    showNotif("✅ Shortlist exported","success");
  };

  const slStudents=matched.filter(s=>shortlist.has(s.id));

  return(
    <div>
      <div style={{marginBottom:24,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Placement Filter</h1>
          <p style={{color:D.t4,fontSize:12,fontFamily:"'JetBrains Mono',monospace",marginTop:4}}>{matched.length} students match · {shortlist.size} shortlisted</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          {["filter","shortlist"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"9px 18px",background:tab===t?`rgba(255,107,43,0.12)`:`rgba(255,255,255,0.04)`,border:`1px solid ${tab===t?D.orange:D.b1}`,borderRadius:10,color:tab===t?D.orange:D.t3,fontSize:12,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:tab===t?700:400}}>
              {t==="filter"?"🔍 Filter":"📋 Shortlist"}{t==="shortlist"&&shortlist.size>0&&<span style={{marginLeft:6,background:D.orange,color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{shortlist.size}</span>}
            </button>
          ))}
          {shortlist.size>0&&<button onClick={exportShortlist} style={{padding:"9px 18px",background:`rgba(0,232,122,0.1)`,border:`1px solid rgba(0,232,122,0.25)`,borderRadius:10,color:D.green,fontSize:12,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700}}>⬇ Export</button>}
        </div>
      </div>

      {tab==="filter"&&(
        <>
          {/* Company Presets */}
          <Card className="fade-up" style={{padding:22,marginBottom:16}} accent={D.orange}>
            <SectionLabel>Company Eligibility Presets</SectionLabel>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18}}>
              {Object.keys(COMPANY_PRESETS).map(co=>(
                <button key={co} onClick={()=>applyPreset(co)} style={{padding:"7px 16px",borderRadius:20,fontSize:12,background:company===co?`${D.orange}18`:`rgba(255,255,255,0.04)`,border:`1px solid ${company===co?D.orange:D.b2}`,color:company===co?D.orange:D.t3,cursor:"pointer",transition:"all 0.15s",fontWeight:company===co?700:400}}>{co}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
              {[
                {label:"Min LC Solved",val:minLC,set:setMinLC,min:0,max:500,color:D.orange,step:10},
                {label:"Min CF Rating",val:minCF,set:setMinCF,min:0,max:3500,color:D.blue,step:100},
                {label:"Min Score",val:minGPA,set:setMinGPA,min:0,max:600,color:D.violet,step:10},
                {label:"Min CGPA",val:minCGPA,set:setMinCGPA,min:0,max:10,color:D.green,step:0.1},
              ].map(f=>(
                <div key={f.label}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <label style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,letterSpacing:0.5}}>{f.label.toUpperCase()}</label>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:f.color}}>{f.val}</span>
                  </div>
                  <input type="range" min={f.min} max={f.max} step={f.step||1} value={f.val} onChange={e=>f.set(+e.target.value)}
                    style={{width:"100%",accentColor:f.color,height:4}}/>
                </div>
              ))}
            </div>
          </Card>

          {/* Additional Filters */}
          <Card className="fade-up-1" style={{padding:22,marginBottom:16}} accent={D.violet}>
            <SectionLabel accent={D.violet}>Additional Filters</SectionLabel>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              {[["Dept","All",...DEPTS].map(d=>({val:d,label:d}))].flat().length>0&&(
                <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{padding:"9px 14px",background:D.bg3,border:`1px solid ${D.b2}`,borderRadius:10,color:D.t1,fontSize:12,outline:"none"}}>
                  {["All",...DEPTS].map(d=><option key={d}>{d==="All"?"All Depts":d}</option>)}
                </select>
              )}
              <select value={filterSection} onChange={e=>setFilterSection(e.target.value)} style={{padding:"9px 14px",background:D.bg3,border:`1px solid ${D.b2}`,borderRadius:10,color:D.t1,fontSize:12,outline:"none"}}>
                {["All","A","B","C"].map(s=><option key={s}>{s==="All"?"All Sections":"Section "+s}</option>)}
              </select>
              <select value={filterTier} onChange={e=>setFilterTier(e.target.value)} style={{padding:"9px 14px",background:D.bg3,border:`1px solid ${D.b2}`,borderRadius:10,color:D.t1,fontSize:12,outline:"none"}}>
                {["All","Elite","Advanced","Intermediate","Beginner"].map(t=><option key={t}>{t==="All"?"All Tiers":t}</option>)}
              </select>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"9px 14px",background:onlyReady?`rgba(0,232,122,0.08)`:`rgba(255,255,255,0.04)`,border:`1px solid ${onlyReady?D.green:D.b2}`,borderRadius:10}}>
                <input type="checkbox" checked={onlyReady} onChange={e=>setOnlyReady(e.target.checked)} style={{accentColor:D.green,width:14,height:14}}/>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:onlyReady?D.green:D.t3}}>Placement Ready Only</span>
              </label>
              <button onClick={()=>{setCompany("Any");setMinLC(0);setMinCF(0);setMinGPA(0);setMinCGPA(0);setFilterDept("All");setFilterSection("All");setFilterTier("All");setOnlyReady(false);}} style={{padding:"9px 14px",background:`rgba(255,61,90,0.08)`,border:`1px solid rgba(255,61,90,0.2)`,borderRadius:10,color:D.red,fontSize:12,cursor:"pointer"}}>✕ Reset</button>
            </div>
          </Card>

          {/* Stats Row */}
          <div className="fade-up-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Card style={{padding:20}}>
              <SectionLabel>Tier Breakdown of Results</SectionLabel>
              {tierBreakdown.length>0?(
                <div style={{display:"flex",gap:16,alignItems:"center"}}>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart><Pie data={tierBreakdown} cx="50%" cy="50%" innerRadius={32} outerRadius={54} dataKey="value" paddingAngle={4}>{tierBreakdown.map(e=><Cell key={e.name} fill={e.color}/>)}</Pie></PieChart>
                  </ResponsiveContainer>
                  <div style={{flex:1}}>
                    {tierBreakdown.map(t=>(
                      <div key={t.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <div style={{width:10,height:10,borderRadius:3,background:t.color,flexShrink:0}}/>
                        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t3,flex:1}}>{t.name}</span>
                        <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:t.color}}>{t.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ):<div style={{color:D.t4,fontSize:13,textAlign:"center",padding:20}}>No students match</div>}
            </Card>
            <Card style={{padding:20}} accent={D.cyan}>
              <SectionLabel accent={D.cyan}>Quick Stats</SectionLabel>
              {[
                ["Avg Score",matched.length?Math.round(matched.reduce((a,s)=>a+s.score,0)/matched.length):0,D.violet],
                ["Avg LC",matched.length?Math.round(matched.reduce((a,s)=>a+(s.easy+s.medium+s.hard),0)/matched.length):0,D.orange],
                ["Avg CF Rating",matched.length?Math.round(matched.reduce((a,s)=>a+s.cfRating,0)/matched.length):0,D.blue],
                ["Avg CGPA",(matched.length?(matched.reduce((a,s)=>a+parseFloat(s.cgpa),0)/matched.length).toFixed(1):0),D.green],
              ].map(([label,val,color])=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${D.b1}`}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>{label}</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color}}>{val}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Results */}
          <div className="fade-up-3">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:D.t1}}>{matched.length} Students Match</span>
              {matched.length>0&&<button onClick={()=>{matched.forEach(s=>setShortlist(prev=>{const n=new Set(prev);n.add(s.id);return n;}));showNotif(`✅ All ${matched.length} students added to shortlist`,"success");}} style={{fontSize:11,color:D.orange,background:`rgba(255,107,43,0.08)`,border:`1px solid rgba(255,107,43,0.2)`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>+ Add All to Shortlist</button>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {matched.map(s=>{
                const inShortlist=shortlist.has(s.id);
                return(
                  <Card key={s.id} accent={inShortlist?D.green:TIER[s.tier].color} style={{padding:"14px 20px",transition:"all 0.15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:38,height:38,borderRadius:11,background:`linear-gradient(135deg,${TIER[s.tier].color},${TIER[s.tier].color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,flexShrink:0}}>{s.avatar}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:D.t1}}>{s.name}</div>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:1}}>{s.roll} · {s.dept}-{s.section} · CGPA {s.cgpa}</div>
                      </div>
                      <div style={{display:"flex",gap:14,alignItems:"center"}}>
                        {[[s.easy+s.medium+s.hard,"LC",D.orange],[s.cfRating,"CF",D.blue],[s.score,"Score",TIER[s.tier].color]].map(([v,l,c])=>(
                          <div key={l} style={{textAlign:"center"}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:c}}>{v}</div>
                            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:D.t4}}>{l}</div>
                          </div>
                        ))}
                        <Chip color={TIER[s.tier].color} style={{fontSize:9}}>{TIER[s.tier].icon} {s.tier}</Chip>
                        <button onClick={()=>toggleShortlist(s.id)} style={{padding:"7px 14px",background:inShortlist?`rgba(0,232,122,0.12)`:`rgba(255,255,255,0.04)`,border:`1px solid ${inShortlist?D.green:D.b2}`,borderRadius:9,color:inShortlist?D.green:D.t3,fontSize:11,cursor:"pointer",transition:"all 0.15s",fontWeight:inShortlist?700:400}}>
                          {inShortlist?"✓ Shortlisted":"+ Shortlist"}
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab==="shortlist"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:D.t1}}>{slStudents.length} Students Shortlisted for {company}</span>
            {slStudents.length>0&&<button onClick={exportShortlist} style={{padding:"9px 18px",background:`rgba(0,232,122,0.1)`,border:`1px solid rgba(0,232,122,0.25)`,borderRadius:10,color:D.green,fontSize:12,cursor:"pointer",fontWeight:700}}>⬇ Export .txt</button>}
          </div>
          {slStudents.length===0?<Card style={{padding:60,textAlign:"center"}} accent={D.t4}><div style={{color:D.t4,fontSize:15}}>No students shortlisted yet</div><div style={{color:D.t4,fontSize:12,marginTop:8}}>Use the Filter tab to find and shortlist students</div></Card>:(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {slStudents.map((s,i)=>(
                <Card key={s.id} accent={D.green} style={{padding:"14px 20px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:D.green,minWidth:28}}>#{i+1}</span>
                    <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${TIER[s.tier].color},${TIER[s.tier].color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900,flexShrink:0}}>{s.avatar}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:D.t1}}>{s.name}</div>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:1}}>{s.roll} · {s.dept}-{s.section} · CGPA {s.cgpa} · Score {s.score}</div>
                    </div>
                    <Chip color={TIER[s.tier].color} style={{fontSize:9}}>{s.tier}</Chip>
                    <button onClick={()=>toggleShortlist(s.id)} style={{padding:"6px 12px",background:`rgba(255,61,90,0.08)`,border:`1px solid rgba(255,61,90,0.2)`,borderRadius:8,color:D.red,fontSize:11,cursor:"pointer"}}>✕ Remove</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   HOD DASHBOARD — UPGRADED
══════════════════════════════════════════ */
function HODDashboard({students,offers,currentUser,setView}){
  const active=students.filter(s=>s.status==="ACTIVE");
  const dept=currentUser?.dept||"CSE";
  const top5=[...active].sort((a,b)=>b.score-a.score).slice(0,5);
  const tierDist=["Elite","Advanced","Intermediate","Beginner"].map(t=>({name:t,value:active.filter(s=>s.tier===t).length,color:TIER[t].color}));
  const avgScore=active.length?Math.round(active.reduce((a,s)=>a+s.score,0)/active.length):0;
  const avgCGPA=active.length?(active.reduce((a,s)=>a+parseFloat(s.cgpa),0)/active.length).toFixed(1):0;

  /* Section breakdown */
  const sections=["A","B","C"];
  const sectionData=sections.map(sec=>{
    const ss=active.filter(s=>s.section===sec);
    return{sec,count:ss.length,avg:ss.length?Math.round(ss.reduce((a,s)=>a+s.score,0)/ss.length):0,ready:ss.filter(s=>s.placementReady).length};
  }).filter(s=>s.count>0);

  /* Score distribution */
  const scoreDist=[
    {range:"0-100",count:active.filter(s=>s.score<100).length,color:D.t4},
    {range:"100-250",count:active.filter(s=>s.score>=100&&s.score<250).length,color:D.green},
    {range:"250-400",count:active.filter(s=>s.score>=250&&s.score<400).length,color:D.violet},
    {range:"400+",count:active.filter(s=>s.score>=400).length,color:D.orange},
  ];

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,letterSpacing:-1,color:D.t1}}>{dept} Department</h1>
        <p style={{color:D.t4,fontSize:13,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{active.length} active students · Head of Department</p>
      </div>
      <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
        {[
          {label:"Active Students",value:active.length,color:D.green,sub:"In dept"},
          {label:"Elite Tier",value:active.filter(s=>s.tier==="Elite").length,color:D.orange,sub:"Score ≥ 400"},
          {label:"Placement Ready",value:active.filter(s=>s.placementReady).length,color:D.cyan,sub:"CF>1400, LC>100"},
          {label:"Avg Score",value:avgScore,color:D.violet,sub:"Composite"},
          {label:"Avg CGPA",value:avgCGPA,color:D.amber,sub:"Department"},
        ].map(kpi=>(
          <Card key={kpi.label} glow accent={kpi.color} style={{padding:"18px 18px"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:D.t4,marginBottom:8,letterSpacing:1}}>{kpi.label.toUpperCase()}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:900,color:kpi.color,lineHeight:1}}>{kpi.value}</div>
            {kpi.sub&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:kpi.color,marginTop:6,opacity:0.7}}>{kpi.sub}</div>}
          </Card>
        ))}
      </div>

      <div className="fade-up-1" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Tier Donut */}
        <Card style={{padding:24}}>
          <SectionLabel>Tier Distribution</SectionLabel>
          <div style={{display:"flex",gap:20,alignItems:"center"}}>
            <ResponsiveContainer width={150} height={150}>
              <PieChart><Pie data={tierDist} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={4}>{tierDist.map(e=><Cell key={e.name} fill={e.color}/>)}</Pie><Tooltip content={<CustomTooltip/>}/></PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {tierDist.map(t=>(
                <div key={t.name} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:3,background:t.color,boxShadow:`0 0 6px ${t.color}60`}}/>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t3,flex:1}}>{t.name}</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:t.color}}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        {/* Score Distribution */}
        <Card style={{padding:24}}>
          <SectionLabel accent={D.violet}>Score Distribution</SectionLabel>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={scoreDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="range" tick={{fill:D.t4,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}/>
              <YAxis tick={{fill:D.t4,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="count" name="Students" radius={[6,6,0,0]}>{scoreDist.map((e,i)=><Cell key={i} fill={e.color}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Section Breakdown */}
      <Card className="fade-up-2" style={{padding:24,marginBottom:16}} accent={D.blue}>
        <SectionLabel accent={D.blue}>Section Breakdown</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${sectionData.length},1fr)`,gap:16}}>
          {sectionData.map(s=>(
            <div key={s.sec} style={{padding:18,borderRadius:13,background:`rgba(61,142,255,0.06)`,border:`1px solid rgba(61,142,255,0.15)`,textAlign:"center"}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:D.blue}}>Section {s.sec}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginTop:4}}>{s.count} students</div>
              <div style={{marginTop:12,display:"flex",justify:"center",gap:16,justifyContent:"center"}}>
                <div><div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:D.violet}}>{s.avg}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>Avg Score</div></div>
                <div><div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:D.cyan}}>{s.ready}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>Ready</div></div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="fade-up-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card style={{padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <SectionLabel>Top 5 · {dept}</SectionLabel>
            <button onClick={()=>setView("students")} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.orange,background:"none",border:"none",cursor:"pointer"}}>View All →</button>
          </div>
          {top5.map((s,i)=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:i<top5.length-1?`1px solid ${D.b1}`:"none"}}>
              <div style={{width:24,height:24,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:900,background:i===0?`linear-gradient(135deg,${D.amber},#E6800A)`:`rgba(255,255,255,0.05)`,color:i===0?"#000":D.t2,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:D.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>{s.roll} · Sec {s.section}</div>
              </div>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:TIER[s.tier].color}}>{s.score}</span>
            </div>
          ))}
        </Card>
        <Card style={{padding:24,border:`1px solid rgba(255,61,90,0.15)`}} accent={D.red}>
          <SectionLabel accent={D.red}>⚠ Attention Needed</SectionLabel>
          <div style={{marginBottom:14}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginBottom:8}}>LOW STREAK (&lt; 5 days)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {active.filter(s=>s.streak<5).map(s=><div key={s.id} style={{padding:"3px 9px",borderRadius:8,background:`rgba(255,61,90,0.07)`,border:`1px solid rgba(255,61,90,0.15)`,fontSize:11,color:D.t2}}>{s.name.split(" ")[0]} <span style={{color:D.red,fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>{s.streak}d</span></div>)}
            </div>
          </div>
          <div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginBottom:8}}>UNVERIFIED HANDLES</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {active.filter(s=>!s.lcVerified||!s.ghVerified).slice(0,6).map(s=><div key={s.id} style={{padding:"3px 9px",borderRadius:8,background:`rgba(255,181,71,0.07)`,border:`1px solid rgba(255,181,71,0.15)`,fontSize:11,color:D.t2}}>{s.name.split(" ")[0]}</div>)}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   SECTION DASHBOARD — UPGRADED + MESSAGING
══════════════════════════════════════════ */
function SectionDashboard({students,setView,currentUser,onMessageStudent}){
  const active=students.filter(s=>s.status==="ACTIVE");
  const top=[...active].sort((a,b)=>b.score-a.score).slice(0,8);
  const avgScore=active.length?Math.round(active.reduce((a,s)=>a+s.score,0)/active.length):0;

  return(
    <div>
      <div style={{marginBottom:24,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>{currentUser?.dept||"CSE"} · Section {currentUser?.section||"A"}</h1>
          <p style={{color:D.t4,fontSize:13,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{active.length} students · Section Incharge</p>
        </div>
        <button onClick={()=>setView("students")} style={{padding:"10px 20px",background:`rgba(61,142,255,0.1)`,border:`1px solid rgba(61,142,255,0.25)`,borderRadius:11,color:D.blue,fontSize:13,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
          ✉ Message Students →
        </button>
      </div>

      <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[
          {label:"Total Active",value:active.length,color:D.green},
          {label:"Elite / Advanced",value:active.filter(s=>["Elite","Advanced"].includes(s.tier)).length,color:D.orange},
          {label:"Placement Ready",value:active.filter(s=>s.placementReady).length,color:D.cyan},
          {label:"Avg Score",value:avgScore,color:D.violet},
        ].map(k=>(
          <Card key={k.label} glow accent={k.color} style={{padding:"20px 22px"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginBottom:8,letterSpacing:1}}>{k.label.toUpperCase()}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:38,fontWeight:900,color:k.color,lineHeight:1}}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Alert strip */}
      {active.filter(s=>s.streak<5).length>0&&(
        <Card className="fade-up-1" style={{padding:"14px 20px",marginBottom:16,border:`1px solid rgba(255,61,90,0.18)`}} accent={D.red}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:700,color:D.red}}>⚠ Low Streak Students:</span>
            {active.filter(s=>s.streak<5).map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 10px",borderRadius:8,background:`rgba(255,61,90,0.07)`,border:`1px solid rgba(255,61,90,0.15)`}}>
                <span style={{fontSize:12,color:D.t2}}>{s.name.split(" ")[0]}</span>
                <span style={{fontSize:9,color:D.red,fontFamily:"'JetBrains Mono',monospace"}}>{s.streak}d</span>
                <button onClick={()=>onMessageStudent(s)} style={{fontSize:9,color:D.blue,background:"none",border:"none",cursor:"pointer",padding:0}}>✉</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Ranking Table */}
      <Card className="fade-up-2" style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${D.b1}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <SectionLabel>Section Rankings</SectionLabel>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>{active.length} STUDENTS</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${D.b1}`}}>
                {["Rank","Student","Roll","Score","Tier","LC","CF","Streak","Action"].map(h=>(
                  <th key={h} style={{padding:"10px 16px",textAlign:"left",fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,fontWeight:500,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top.map((s,i)=>(
                <tr key={s.id} style={{borderBottom:i<top.length-1?`1px solid ${D.b1}`:"none",transition:"background 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background=`rgba(255,255,255,0.02)`;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                  <td style={{padding:"11px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:i<3?D.amber:D.t4}}>#{i+1}</td>
                  <td style={{padding:"11px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:30,height:30,borderRadius:9,background:`linear-gradient(135deg,${TIER[s.tier].color},${TIER[s.tier].color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:900,flexShrink:0}}>{s.avatar}</div>
                      <div style={{fontSize:13,fontWeight:600,color:D.t1,whiteSpace:"nowrap"}}>{s.name}</div>
                    </div>
                  </td>
                  <td style={{padding:"11px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>{s.roll}</td>
                  <td style={{padding:"11px 16px",fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:TIER[s.tier].color}}>{s.score}</td>
                  <td style={{padding:"11px 16px"}}><Chip color={TIER[s.tier].color} style={{fontSize:9}}>{TIER[s.tier].icon} {s.tier}</Chip></td>
                  <td style={{padding:"11px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.orange}}>{s.easy+s.medium+s.hard}</td>
                  <td style={{padding:"11px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.blue}}>{s.cfRating}</td>
                  <td style={{padding:"11px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:s.streak<5?D.red:D.green}}>{s.streak}d</td>
                  <td style={{padding:"11px 16px"}}>
                    <button onClick={()=>onMessageStudent(s)} style={{padding:"5px 12px",background:`rgba(61,142,255,0.08)`,border:`1px solid rgba(61,142,255,0.2)`,borderRadius:8,color:D.blue,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>✉ Msg</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════
   STUDENT DASHBOARD — UPGRADED
══════════════════════════════════════════ */
function StudentDashboard({student,allStudents=[],verifyCode,showNotif,myDms=[],setView}){
  const total=student.easy+student.medium+student.hard;
  const ranks=getRanks(student,allStudents.length>0?allStudents:[student]);
  const earned=getEarnedBadges(student);
  const tierColor=TIER[student.tier]?.color||D.orange;
  const[selectedMood,setSelectedMood]=useState(null);
  const[moodDone,setMoodDone]=useState(false);
  const lcData=[{name:"Easy",value:student.easy,color:D.green},{name:"Medium",value:student.medium,color:D.amber},{name:"Hard",value:student.hard,color:D.red}];
  const radarData=student.codingRadar||[];
  const sgpaData=student.sgpaData||[];
  const activityBarData=student.weeklyActivity||[];
  const unreadDms=myDms.filter(d=>d.toId===student.id&&!d.read);

  return(
    <div>
      {/* Hero */}
      <Card className="fade-up" glow accent={tierColor} style={{padding:28,marginBottom:16,background:`linear-gradient(135deg,${tierColor}08 0%,${D.bg2} 100%)`}}>
        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <div style={{width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${tierColor},${tierColor}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:900,boxShadow:`0 0 32px ${tierColor}50`,flexShrink:0}}>{student.avatar}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:900,letterSpacing:-0.5,color:D.t1}}>{student.name}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginTop:4}}>{student.roll} · {student.dept}-{student.section} · CGPA {student.cgpa} · {student.batch}</div>
            <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
              <Chip color={tierColor}>{TIER[student.tier]?.icon} {student.tier} Tier</Chip>
              {student.placementReady&&<Chip color={D.green}>🚀 Placement Ready</Chip>}
              {unreadDms.length>0&&<Chip color={D.blue}>✉ {unreadDms.length} new message{unreadDms.length>1?"s":""}</Chip>}
            </div>
          </div>
          <div style={{display:"flex",gap:28}}>
            {[
              {label:"Score",val:student.score,color:tierColor},
              {label:"Streak",val:student.streak+"d",color:D.amber},
              {label:"LC Solved",val:total,color:D.orange},
              {label:"CF Rating",val:student.cfRating,color:D.blue},
            ].map(m=>(
              <div key={m.label} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,color:m.color}}>{m.val}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:D.t4,marginTop:2}}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Rank Row */}
      <div className="fade-up-1" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
        {[
          {label:"College Rank",rank:ranks.college.rank,total:ranks.college.total,color:D.orange},
          {label:"Dept Rank",rank:ranks.dept.rank,total:ranks.dept.total,color:D.violet},
          {label:"Section Rank",rank:ranks.section.rank,total:ranks.section.total,color:D.blue},
        ].map(r=>(
          <Card key={r.label} glow accent={r.color} style={{padding:"16px 20px",textAlign:"center"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,letterSpacing:1}}>{r.label.toUpperCase()}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:900,color:r.color,marginTop:4}}>#{r.rank}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>of {r.total}</div>
          </Card>
        ))}
      </div>

      <div className="fade-up-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:16}}>
        {/* Difficulty Ring */}
        <Card style={{padding:20}}>
          <SectionLabel>LC Difficulty</SectionLabel>
          <div style={{position:"relative",display:"flex",justifyContent:"center"}}>
            <ResponsiveContainer width={150} height={150}>
              <PieChart><Pie data={lcData} cx="50%" cy="50%" innerRadius={44} outerRadius={68} dataKey="value" paddingAngle={3}>{lcData.map(d=><Cell key={d.name} fill={d.color}/>)}</Pie></PieChart>
            </ResponsiveContainer>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:D.t1}}>{total}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:D.t4}}>SOLVED</div>
            </div>
          </div>
          <div style={{display:"flex",gap:12,marginTop:8,justifyContent:"center"}}>
            {lcData.map(d=><div key={d.name} style={{textAlign:"center"}}><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:d.color}}>{d.value}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>{d.name}</div></div>)}
          </div>
        </Card>

        {/* Skill Radar */}
        <Card style={{padding:20}}>
          <SectionLabel accent={D.violet}>Skill Radar</SectionLabel>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
              <PolarGrid stroke={`rgba(124,63,255,0.2)`}/>
              <PolarAngleAxis dataKey="subject" tick={{fill:D.t4,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}/>
              <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false}/>
              <Radar name="Score" dataKey="A" stroke={D.violet} fill={D.violet} fillOpacity={0.18} strokeWidth={2}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        {/* Score Breakdown */}
        <Card style={{padding:20}}>
          <SectionLabel accent={D.orange}>Score Breakdown</SectionLabel>
          {[["LC",student.composite.lc_score,D.orange],["CF",student.composite.cf_score,D.blue],["CC",student.composite.cc_score,D.amber],["GH",student.composite.gh_score,D.violet],["CW",student.composite.cw_score,D.cyan]].map(([label,pts,color])=>{
            const maxPts=Math.max(student.composite.lc_score,student.composite.cf_score,student.composite.cc_score,student.composite.gh_score,student.composite.cw_score,1);
            return(
              <div key={label} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:D.t4,marginBottom:5}}><span>{label}</span><span style={{color}}>{pts}pts</span></div>
                <div style={{height:4,background:`rgba(255,255,255,0.05)`,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(pts/maxPts)*100}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:4}}/></div>
              </div>
            );
          })}
          <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${D.b1}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>TOTAL</span><span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:tierColor}}>{student.score}</span></div>
        </Card>

        {/* Mood + DM Preview */}
        <Card style={{padding:20}} accent={D.amber}>
          {!moodDone?(
            <>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,letterSpacing:2,marginBottom:12}}>DAILY MOOD</div>
              <div style={{fontSize:12,color:D.t3,marginBottom:12}}>How are you feeling today?</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {MOODS.map(m=><button key={m} onClick={()=>{setSelectedMood(m);setTimeout(()=>setMoodDone(true),300);}} style={{fontSize:20,background:selectedMood===m?`rgba(255,181,71,0.15)`:`rgba(255,255,255,0.03)`,border:`1px solid ${selectedMood===m?D.amber:D.b1}`,borderRadius:10,padding:"5px 7px",cursor:"pointer"}}>{m}</button>)}
              </div>
            </>
          ):(
            <div style={{textAlign:"center",padding:"10px 0"}}><div style={{fontSize:36}}>{selectedMood}</div><div style={{color:D.green,fontSize:12,marginTop:8,fontFamily:"'JetBrains Mono',monospace"}}>Logged ✓</div></div>
          )}
          {unreadDms.length>0&&(
            <div onClick={()=>setView("community")} style={{marginTop:14,padding:"10px 12px",borderRadius:10,background:`rgba(61,142,255,0.06)`,border:`1px solid rgba(61,142,255,0.2)`,cursor:"pointer"}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.blue,marginBottom:6}}>INBOX</div>
              {unreadDms.slice(0,2).map(d=><div key={d.id} style={{fontSize:11,color:D.t2,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✉ {d.fromName}: {d.msg}</div>)}
              <div style={{fontSize:10,color:D.blue,marginTop:4}}>View all messages →</div>
            </div>
          )}
        </Card>
      </div>

      {/* SGPA + Weekly */}
      <div className="fade-up-3" style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:16,marginBottom:16}}>
        <Card style={{padding:22}}>
          <SectionLabel accent={D.green}>Academic Trajectory — SGPA</SectionLabel>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={sgpaData} margin={{top:5,right:5,bottom:0,left:-20}}>
              <defs><linearGradient id="sgpaG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={D.green} stopOpacity={0.25}/><stop offset="95%" stopColor={D.green} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="sem" stroke={D.t4} tick={{fill:D.t4,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}/>
              <YAxis domain={[7,10]} stroke={D.t4} tick={{fill:D.t4,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="sgpa" name="SGPA" stroke={D.green} strokeWidth={2.5} fill="url(#sgpaG)" dot={{fill:D.green,r:4,strokeWidth:0}} activeDot={{r:6,fill:D.green}}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{padding:22}}>
          <SectionLabel accent={D.violet}>Weekly Coding (hrs)</SectionLabel>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={activityBarData} margin={{top:5,right:5,bottom:0,left:-25}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="day" stroke={D.t4} tick={{fill:D.t4,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}/>
              <YAxis stroke={D.t4} tick={{fill:D.t4,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="hours" name="Hours" radius={[6,6,0,0]}>{activityBarData.map((e,i)=><Cell key={i} fill={e.hours>6?D.red:e.hours>4?D.orange:D.blue}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Badges */}
      {earned.length>0&&(
        <Card className="fade-up-4" style={{padding:"14px 20px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:D.t1}}>Earned Badges</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>{earned.length}/{BADGES.length}</span>
          </div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {earned.map(b=><div key={b.id} title={b.desc} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,background:`${b.color}14`,border:`1px solid ${b.color}35`,cursor:"default"}}><span style={{fontSize:13}}>{b.icon}</span><span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,fontWeight:600,color:b.color}}>{b.label}</span></div>)}
          </div>
        </Card>
      )}

      {/* Platform Drives + Heatmap */}
      <Card className="fade-up-4" style={{padding:22,marginBottom:16}} accent={D.amber}>
        <SectionLabel accent={D.amber}>Active Placement Drives</SectionLabel>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {DRIVES.map((d,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",borderRadius:14,background:`rgba(255,255,255,0.02)`,border:`1px solid ${D.b1}`,cursor:"pointer",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=`rgba(255,181,71,0.3)`;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=D.b1;}}>
              <div style={{width:42,height:42,borderRadius:12,background:D.bg4,border:`1px solid ${D.b2}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:D.orange,fontSize:16,fontFamily:"'Syne',sans-serif"}}>{d.logo}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,color:D.t1,fontSize:14}}>{d.company}</div><div style={{color:D.t4,fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>{d.role}</div></div>
              <div style={{textAlign:"right"}}><div style={{color:D.green,fontWeight:800,fontSize:15,fontFamily:"'Syne',sans-serif"}}>{d.pkg}</div><div style={{color:D.t4,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>Deadline: {d.deadline}</div></div>
              <Chip color={d.status==="open"?D.green:D.red}>{d.status.toUpperCase()}</Chip>
            </div>
          ))}
        </div>
      </Card>
      <MonthlyHeatmap monthlyLogs={student.monthlyLogs} compact/>
    </div>
  );
}

/* ══════════════════════════════════════════
   COMMUNITY — Upgraded with DM System
══════════════════════════════════════════ */
function Community({messages,setMessages,chatInput,setChatInput,activeUser,allStudents=[],dms=[],sendDM,role,setDmsRead}){
  const[tab,setTab]=useState("hall"); // "hall" | "dms"
  const[dmTarget,setDmTarget]=useState(null);
  const[dmInput,setDmInput]=useState("");
  const bottomRef=useRef(null);
  const dmBottomRef=useRef(null);

  useEffect(()=>{if(tab==="hall")bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,tab]);
  useEffect(()=>{if(tab==="dms")dmBottomRef.current?.scrollIntoView({behavior:"smooth"});},[dms,dmTarget,tab]);

  const sendCommunity=()=>{
    if(!chatInput.trim())return;
    setMessages(p=>[...p,{id:Date.now(),user:activeUser?.name||"You",msg:chatInput,ts:"just now",avatar:activeUser?.avatar||"??"}]);
    setChatInput("");
  };

  const sendDMMsg=()=>{
    if(!dmInput.trim()||!dmTarget)return;
    sendDM(dmTarget,dmInput);
    setDmInput("");
  };

  /* Group DMs into conversations */
  const getConversationWith=(partner)=>{
    return dms.filter(d=>
      (d.fromId===activeUser?.id&&d.toId===partner.id)||
      (d.toId===activeUser?.id&&(d.fromId===partner.id||d.fromId===partner.email))
    ).sort((a,b)=>a.id-b.id);
  };

  /* All conversation partners */
  const dmPartners=useMemo(()=>{
    if(!activeUser)return allStudents;
    const inDMs=new Set();
    dms.forEach(d=>{
      if(d.toId===activeUser.id)inDMs.add(d.fromId);
      if(d.fromId===activeUser.id)inDMs.add(d.toId);
    });
    /* Merge: all students + anyone who messaged me */
    return allStudents;
  },[allStudents,dms,activeUser]);

  const getUnreadCount=(partner)=>{
    return dms.filter(d=>d.toId===activeUser?.id&&(d.fromId===partner.id||d.fromId===partner.email)&&!d.read).length;
  };

  /* For non-students (admin/hod/incharge), only show hall */
  const showDMs=role==="student";

  return(
    <div>
      <div style={{marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Community</h1>
          <p style={{color:D.t4,fontSize:12,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>Ephemeral · Messages auto-delete after 48h via pg_cron</p>
        </div>
        {showDMs&&(
          <div style={{display:"flex",gap:8}}>
            {[{id:"hall",label:"◉ Hall"},{id:"dms",label:"✉ Messages"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"9px 18px",background:tab===t.id?`rgba(124,63,255,0.12)`:`rgba(255,255,255,0.04)`,border:`1px solid ${tab===t.id?D.violet:D.b1}`,borderRadius:10,color:tab===t.id?D.violet:D.t3,fontSize:13,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:tab===t.id?700:400}}>{t.label}</button>
            ))}
          </div>
        )}
      </div>

      {tab==="hall"&&(
        <Card style={{padding:0,display:"flex",flexDirection:"column",maxHeight:560}} accent={D.violet}>
          <div style={{flex:1,overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:14}}>
            {messages.map(m=>(
              <div key={m.id} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${D.violet},${D.violet}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:800,flexShrink:0}}>{m.avatar}</div>
                <div>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:13,fontWeight:700,color:D.t1}}>{m.user}</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>{m.ts}</span>
                  </div>
                  <div style={{padding:"10px 14px",borderRadius:"0 14px 14px 14px",background:`rgba(255,255,255,0.05)`,border:`1px solid ${D.b1}`,fontSize:13,color:D.t2,lineHeight:1.6}}>{m.msg}</div>
                </div>
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>
          <div style={{padding:"14px 20px",borderTop:`1px solid ${D.b1}`,display:"flex",gap:10}}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendCommunity()} placeholder="Message the community… (ephemeral)"
              style={{flex:1,padding:"11px 16px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b2}`,borderRadius:12,color:D.t1,fontSize:13,outline:"none"}}/>
            <button onClick={sendCommunity} style={{padding:"11px 22px",background:`linear-gradient(135deg,${D.violet},#5500CC)`,border:"none",borderRadius:12,color:"#fff",fontWeight:700,cursor:"pointer",boxShadow:`0 4px 16px rgba(124,63,255,0.35)`}}>Send</button>
          </div>
        </Card>
      )}

      {tab==="dms"&&showDMs&&(
        <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:16,height:560}}>
          {/* Contact List */}
          <Card style={{padding:0,overflow:"hidden",display:"flex",flexDirection:"column"}} accent={D.blue}>
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${D.b1}`}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.blue,letterSpacing:1}}>CONTACTS · {dmPartners.length}</div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
              {dmPartners.length===0&&<div style={{color:D.t4,fontSize:12,textAlign:"center",padding:20}}>No contacts</div>}
              {dmPartners.map(partner=>{
                const unread=getUnreadCount(partner);
                const isSelected=dmTarget?.id===partner.id;
                const lastDm=getConversationWith(partner).slice(-1)[0];
                return(
                  <button key={partner.id} onClick={()=>{setDmTarget(partner);if(setDmsRead)dms.filter(d=>d.toId===activeUser?.id&&(d.fromId===partner.id||d.fromId===partner.email)).forEach(d=>setDmsRead(d.id));}} style={{
                    width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:11,border:"none",cursor:"pointer",
                    background:isSelected?`rgba(61,142,255,0.12)`:`transparent`,color:isSelected?D.blue:D.t3,
                    textAlign:"left",transition:"all 0.15s",marginBottom:2,
                  }} onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background=`rgba(255,255,255,0.04)`;}} onMouseLeave={e=>{if(!isSelected)e.currentTarget.style.background="transparent";}}>
                    <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${TIER[partner.tier]?.color||D.violet},${TIER[partner.tier]?.color||D.violet}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:900,flexShrink:0}}>{partner.avatar}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:isSelected?700:500,color:isSelected?D.blue:D.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{partner.name}</div>
                      {lastDm&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{lastDm.msg}</div>}
                    </div>
                    {unread>0&&<div style={{minWidth:20,height:20,borderRadius:10,background:D.blue,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{unread}</div>}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Conversation Panel */}
          {dmTarget?(
            <Card style={{padding:0,display:"flex",flexDirection:"column",overflow:"hidden"}} accent={D.violet}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${D.b1}`,display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${TIER[dmTarget.tier]?.color||D.violet},${TIER[dmTarget.tier]?.color||D.violet}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:900}}>{dmTarget.avatar}</div>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:D.t1}}>{dmTarget.name}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>{dmTarget.roll} · {dmTarget.dept}</div>
                </div>
                <Chip color={TIER[dmTarget.tier]?.color||D.violet} style={{marginLeft:"auto",fontSize:9}}>{dmTarget.tier}</Chip>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
                {getConversationWith(dmTarget).length===0&&(
                  <div style={{textAlign:"center",color:D.t4,fontSize:13,marginTop:60}}>No messages yet. Say hello! 👋</div>
                )}
                {getConversationWith(dmTarget).map(msg=>{
                  const isMe=msg.fromId===activeUser?.id||msg.fromId===activeUser?.email;
                  return(
                    <div key={msg.id} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",gap:10,alignItems:"flex-end"}}>
                      {!isMe&&<div style={{width:30,height:30,borderRadius:9,background:`linear-gradient(135deg,${D.violet},${D.violet}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:900,flexShrink:0}}>{msg.fromAvatar}</div>}
                      <div style={{maxWidth:"70%"}}>
                        {!isMe&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginBottom:4}}>{msg.fromName}</div>}
                        <div style={{
                          padding:"11px 16px",
                          borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",
                          background:isMe?`linear-gradient(135deg,${D.orange},#FF3D00)`:`rgba(255,255,255,0.06)`,
                          border:!isMe?`1px solid ${D.b2}`:"none",
                          fontSize:13,lineHeight:1.65,color:D.t1,
                          boxShadow:isMe?`0 4px 16px rgba(255,107,43,0.25)`:"none",
                        }}>{msg.msg}</div>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:4,textAlign:isMe?"right":"left"}}>{msg.ts}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={dmBottomRef}/>
              </div>
              <div style={{padding:"12px 16px",borderTop:`1px solid ${D.b1}`,display:"flex",gap:10}}>
                <input value={dmInput} onChange={e=>setDmInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendDMMsg()} placeholder={`Message ${dmTarget.name}…`}
                  style={{flex:1,padding:"11px 16px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b2}`,borderRadius:12,color:D.t1,fontSize:13,outline:"none"}}/>
                <button onClick={sendDMMsg} style={{padding:"11px 22px",background:`linear-gradient(135deg,${D.orange},#FF3D00)`,border:"none",borderRadius:12,color:"#fff",fontWeight:700,cursor:"pointer",boxShadow:`0 4px 16px rgba(255,107,43,0.35)`}}>Send</button>
              </div>
            </Card>
          ):(
            <Card style={{display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}} accent={D.t4}>
              <div style={{fontSize:48,opacity:0.3}}>✉</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:D.t4}}>Select a contact to start chatting</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t4}}>Your messages are private & encrypted</div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ──── Remaining components (Leaderboard, OffersManager, StudentProfile, StudentsPage, ApprovalQueue, AuditLog, EditProfiles) ──── */

function Leaderboard({students,activeStudent}){
  const sorted=[...students].sort((a,b)=>b.score-a.score);
  return(
    <div>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1,marginBottom:24}}>Leaderboard</h1>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {sorted.map((s,i)=>{
          const isMe=s.id===activeStudent?.id;
          const tierColor=TIER[s.tier]?.color||D.orange;
          return(
            <Card key={s.id} accent={isMe?D.orange:tierColor} glow={isMe} style={{padding:"14px 20px",background:isMe?`rgba(255,107,43,0.07)`:D.bg2}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:36,height:36,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,flexShrink:0,background:i===0?"linear-gradient(135deg,#FFD700,#E6800A)":i===1?"linear-gradient(135deg,#C0C0C0,#909090)":i===2?"linear-gradient(135deg,#CD7F32,#8B4513)":`rgba(255,255,255,0.05)`,color:i<3?"#000":D.t3}}>
                  {i<3?["🥇","🥈","🥉"][i]:i+1}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:isMe?800:600,color:isMe?D.orange:D.t1}}>{s.name}{isMe&&" (You)"}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:1}}>{s.roll} · {s.dept}</div>
                </div>
                <div style={{display:"flex",gap:16,alignItems:"center"}}>
                  {[[s.easy+s.medium+s.hard,"LC",D.orange],[s.cfRating,"CF",D.blue],[s.streak+"d","🔥",D.amber]].map(([v,l,c])=>(
                    <div key={l} style={{textAlign:"center"}}><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:c}}>{v}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:D.t4}}>{l}</div></div>
                  ))}
                  <Chip color={tierColor} style={{fontSize:9}}>{TIER[s.tier]?.icon} {s.tier}</Chip>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:tierColor,minWidth:56,textAlign:"right"}}>{s.score}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function OffersManager({offers,showNotif,isStudent=false}){
  return(
    <div>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1,marginBottom:24}}>{isStudent?"My Offers":"Offers Tracker"}</h1>
      {offers.length===0&&<Card style={{padding:40,textAlign:"center"}} accent={D.t4}><div style={{color:D.t4,fontSize:15}}>No offers yet</div></Card>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {offers.map(o=>(
          <Card key={o.id} accent={o.status==="ACCEPTED"?D.green:o.status==="PENDING"?D.amber:D.red} style={{padding:"18px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{width:48,height:48,borderRadius:14,background:D.bg4,border:`1px solid ${D.b2}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:D.orange,fontSize:18,fontFamily:"'Syne',sans-serif",flexShrink:0}}>{o.company[0]}</div>
              <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:D.t1}}>{o.company}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginTop:2}}>{o.student} · {o.date}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:D.green}}>{o.package}</div></div>
              <Chip color={o.status==="ACCEPTED"?D.green:o.status==="PENDING"?D.amber:D.red}>{o.status}</Chip>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StudentProfile({student,verifyCode,showNotif}){
  const tierColor=TIER[student.tier]?.color||D.orange;
  const total=student.easy+student.medium+student.hard;
  return(
    <div>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1,marginBottom:24}}>My Profile</h1>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.5fr",gap:20}}>
        <Card style={{padding:28}} accent={tierColor}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{width:80,height:80,borderRadius:22,background:`linear-gradient(135deg,${tierColor},${tierColor}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,margin:"0 auto 16px",boxShadow:`0 0 32px ${tierColor}50`}}>{student.avatar}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:D.t1}}>{student.name}</div>
            <Chip color={tierColor} style={{marginTop:8}}>{TIER[student.tier]?.icon} {student.tier}</Chip>
          </div>
          {[["Roll Number",student.roll],["Department",student.dept],["Section",student.section],["Batch",student.batch],["CGPA",student.cgpa],["Language",student.language]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${D.b1}`}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>{l.toUpperCase()}</span>
              <span style={{fontSize:13,fontWeight:600,color:D.t2}}>{v}</span>
            </div>
          ))}
          <div style={{marginTop:16,padding:"12px 14px",borderRadius:12,background:`rgba(255,255,255,0.03)`,border:`1px solid ${D.b1}`}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginBottom:6,letterSpacing:1}}>VERIFY CODE</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:tierColor,letterSpacing:2}}>{verifyCode}</div>
          </div>
        </Card>
        <Card style={{padding:28}} accent={D.violet}>
          <SectionLabel accent={D.violet}>Platform Handles</SectionLabel>
          {[
            {name:"LeetCode",handle:student.leetcode,verified:student.lcVerified,color:D.orange,val:`${total} solved`},
            {name:"GitHub",handle:student.github,verified:student.ghVerified,color:D.violet,val:`${student.ghCommits} commits · ${student.ghPRs} PRs`},
            {name:"Codeforces",handle:student.codeforces,verified:true,color:D.blue,val:`${student.cfRating} rating`},
            {name:"CodeChef",handle:student.codechef,verified:false,color:D.amber,val:`${"★".repeat(Math.min(student.ccStars,7))} (${student.ccStars}★)`},
          ].map(p=>(
            <div key={p.name} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",borderRadius:12,background:`rgba(255,255,255,0.03)`,border:`1px solid ${D.b1}`,marginBottom:10}}>
              <div style={{width:40,height:40,borderRadius:11,background:`${p.color}14`,border:`1px solid ${p.color}30`,display:"flex",alignItems:"center",justifyContent:"center",color:p.color,fontSize:18,flexShrink:0}}>●</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:D.t1}}>{p.name}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginTop:2}}>@{p.handle} · {p.val}</div>
              </div>
              <Chip color={p.verified?D.green:D.red}>{p.verified?"✓ Verified":"✗ Unverified"}</Chip>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function StudentsPage({students,setView,setActiveStudent,readOnly=false,onMessageStudent}){
  const[search,setSearch]=useState("");
  const[filterTier,setFilterTier]=useState("All");
  const[filterDept,setFilterDept]=useState("All");
  const filtered=students.filter(s=>{
    const matchSearch=!search||s.name.toLowerCase().includes(search.toLowerCase())||s.roll.toLowerCase().includes(search.toLowerCase());
    const matchTier=filterTier==="All"||s.tier===filterTier;
    const matchDept=filterDept==="All"||s.dept===filterDept;
    return matchSearch&&matchTier&&matchDept;
  });
  return(
    <div>
      <div style={{marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><h1 style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:900,letterSpacing:-1,color:D.t1}}>Students</h1><p style={{color:D.t4,fontSize:12,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>{filtered.length} students shown</p></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name / roll…" style={{padding:"10px 16px",background:D.bg2,border:`1px solid ${D.b1}`,borderRadius:10,color:D.t1,fontSize:13,outline:"none",width:220}}/>
          <select value={filterTier} onChange={e=>setFilterTier(e.target.value)} style={{padding:"10px 14px",background:D.bg2,border:`1px solid ${D.b1}`,borderRadius:10,color:D.t1,fontSize:12,outline:"none"}}>
            {["All","Elite","Advanced","Intermediate","Beginner"].map(t=><option key={t}>{t}</option>)}
          </select>
          <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{padding:"10px 14px",background:D.bg2,border:`1px solid ${D.b1}`,borderRadius:10,color:D.t1,fontSize:12,outline:"none"}}>
            {["All",...DEPTS].map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {filtered.map(s=>(
          <Card key={s.id} accent={TIER[s.tier]?.color||D.orange} style={{padding:20,transition:"all 0.2s",position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${TIER[s.tier].color},${TIER[s.tier].color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900,flexShrink:0}}>{s.avatar}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:D.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:2}}>{s.roll} · {s.dept}</div>
              </div>
              <Chip color={TIER[s.tier].color} style={{fontSize:9}}>{TIER[s.tier].icon} {s.tier}</Chip>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:onMessageStudent?10:0}}>
              {[["Score",s.score,TIER[s.tier].color],["LC",s.easy+s.medium+s.hard,D.orange],["CF",s.cfRating,D.blue]].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center",padding:"8px 4px",background:`rgba(255,255,255,0.03)`,borderRadius:10,border:`1px solid ${D.b1}`}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:c}}>{v}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:D.t4,marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
            {onMessageStudent&&(
              <button onClick={()=>onMessageStudent(s)} style={{width:"100%",padding:"8px",background:`rgba(61,142,255,0.08)`,border:`1px solid rgba(61,142,255,0.2)`,borderRadius:9,color:D.blue,fontSize:12,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>✉ Send Message</button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ApprovalQueue({students,handleApprove,handleReject,showNotif}){
  const pending=students.filter(s=>s.status==="PENDING");
  return(
    <div>
      <div style={{marginBottom:28}}><h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Approval Queue</h1><p style={{color:D.t4,fontSize:12,fontFamily:"'JetBrains Mono',monospace",marginTop:4}}>{pending.length} pending · Supabase Realtime notifications active</p></div>
      {pending.length===0?<Card style={{padding:60,textAlign:"center"}} accent={D.green}><div style={{fontSize:40,marginBottom:16}}>✦</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:D.green}}>All Clear</div><div style={{color:D.t4,fontSize:14,marginTop:8}}>No pending registrations</div></Card>:(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {pending.map(s=>(
            <Card key={s.id} accent={D.amber} style={{padding:24,border:`1px solid rgba(255,181,71,0.15)`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${D.amber},#D97706)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:900}}>{s.avatar}</div>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:D.t1}}>{s.name}</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t4,marginTop:4}}>{s.roll} · {s.dept}-{s.section} · CGPA: {s.cgpa}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>handleApprove(s.id)} style={{padding:"10px 20px",background:`rgba(0,232,122,0.12)`,border:`1px solid rgba(0,232,122,0.3)`,borderRadius:10,color:D.green,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>Activate ✓</button>
                  <button onClick={()=>handleReject(s.id)} style={{padding:"10px 20px",background:`rgba(255,61,90,0.1)`,border:`1px solid rgba(255,61,90,0.25)`,borderRadius:10,color:D.red,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>Reject ✕</button>
                </div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
                {[["LeetCode",s.leetcode,D.orange],["GitHub",s.github,D.violet],["Codeforces",s.codeforces,D.blue],["CodeChef",s.codechef,D.amber]].filter(([,v])=>v).map(([p,v,c])=>(
                  <div key={p} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,padding:"4px 10px",background:`${c}12`,border:`1px solid ${c}20`,borderRadius:6,color:c}}>{p}: {v}</div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditLog({logs}){
  return(
    <div>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1,marginBottom:24}}>Audit Trail</h1>
      <Card style={{padding:0,overflow:"hidden"}} accent={D.violet}>
        {logs.map((l,i)=>(
          <div key={l.id} style={{display:"flex",alignItems:"center",gap:16,padding:"16px 24px",borderBottom:i<logs.length-1?`1px solid ${D.b1}`:"none"}}>
            <div style={{width:36,height:36,borderRadius:10,background:`rgba(124,63,255,0.12)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
              {l.action==="ACTIVATED"?"✅":l.action==="REJECTED"?"❌":l.action==="HANDLE_VERIFIED"?"🔗":l.action==="MSG_SENT"?"✉":"⚙️"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:D.t1}}>{l.target}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginTop:2}}>{l.action} · {l.by}</div>
            </div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>{l.ts}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function EditProfiles({students,setStudents,showNotif}){
  const[search,setSearch]=useState("");
  const[editing,setEditing]=useState(null);
  const[form,setForm]=useState({});
  const filtered=students.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase())||s.roll.toLowerCase().includes(search.toLowerCase()));
  const startEdit=(s)=>{setEditing(s.id);setForm({...s});};
  const saveEdit=()=>{
    const score=computeScore({...form,easy:+form.easy,medium:+form.medium,hard:+form.hard,cfRating:+form.cfRating,ccStars:+form.ccStars,ghCommits:+form.ghCommits,ghPRs:+form.ghPRs,cwProblems:+form.cwProblems,streak:+form.streak});
    setStudents(p=>p.map(s=>s.id===editing?{...s,...form,easy:+form.easy,medium:+form.medium,hard:+form.hard,cfRating:+form.cfRating,ccStars:+form.ccStars,ghCommits:+form.ghCommits,ghPRs:+form.ghPRs,cwProblems:+form.cwProblems,streak:+form.streak,score:score.total,tier:score.tier,placementReady:score.ready,composite:score}:s));
    setEditing(null);showNotif("✅ Profile updated & scores recomputed","success");
  };
  if(editing){
    const s=students.find(s=>s.id===editing);
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
          <button onClick={()=>setEditing(null)} style={{background:"none",border:`1px solid ${D.b1}`,borderRadius:10,color:D.t3,fontSize:13,padding:"8px 16px",cursor:"pointer"}}>← Back</button>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:900,color:D.t1}}>Editing: {s?.name}</h1>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          {[{title:"Basic Info",fields:[{k:"name",l:"Name"},{k:"roll",l:"Roll No"},{k:"cgpa",l:"CGPA"},{k:"dept",l:"Dept"},{k:"section",l:"Section"},{k:"batch",l:"Batch"}]},{title:"Platform Stats",fields:[{k:"easy",l:"LC Easy"},{k:"medium",l:"LC Medium"},{k:"hard",l:"LC Hard"},{k:"cfRating",l:"CF Rating"},{k:"ghCommits",l:"GH Commits"},{k:"streak",l:"Streak Days"}]}].map(panel=>(
            <Card key={panel.title} style={{padding:24}} accent={D.orange}>
              <SectionLabel>{panel.title}</SectionLabel>
              {panel.fields.map(f=>(
                <div key={f.k} style={{marginBottom:14}}>
                  <label style={{display:"block",fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,letterSpacing:1,marginBottom:6}}>{f.l.toUpperCase()}</label>
                  <input value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={{width:"100%",padding:"11px 14px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b1}`,borderRadius:10,color:D.t1,fontSize:13,outline:"none"}}/>
                </div>
              ))}
            </Card>
          ))}
        </div>
        <button onClick={saveEdit} style={{marginTop:20,padding:"14px 40px",background:`linear-gradient(135deg,${D.orange},#FF3D00)`,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:`0 0 24px rgba(255,107,43,0.4)`}}>Save & Recompute Scores</button>
      </div>
    );
  }
  return(
    <div>
      <div style={{marginBottom:20}}><h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Edit Profiles</h1><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…" style={{marginTop:14,padding:"11px 16px",background:D.bg2,border:`1px solid ${D.b1}`,borderRadius:10,color:D.t1,fontSize:13,outline:"none",width:280}}/></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {filtered.map(s=>(
          <Card key={s.id} accent={D.orange} style={{padding:18,cursor:"pointer",transition:"all 0.18s"}} onClick={()=>startEdit(s)}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:42,height:42,borderRadius:12,background:`linear-gradient(135deg,${TIER[s.tier].color},${TIER[s.tier].color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,flexShrink:0}}>{s.avatar}</div>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:D.t1}}>{s.name}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:2}}>{s.roll} · {s.dept}</div></div>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:TIER[s.tier].color}}>{s.score}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PLATFORMS HUB — Deep dives per platform
══════════════════════════════════════════════════════════════ */
function PlatformsHub({student}){
  const[tab,setTab]=useState("leetcode");
  const total=student.easy+student.medium+student.hard;

  const TABS=[
    {id:"leetcode",label:"LeetCode",color:"#FF6B2B",icon:"⚡"},
    {id:"github",label:"GitHub",color:"#7C3FFF",icon:"🐙"},
    {id:"codeforces",label:"Codeforces",color:"#3D8EFF",icon:"⚔️"},
    {id:"codechef",label:"CodeChef",color:"#FFB547",icon:"👨‍🍳"},
    {id:"others",label:"Others",color:"#00E87A",icon:"◈"},
  ];

  /* Fake recent submissions for LC */
  const recentLC=[
    {title:"Two Sum",diff:"Easy",status:"Accepted",lang:student.language,ts:"2h ago"},
    {title:"LRU Cache",diff:"Medium",status:"Accepted",lang:student.language,ts:"1d ago"},
    {title:"Merge K Sorted",diff:"Hard",status:"Accepted",lang:student.language,ts:"2d ago"},
    {title:"Word Ladder",diff:"Hard",status:"WA",lang:student.language,ts:"3d ago"},
    {title:"3Sum",diff:"Medium",status:"Accepted",lang:student.language,ts:"4d ago"},
    {title:"Binary Tree Max Path",diff:"Hard",status:"Accepted",lang:student.language,ts:"5d ago"},
  ];
  const lcTopics=[
    {name:"Arrays",solved:Math.floor(total*0.22),color:D.orange},
    {name:"DP",solved:Math.floor(total*0.15),color:D.violet},
    {name:"Graphs",solved:Math.floor(total*0.13),color:D.blue},
    {name:"Trees",solved:Math.floor(total*0.18),color:D.green},
    {name:"Strings",solved:Math.floor(total*0.12),color:D.amber},
    {name:"Backtrack",solved:Math.floor(total*0.08),color:D.red},
    {name:"Binary Search",solved:Math.floor(total*0.07),color:D.cyan},
    {name:"Greedy",solved:Math.floor(total*0.05),color:D.t3},
  ];

  /* Fake CF contest history */
  const cfContests=Array.from({length:12},(_,i)=>({
    round:`Round ${i+1}`,
    rank:Math.floor(Math.random()*2000)+100,
    delta:Math.floor(Math.random()*80)-30,
    rating:student.cfRating-Math.floor(Math.random()*200)+100,
  }));
  const cfTagData=[
    {subject:"DP",A:Math.floor(Math.random()*80)+20},
    {subject:"Graphs",A:Math.floor(Math.random()*70)+20},
    {subject:"Math",A:Math.floor(Math.random()*90)+10},
    {subject:"Greedy",A:Math.floor(Math.random()*75)+20},
    {subject:"Strings",A:Math.floor(Math.random()*65)+25},
    {subject:"Trees",A:Math.floor(Math.random()*70)+20},
  ];

  /* GH language distribution */
  const langs=[
    {name:student.language,pct:42,color:D.orange},
    {name:"HTML/CSS",pct:18,color:D.blue},
    {name:"TypeScript",pct:15,color:D.violet},
    {name:"Shell",pct:10,color:D.green},
    {name:"Other",pct:15,color:D.t4},
  ];
  const ghRepos=[
    {name:"competitive-solutions",stars:Math.floor(Math.random()*80)+5,forks:Math.floor(Math.random()*20),lang:student.language,updated:"3d ago"},
    {name:"portfolio-v2",stars:Math.floor(Math.random()*40)+2,forks:Math.floor(Math.random()*10),lang:"HTML",updated:"1w ago"},
    {name:"ml-experiments",stars:Math.floor(Math.random()*30),forks:Math.floor(Math.random()*8),lang:"Python",updated:"2w ago"},
    {name:"leetcode-daily",stars:Math.floor(Math.random()*60)+10,forks:Math.floor(Math.random()*15),lang:student.language,updated:"1d ago"},
  ];

  /* CC star breakdown */
  const ccContests=Array.from({length:8},(_,i)=>({name:`Div${i%2===0?2:3} ${i+1}`,rank:Math.floor(Math.random()*5000)+200,rating:student.cfRating-200+Math.floor(Math.random()*400)}));

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Platform Intelligence</h1>
        <p style={{color:D.t4,fontSize:12,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>Deep analytics across all your competitive programming platforms</p>
      </div>

      {/* Platform Tab Bar */}
      <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"11px 22px",borderRadius:12,border:`1px solid ${tab===t.id?t.color:D.b1}`,
            background:tab===t.id?`${t.color}14`:`rgba(255,255,255,0.03)`,
            color:tab===t.id?t.color:D.t3,fontSize:13,cursor:"pointer",
            fontFamily:"'Syne',sans-serif",fontWeight:tab===t.id?700:400,
            transition:"all 0.15s",display:"flex",alignItems:"center",gap:7,
          }}>
            <span>{t.icon}</span>{t.label}
            {tab===t.id&&<div style={{width:4,height:4,borderRadius:"50%",background:t.color,boxShadow:`0 0 6px ${t.color}`}}/>}
          </button>
        ))}
      </div>

      {/* ── LEETCODE ── */}
      {tab==="leetcode"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Stats strip */}
          <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
            {[
              {label:"Total Solved",val:total,color:D.orange},
              {label:"Easy",val:student.easy,color:D.green},
              {label:"Medium",val:student.medium,color:D.amber},
              {label:"Hard",val:student.hard,color:D.red},
              {label:"Streak",val:student.streak+"d",color:D.cyan},
            ].map(k=>(
              <Card key={k.label} glow accent={k.color} style={{padding:"18px 20px",textAlign:"center"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,color:k.color}}>{k.val}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:6}}>{k.label.toUpperCase()}</div>
              </Card>
            ))}
          </div>
          <div className="fade-up-1" style={{display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:16}}>
            {/* Difficulty donut */}
            <Card style={{padding:24}}>
              <SectionLabel>Difficulty Breakdown</SectionLabel>
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <div style={{position:"relative"}}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart><Pie data={[{name:"Easy",value:student.easy,fill:D.green},{name:"Medium",value:student.medium,fill:D.amber},{name:"Hard",value:student.hard,fill:D.red}]} cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={3} dataKey="value"><Cell fill={D.green}/><Cell fill={D.amber}/><Cell fill={D.red}/></Pie></PieChart>
                  </ResponsiveContainer>
                  <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:D.t1}}>{total}</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:D.t4}}>SOLVED</div>
                  </div>
                </div>
                <div>
                  {[["Easy",student.easy,D.green],[" Medium",student.medium,D.amber],["Hard",student.hard,D.red]].map(([l,v,c])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <div style={{width:10,height:10,borderRadius:3,background:c,flexShrink:0}}/>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t3,flex:1}}>{l}</span>
                      <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:c}}>{v}</span>
                    </div>
                  ))}
                  <div style={{marginTop:14,padding:"10px 14px",borderRadius:10,background:`rgba(255,107,43,0.06)`,border:`1px solid rgba(255,107,43,0.15)`}}>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>ACCEPTANCE RATE</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:D.orange,marginTop:2}}>{Math.round(68+Math.random()*12)}%</div>
                  </div>
                </div>
              </div>
            </Card>
            {/* Topic mastery */}
            <Card style={{padding:24}}>
              <SectionLabel accent={D.violet}>Topic Mastery</SectionLabel>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {lcTopics.map(t=>(
                  <div key={t.name}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t3}}>{t.name}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,color:t.color}}>{t.solved} solved</span>
                    </div>
                    <div style={{height:5,background:`rgba(255,255,255,0.05)`,borderRadius:4}}>
                      <div style={{height:"100%",width:`${Math.min(100,(t.solved/total)*100*5)}%`,background:`linear-gradient(90deg,${t.color}88,${t.color})`,borderRadius:4}}/>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {/* Recent submissions */}
          <Card className="fade-up-2" style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"16px 24px",borderBottom:`1px solid ${D.b1}`}}><SectionLabel>Recent Submissions</SectionLabel></div>
            {recentLC.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 24px",borderBottom:i<recentLC.length-1?`1px solid ${D.b1}`:"none"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:s.status==="Accepted"?D.green:D.red,flexShrink:0,boxShadow:`0 0 6px ${s.status==="Accepted"?D.green:D.red}`}}/>
                <span style={{flex:1,fontSize:13,fontWeight:600,color:D.t1}}>{s.title}</span>
                <Chip color={s.diff==="Easy"?D.green:s.diff==="Medium"?D.amber:D.red} style={{fontSize:9}}>{s.diff}</Chip>
                <Chip color={s.status==="Accepted"?D.green:D.red} style={{fontSize:9}}>{s.status}</Chip>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>{s.lang}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>{s.ts}</span>
              </div>
            ))}
          </Card>
          {/* LeetCode badges */}
          <Card className="fade-up-3" style={{padding:24}}>
            <SectionLabel accent={D.amber}>LeetCode Badges</SectionLabel>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {[
                {icon:"🏅",label:"100 Days Badge",earned:student.streak>=100,color:D.amber},
                {icon:"⚡",label:"Speed Demon",earned:total>50,color:D.orange},
                {icon:"💎",label:"Guardian",earned:student.hard>20,color:D.violet},
                {icon:"🔥",label:"On Fire",earned:student.streak>30,color:D.red},
                {icon:"🎯",label:"Ace Coder",earned:total>200,color:D.green},
                {icon:"👑",label:"50-Day Badge",earned:student.streak>=50,color:D.amber},
              ].map(b=>(
                <div key={b.label} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:14,background:b.earned?`${b.color}12`:`rgba(255,255,255,0.02)`,border:`1px solid ${b.earned?b.color+"35":D.b1}`,opacity:b.earned?1:0.4}}>
                  <span style={{fontSize:20}}>{b.icon}</span>
                  <span style={{fontSize:12,fontWeight:600,color:b.earned?b.color:D.t4,fontFamily:"'Space Grotesk',sans-serif"}}>{b.label}</span>
                  {b.earned&&<span style={{fontSize:10,color:D.green}}>✓</span>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── GITHUB ── */}
      {tab==="github"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {label:"Total Commits",val:student.ghCommits,color:D.violet},
              {label:"Pull Requests",val:student.ghPRs,color:D.blue},
              {label:"Repositories",val:ghRepos.length+Math.floor(Math.random()*8)+4,color:D.green},
              {label:"Stars Earned",val:ghRepos.reduce((a,r)=>a+r.stars,0),color:D.amber},
            ].map(k=>(
              <Card key={k.label} glow accent={k.color} style={{padding:"18px 20px",textAlign:"center"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,color:k.color}}>{k.val}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:6}}>{k.label.toUpperCase()}</div>
              </Card>
            ))}
          </div>
          <div className="fade-up-1" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {/* Language Breakdown */}
            <Card style={{padding:24}}>
              <SectionLabel>Languages Used</SectionLabel>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {langs.map(l=>(
                  <div key={l.name}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t2}}>{l.name}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:l.color,fontWeight:700}}>{l.pct}%</span>
                    </div>
                    <div style={{height:8,background:`rgba(255,255,255,0.05)`,borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${l.pct}%`,background:`linear-gradient(90deg,${l.color}88,${l.color})`,borderRadius:4}}/>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            {/* Commit trend */}
            <Card style={{padding:24}}>
              <SectionLabel accent={D.violet}>Weekly Commits</SectionLabel>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>({day:d,commits:Math.floor(Math.random()*12)}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="day" tick={{fill:D.t4,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}/>
                  <YAxis tick={{fill:D.t4,fontSize:10}}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="commits" name="Commits" fill={D.violet} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
          {/* Pinned Repos */}
          <Card className="fade-up-2" style={{padding:24}}>
            <SectionLabel accent={D.violet}>Pinned Repositories</SectionLabel>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {ghRepos.map(r=>(
                <div key={r.name} style={{padding:18,borderRadius:14,background:`rgba(124,63,255,0.05)`,border:`1px solid rgba(124,63,255,0.15)`,cursor:"pointer",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=`rgba(124,63,255,0.35)`;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=`rgba(124,63,255,0.15)`;}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:16}}>📁</span>
                    <span style={{fontSize:13,fontWeight:700,color:D.violet}}>{student.github.split("-")[0]}/{r.name}</span>
                  </div>
                  <div style={{display:"flex",gap:14,marginTop:10}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>⭐ {r.stars}</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4}}>🍴 {r.forks}</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.amber,marginLeft:"auto"}}>{r.lang}</span>
                  </div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:6}}>Updated {r.updated}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── CODEFORCES ── */}
      {tab==="codeforces"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {label:"Current Rating",val:student.cfRating,color:D.blue},
              {label:"Max Rating",val:student.cfRating+Math.floor(Math.random()*150),color:D.violet},
              {label:"Contests",val:cfContests.length,color:D.cyan},
              {label:"Problems Solved",val:student.cwProblems,color:D.green},
            ].map(k=>(
              <Card key={k.label} glow accent={k.color} style={{padding:"18px 20px",textAlign:"center"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,color:k.color}}>{k.val}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:6}}>{k.label.toUpperCase()}</div>
              </Card>
            ))}
          </div>
          <div className="fade-up-1" style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16}}>
            {/* Rating history */}
            <Card style={{padding:24}}>
              <SectionLabel>Rating History</SectionLabel>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={cfContests} margin={{top:5,right:5,bottom:0,left:-20}}>
                  <defs><linearGradient id="cfG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={D.blue} stopOpacity={0.25}/><stop offset="95%" stopColor={D.blue} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="round" tick={false}/>
                  <YAxis tick={{fill:D.t4,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="rating" name="Rating" stroke={D.blue} strokeWidth={2.5} fill="url(#cfG)" dot={{fill:D.blue,r:3}} activeDot={{r:5}}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            {/* Tag radar */}
            <Card style={{padding:24}}>
              <SectionLabel accent={D.blue}>Problem Tags</SectionLabel>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={cfTagData}>
                  <PolarGrid stroke={`rgba(61,142,255,0.2)`}/>
                  <PolarAngleAxis dataKey="subject" tick={{fill:D.t4,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}/>
                  <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false}/>
                  <Radar name="Score" dataKey="A" stroke={D.blue} fill={D.blue} fillOpacity={0.18} strokeWidth={2}/>
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>
          {/* Contest list */}
          <Card className="fade-up-2" style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"16px 24px",borderBottom:`1px solid ${D.b1}`}}><SectionLabel accent={D.blue}>Contest History</SectionLabel></div>
            {cfContests.slice(0,6).map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 24px",borderBottom:i<5?`1px solid ${D.b1}`:"none"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t4,minWidth:80}}>{c.round}</span>
                <div style={{flex:1}}/>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t3}}>Rank #{c.rank}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:c.delta>0?D.green:D.red,minWidth:60,textAlign:"right"}}>{c.delta>0?"+":""}{c.delta}</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:D.blue,minWidth:50,textAlign:"right"}}>{c.rating}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── CODECHEF ── */}
      {tab==="codechef"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {label:"Star Rating",val:"★".repeat(student.ccStars),color:D.amber},
              {label:"Stars",val:student.ccStars,color:D.amber},
              {label:"Contests",val:ccContests.length,color:D.orange},
              {label:"Global Rank",val:"#"+Math.floor(Math.random()*50000+5000),color:D.green},
            ].map(k=>(
              <Card key={k.label} glow accent={k.color} style={{padding:"18px 20px",textAlign:"center"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:k.label==="Star Rating"?20:30,fontWeight:900,color:k.color}}>{k.val}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:6}}>{k.label.toUpperCase()}</div>
              </Card>
            ))}
          </div>
          <div className="fade-up-1" style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16}}>
            <Card style={{padding:24}}>
              <SectionLabel accent={D.amber}>Rating Progression</SectionLabel>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={ccContests}>
                  <defs><linearGradient id="ccG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={D.amber} stopOpacity={0.25}/><stop offset="95%" stopColor={D.amber} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="name" tick={false}/>
                  <YAxis tick={{fill:D.t4,fontSize:10}}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="rating" name="Rating" stroke={D.amber} strokeWidth={2} fill="url(#ccG)" dot={{fill:D.amber,r:3}}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card style={{padding:24}}>
              <SectionLabel accent={D.amber}>Star Level Progress</SectionLabel>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
                {[1,2,3,4,5,6,7].map(s=>(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{color:s<=student.ccStars?D.amber:D.t4,fontSize:13}}>{s<=student.ccStars?"★":"☆"}</span>
                    <div style={{flex:1,height:6,background:`rgba(255,255,255,0.05)`,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:s<=student.ccStars?"100%":"0%",background:`linear-gradient(90deg,${D.amber}88,${D.amber})`,borderRadius:3}}/>
                    </div>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:s<=student.ccStars?D.amber:D.t4}}>{s*400} rating</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── OTHERS ── */}
      {tab==="others"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t4}}>Other platforms you can connect to ORBIT</p>
          {[
            {name:"HackerRank",icon:"⬡",color:"#00E87A",handle:"@"+student.leetcode.replace("_lc","_hr"),sub:"Gold badge · Problem Solving",connected:true},
            {name:"Kaggle",icon:"◈",color:"#3D8EFF",handle:"@"+student.github.replace("-dev",""),sub:"Contributor · 2 notebooks",connected:true},
            {name:"HackerEarth",icon:"◇",color:"#7C3FFF",handle:"Not connected",sub:"",connected:false},
            {name:"AtCoder",icon:"▲",color:"#FFB547",handle:"Not connected",sub:"",connected:false},
            {name:"SPOJ",icon:"●",color:"#FF6B2B",handle:"Not connected",sub:"",connected:false},
          ].map(p=>(
            <Card key={p.name} accent={p.connected?p.color:D.t4} style={{padding:"18px 24px"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:44,height:44,borderRadius:12,background:`${p.color}14`,border:`1px solid ${p.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:p.color,flexShrink:0}}>{p.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:D.t1}}>{p.name}</div>
                  {p.connected&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginTop:2}}>{p.handle}</div>}
                  {p.sub&&<div style={{fontSize:11,color:p.color,marginTop:3}}>{p.sub}</div>}
                </div>
                <Chip color={p.connected?D.green:D.t4}>{p.connected?"✓ Connected":"+ Connect"}</Chip>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RESUME BUILDER
══════════════════════════════════════════════════════════════ */
function ResumeBuilder({student,showNotif}){
  const total=student.easy+student.medium+student.hard;
  const[template,setTemplate]=useState("modern");
  const[preview,setPreview]=useState(false);
  const[sections,setSections]=useState({
    summary:`Passionate software developer with strong competitive programming background. Proficient in ${student.language} with expertise in Data Structures, Algorithms, and System Design. Actively solving problems on LeetCode (${total} solved) and Codeforces (${student.cfRating} rating). Seeking opportunities to contribute to impactful engineering teams.`,
    skills:`${student.language}, Data Structures & Algorithms, Competitive Programming, Git/GitHub, System Design, REST APIs, Problem Solving`,
    projects:[
      {title:"Competitive Solutions Repo",desc:`Open-source repository of ${total}+ LeetCode and Codeforces solutions. Includes notes, time/space complexity analysis.`,tech:student.language},
      {title:"ORBIT Platform",desc:"Full-stack student placement & academic ecosystem with real-time analytics, AI assistant, and multi-platform tracking.",tech:"React, Node.js, Supabase"},
    ],
    extras:"Google DSC Lead 2024 · HackIndia Finalist · AWS Cloud Practitioner · Open Source Contributor",
  });

  const TEMPLATES={
    modern:{bg:"#0A0A0E",text:"#F2F2F8",accent:D.orange,secondary:"#161620",border:"rgba(255,107,43,0.2)"},
    minimal:{bg:"#FFFFFF",text:"#111111",accent:"#1A1A2E",secondary:"#F8F8FA",border:"rgba(0,0,0,0.08)"},
    bold:{bg:"#0F0F1A",text:"#E8E8F8",accent:D.violet,secondary:"#1A1A28",border:"rgba(124,63,255,0.2)"},
  };
  const T=TEMPLATES[template];

  return(
    <div>
      <div style={{marginBottom:24,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Resume Builder</h1>
          <p style={{color:D.t4,fontSize:12,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>Auto-populated from your ORBIT data · Export-ready</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          {["modern","minimal","bold"].map(t=>(
            <button key={t} onClick={()=>setTemplate(t)} style={{padding:"8px 16px",borderRadius:10,border:`1px solid ${template===t?T.accent:D.b1}`,background:template===t?`${T.accent}14`:`rgba(255,255,255,0.03)`,color:template===t?T.accent:D.t3,fontSize:12,cursor:"pointer",fontWeight:template===t?700:400,textTransform:"capitalize"}}>{t}</button>
          ))}
          <button onClick={()=>{setPreview(!preview);}} style={{padding:"8px 18px",background:`rgba(0,232,122,0.1)`,border:`1px solid rgba(0,232,122,0.25)`,borderRadius:10,color:D.green,fontSize:12,cursor:"pointer",fontWeight:700}}>{preview?"← Edit":"👁 Preview"}</button>
        </div>
      </div>

      {!preview?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          {/* Summary */}
          <Card style={{padding:24,gridColumn:"1/-1"}} accent={D.orange}>
            <SectionLabel>Professional Summary</SectionLabel>
            <textarea value={sections.summary} onChange={e=>setSections(p=>({...p,summary:e.target.value}))} rows={4}
              style={{width:"100%",padding:"12px 14px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b1}`,borderRadius:11,color:D.t1,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7}}/>
          </Card>
          {/* Skills */}
          <Card style={{padding:24}} accent={D.violet}>
            <SectionLabel accent={D.violet}>Technical Skills</SectionLabel>
            <textarea value={sections.skills} onChange={e=>setSections(p=>({...p,skills:e.target.value}))} rows={4}
              style={{width:"100%",padding:"12px 14px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b1}`,borderRadius:11,color:D.t1,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7}}/>
          </Card>
          {/* Extras */}
          <Card style={{padding:24}} accent={D.green}>
            <SectionLabel accent={D.green}>Extra-curriculars & Certs</SectionLabel>
            <textarea value={sections.extras} onChange={e=>setSections(p=>({...p,extras:e.target.value}))} rows={4}
              style={{width:"100%",padding:"12px 14px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b1}`,borderRadius:11,color:D.t1,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7}}/>
          </Card>
          {/* Auto-generated stats preview */}
          <Card style={{padding:24,gridColumn:"1/-1"}} accent={D.blue}>
            <SectionLabel accent={D.blue}>Platform Stats (Auto-populated)</SectionLabel>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[
                {platform:"LeetCode",stat:`${total} Problems`,sub:`Easy: ${student.easy} | Med: ${student.medium} | Hard: ${student.hard}`,color:D.orange},
                {platform:"Codeforces",stat:`${student.cfRating} Rating`,sub:`Specialist · ${student.cwProblems} solved`,color:D.blue},
                {platform:"GitHub",stat:`${student.ghCommits} Commits`,sub:`${student.ghPRs} PRs merged`,color:D.violet},
                {platform:"CodeChef",stat:`${student.ccStars}⭐ Rated`,sub:`Active since 2022`,color:D.amber},
              ].map(p=>(
                <div key={p.platform} style={{padding:14,borderRadius:12,background:`${p.color}08`,border:`1px solid ${p.color}20`}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:p.color,marginBottom:6,letterSpacing:1}}>{p.platform.toUpperCase()}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:p.color}}>{p.stat}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:4}}>{p.sub}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ):(
        /* ── RESUME PREVIEW ── */
        <div style={{background:T.bg,borderRadius:16,padding:48,border:`1px solid ${T.border}`,maxWidth:780,margin:"0 auto",fontFamily:template==="modern"?"'Space Grotesk',sans-serif":"Georgia, serif"}}>
          {/* Header */}
          <div style={{borderBottom:`2px solid ${T.accent}`,paddingBottom:24,marginBottom:24}}>
            <div style={{fontSize:32,fontWeight:900,color:T.text,letterSpacing:-1}}>{student.name}</div>
            <div style={{fontSize:14,color:T.accent,marginTop:4,letterSpacing:2,fontFamily:"monospace"}}>{student.dept} ENGINEER · {student.batch}</div>
            <div style={{display:"flex",gap:20,marginTop:12,flexWrap:"wrap"}}>
              {[student.email,`LC: ${total} solved`,`CF: ${student.cfRating}`,`CGPA: ${student.cgpa}`].map(v=>(
                <span key={v} style={{fontSize:12,color:T.text,opacity:0.7,fontFamily:"monospace"}}>{v}</span>
              ))}
            </div>
          </div>
          {/* Summary */}
          <div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.accent,letterSpacing:2,marginBottom:10,fontFamily:"monospace"}}>PROFESSIONAL SUMMARY</div>
            <p style={{fontSize:13,lineHeight:1.8,color:T.text,opacity:0.85}}>{sections.summary}</p>
          </div>
          {/* Platform Stats */}
          <div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.accent,letterSpacing:2,marginBottom:12,fontFamily:"monospace"}}>COMPETITIVE PROGRAMMING</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                `LeetCode: ${total} problems solved (${student.easy}E/${student.medium}M/${student.hard}H) · ${student.streak} day streak`,
                `Codeforces: ${student.cfRating} rating · ${student.cwProblems} problems solved`,
                `GitHub: ${student.ghCommits} commits · ${student.ghPRs} PRs · @${student.github}`,
                `CodeChef: ${student.ccStars}★ rated · @${student.codechef}`,
              ].map((s,i)=><div key={i} style={{fontSize:12,color:T.text,opacity:0.8,padding:"8px 12px",borderRadius:8,background:T.secondary}}>{s}</div>)}
            </div>
          </div>
          {/* Skills */}
          <div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.accent,letterSpacing:2,marginBottom:10,fontFamily:"monospace"}}>TECHNICAL SKILLS</div>
            <p style={{fontSize:13,lineHeight:1.8,color:T.text,opacity:0.85}}>{sections.skills}</p>
          </div>
          {/* Education */}
          <div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:T.accent,letterSpacing:2,marginBottom:12,fontFamily:"monospace"}}>EDUCATION</div>
            <div style={{padding:"12px 16px",borderRadius:8,background:T.secondary}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text}}>B.Tech in {student.dept}</div>
              <div style={{fontSize:12,color:T.text,opacity:0.7,marginTop:4}}>{student.batch} · CGPA: {student.cgpa}/10.0 · Section {student.section}</div>
            </div>
          </div>
          {/* Extras */}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:T.accent,letterSpacing:2,marginBottom:10,fontFamily:"monospace"}}>ACHIEVEMENTS & CERTIFICATIONS</div>
            <p style={{fontSize:13,lineHeight:1.8,color:T.text,opacity:0.85}}>{sections.extras}</p>
          </div>
          {/* Footer */}
          <div style={{marginTop:32,paddingTop:16,borderTop:`1px solid ${T.border}`,textAlign:"center",fontSize:10,color:T.text,opacity:0.4,fontFamily:"monospace"}}>Generated by ORBIT Platform · {new Date().toLocaleDateString()}</div>
        </div>
      )}

      <div style={{marginTop:20,display:"flex",gap:12,justifyContent:"flex-end"}}>
        <button onClick={()=>{showNotif("🖨️ Opening print dialog — save as PDF","success");window.print();}} style={{padding:"12px 28px",background:`linear-gradient(135deg,${D.orange},#FF3D00)`,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:`0 0 20px rgba(255,107,43,0.4)`}}>⬇ Export as PDF</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOCK TEST — AI-Generated Tests
══════════════════════════════════════════════════════════════ */
function MockTest({student,showNotif}){
  const[phase,setPhase]=useState("select"); // select → generating → active → review
  const[testType,setTestType]=useState("dsa");
  const[difficulty,setDifficulty]=useState("adaptive");
  const[questions,setQuestions]=useState([]);
  const[answers,setAnswers]=useState({});
  const[current,setCurrent]=useState(0);
  const[timeLeft,setTimeLeft]=useState(30*60);
  const[score,setScore]=useState(null);
  const[loading,setLoading]=useState(false);
  const timerRef=useRef(null);

  /* Timer */
  useEffect(()=>{
    if(phase==="active"){
      timerRef.current=setInterval(()=>{
        setTimeLeft(t=>{
          if(t<=1){clearInterval(timerRef.current);submitTest();return 0;}
          return t-1;
        });
      },1000);
    }
    return()=>clearInterval(timerRef.current);
  },[phase]);

  const formatTime=(s)=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const total_lc=student.easy+student.medium+student.hard;

  const generateTest=async()=>{
    setLoading(true);setPhase("generating");
    try{
      const gemKey=window.__GEMINI_KEY||"";
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system_instruction:{parts:[{text:"You are an expert technical interviewer. Return ONLY valid JSON array, no markdown, no preamble."}]},
          contents:[{role:"user",parts:[{text:`Generate 8 MCQ questions for a ${testType} test. Student: LeetCode ${total_lc} solved (${student.easy}E/${student.medium}M/${student.hard}H), CF ${student.cfRating}, lang: ${student.language}. Difficulty: ${difficulty==="adaptive"?student.cfRating>1600?"hard":student.cfRating>1200?"medium":"easy":difficulty}. Focus weak areas. Return ONLY: [{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","topic":"..."}]`}]}],
          generationConfig:{maxOutputTokens:1500}
        })
      });
      const data=await res.json();
      const text=data.candidates?.[0]?.content?.parts?.[0]?.text||"[]";
      const clean=text.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setQuestions(parsed);setPhase("active");setTimeLeft(parsed.length*3*60);setAnswers({});setCurrent(0);
    }catch(e){
      /* Fallback hardcoded questions if API fails */
      setQuestions([
        {q:"What is the time complexity of inserting into a balanced BST?",options:["A. O(1)","B. O(log n)","C. O(n)","D. O(n log n)"],answer:"B",explanation:"Balanced BST maintains height O(log n), so insertion is O(log n).",topic:"Trees"},
        {q:"Which algorithm is best for finding shortest path in a graph with negative weights?",options:["A. Dijkstra","B. BFS","C. Bellman-Ford","D. DFS"],answer:"C",explanation:"Bellman-Ford handles negative weights, Dijkstra does not.",topic:"Graphs"},
        {q:`In ${student.language}, what is the default stack size in recursion?`,options:["A. 1MB","B. 8MB","C. 512KB","D. Unlimited"],answer:"B",explanation:"Default stack size is typically 8MB in most systems.",topic:"Language"},
        {q:"What data structure does BFS use?",options:["A. Stack","B. Priority Queue","C. Queue","D. Deque"],answer:"C",explanation:"BFS uses a Queue (FIFO) to explore nodes level by level.",topic:"BFS"},
        {q:"Worst case of QuickSort?",options:["A. O(n log n)","B. O(n)","C. O(n²)","D. O(log n)"],answer:"C",explanation:"Worst case is O(n²) when pivot is always smallest/largest.",topic:"Sorting"},
        {q:"Which DP approach uses memoization?",options:["A. Bottom-up","B. Top-down","C. Greedy","D. Divide & Conquer"],answer:"B",explanation:"Top-down DP uses recursion + memoization.",topic:"DP"},
        {q:"Space complexity of merge sort?",options:["A. O(1)","B. O(log n)","C. O(n)","D. O(n²)"],answer:"C",explanation:"Merge sort needs O(n) extra space for merging.",topic:"Sorting"},
        {q:"What is amortized O(1) insertion?",options:["A. Linked List","B. Dynamic Array","C. BST","D. HashMap"],answer:"B",explanation:"Dynamic arrays double in size, giving amortized O(1) append.",topic:"Arrays"},
      ]);
      setPhase("active");setTimeLeft(24*60);setAnswers({});setCurrent(0);
    }
    setLoading(false);
  };

  const submitTest=()=>{
    clearInterval(timerRef.current);
    let correct=0;
    questions.forEach((q,i)=>{if(answers[i]===q.answer)correct++;});
    setScore({correct,total:questions.length,pct:Math.round((correct/questions.length)*100)});
    setPhase("review");
  };

  if(phase==="select")return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Mock Test</h1>
        <p style={{color:D.t4,fontSize:12,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>AI analyses your profile and generates personalised test questions</p>
      </div>
      <div style={{maxWidth:560,margin:"0 auto"}}>
        <Card style={{padding:36}} accent={D.violet}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:48,marginBottom:12}}>⬡</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:900,color:D.t1}}>Configure Your Test</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t4,marginTop:8}}>AI will target your weak areas: CF rating {student.cfRating} · {total_lc} LC solved</div>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,letterSpacing:1,marginBottom:10}}>TEST TYPE</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["dsa","⚡ DSA & Algorithms"],["system","🏗️ System Design"],["language","🔧 Language Specific"],["mixed","🎲 Mixed (All Topics)"]].map(([v,l])=>(
                <button key={v} onClick={()=>setTestType(v)} style={{padding:"12px 16px",borderRadius:12,border:`1px solid ${testType===v?D.violet:D.b1}`,background:testType===v?`rgba(124,63,255,0.12)`:`rgba(255,255,255,0.03)`,color:testType===v?D.violet:D.t3,fontSize:13,cursor:"pointer",fontWeight:testType===v?700:400}}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:32}}>
            <label style={{display:"block",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,letterSpacing:1,marginBottom:10}}>DIFFICULTY</label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {[["adaptive","🤖 Adaptive"],["easy","🟢 Easy"],["medium","🟡 Medium"],["hard","🔴 Hard"]].map(([v,l])=>(
                <button key={v} onClick={()=>setDifficulty(v)} style={{padding:"10px 8px",borderRadius:10,border:`1px solid ${difficulty===v?D.orange:D.b1}`,background:difficulty===v?`rgba(255,107,43,0.12)`:`rgba(255,255,255,0.03)`,color:difficulty===v?D.orange:D.t3,fontSize:11,cursor:"pointer",fontWeight:difficulty===v?700:400}}>{l}</button>
              ))}
            </div>
          </div>
          <button onClick={generateTest} style={{width:"100%",padding:"16px",background:`linear-gradient(135deg,${D.violet},#5500CC)`,border:"none",borderRadius:13,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,cursor:"pointer",boxShadow:`0 0 28px rgba(124,63,255,0.4)`}}>
            Generate AI Test →
          </button>
        </Card>
      </div>
    </div>
  );

  if(phase==="generating")return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:400,flexDirection:"column",gap:20}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${D.violet},#5500CC)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,animation:"glowPulse 1.5s infinite"}}>⬡</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:D.t1}}>Beacon is generating your test…</div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t4}}>Analysing your profile · Targeting weak spots · Crafting questions</div>
    </div>
  );

  if(phase==="active"&&questions.length>0){
    const q=questions[current];
    const timePct=(timeLeft/(questions.length*3*60))*100;
    return(
      <div style={{maxWidth:720,margin:"0 auto"}}>
        {/* Timer + Progress Header */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:"14px 20px",background:D.bg2,borderRadius:14,border:`1px solid ${D.b1}`}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:timePct<20?D.red:timePct<50?D.amber:D.green}}>{formatTime(timeLeft)}</div>
          <div style={{flex:1,height:6,background:`rgba(255,255,255,0.06)`,borderRadius:4}}>
            <div style={{height:"100%",width:`${(current+1)/questions.length*100}%`,background:`linear-gradient(90deg,${D.violet},${D.orange})`,borderRadius:4,transition:"width 0.3s"}}/>
          </div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:D.t4}}>{current+1}/{questions.length}</div>
          <button onClick={submitTest} style={{padding:"8px 16px",background:`rgba(255,61,90,0.1)`,border:`1px solid rgba(255,61,90,0.25)`,borderRadius:9,color:D.red,fontSize:11,cursor:"pointer"}}>Submit</button>
        </div>
        {/* Question Card */}
        <Card className="fade-up" style={{padding:36,marginBottom:16}} accent={D.violet}>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <Chip color={D.violet}>{current+1}</Chip>
            {q.topic&&<Chip color={D.blue} style={{fontSize:9}}>{q.topic}</Chip>}
          </div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:600,color:D.t1,lineHeight:1.7,marginBottom:28}}>{q.q}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {(q.options||[]).map((opt,oi)=>{
              const key=["A","B","C","D"][oi];
              const selected=answers[current]===key;
              return(
                <button key={oi} onClick={()=>setAnswers(p=>({...p,[current]:key}))} style={{
                  padding:"14px 18px",borderRadius:12,border:`1px solid ${selected?D.violet:D.b2}`,
                  background:selected?`rgba(124,63,255,0.12)`:`rgba(255,255,255,0.03)`,
                  color:selected?D.violet:D.t2,fontSize:13,cursor:"pointer",textAlign:"left",
                  transition:"all 0.15s",fontWeight:selected?700:400,
                }}>
                  {opt}
                </button>
              );
            })}
          </div>
        </Card>
        {/* Navigation */}
        <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
          <button onClick={()=>setCurrent(p=>Math.max(0,p-1))} disabled={current===0} style={{padding:"12px 24px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b1}`,borderRadius:12,color:current===0?D.t4:D.t1,cursor:current===0?"not-allowed":"pointer",fontSize:13}}>← Prev</button>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",flex:1}}>
            {questions.map((_,i)=>(
              <button key={i} onClick={()=>setCurrent(i)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${answers[i]?D.violet:D.b1}`,background:i===current?`rgba(124,63,255,0.15)`:answers[i]?`rgba(124,63,255,0.08)`:`rgba(255,255,255,0.02)`,color:i===current?D.violet:answers[i]?D.violetL:D.t4,fontSize:11,cursor:"pointer",fontWeight:i===current?700:400}}>{i+1}</button>
            ))}
          </div>
          {current<questions.length-1?(
            <button onClick={()=>setCurrent(p=>p+1)} style={{padding:"12px 24px",background:`linear-gradient(135deg,${D.violet},#5500CC)`,border:"none",borderRadius:12,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>Next →</button>
          ):(
            <button onClick={submitTest} style={{padding:"12px 24px",background:`linear-gradient(135deg,${D.green},#00A856)`,border:"none",borderRadius:12,color:"#000",cursor:"pointer",fontSize:13,fontWeight:800}}>Submit ✓</button>
          )}
        </div>
      </div>
    );
  }

  if(phase==="review")return(
    <div>
      {/* Score Card */}
      <Card className="fade-up" style={{padding:40,textAlign:"center",marginBottom:24}} glow accent={score.pct>=70?D.green:score.pct>=50?D.amber:D.red}>
        <div style={{fontSize:64,fontWeight:900,fontFamily:"'Syne',sans-serif",color:score.pct>=70?D.green:score.pct>=50?D.amber:D.red}}>{score.pct}%</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:D.t1,marginTop:8}}>{score.pct>=80?"Excellent! 🎉":score.pct>=60?"Good work! 💪":score.pct>=40?"Keep practicing 📚":"Needs improvement ⚡"}</div>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:D.t4,marginTop:8}}>{score.correct}/{score.total} correct answers</div>
        <button onClick={()=>{setPhase("select");setQuestions([]);setAnswers({});setScore(null);}} style={{marginTop:24,padding:"12px 32px",background:`linear-gradient(135deg,${D.violet},#5500CC)`,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer"}}>Take Another Test →</button>
      </Card>
      {/* Answer Review */}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {questions.map((q,i)=>{
          const isCorrect=answers[i]===q.answer;
          return(
            <Card key={i} accent={isCorrect?D.green:D.red} style={{padding:24}}>
              <div style={{display:"flex",gap:12,marginBottom:12}}>
                <div style={{width:28,height:28,borderRadius:8,background:isCorrect?`rgba(0,232,122,0.15)`:`rgba(255,61,90,0.15)`,border:`1px solid ${isCorrect?D.green:D.red}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14}}>{isCorrect?"✓":"✗"}</div>
                <div style={{fontSize:14,fontWeight:600,color:D.t1,flex:1,lineHeight:1.6}}>{q.q}</div>
                {q.topic&&<Chip color={D.blue} style={{fontSize:9,flexShrink:0}}>{q.topic}</Chip>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                {(q.options||[]).map((opt,oi)=>{
                  const key=["A","B","C","D"][oi];
                  const isAnswer=key===q.answer;
                  const isSelected=answers[i]===key;
                  return(
                    <div key={oi} style={{padding:"8px 12px",borderRadius:9,background:isAnswer?`rgba(0,232,122,0.1)`:isSelected&&!isAnswer?`rgba(255,61,90,0.08)`:`rgba(255,255,255,0.02)`,border:`1px solid ${isAnswer?D.green:isSelected&&!isAnswer?D.red:D.b1}`,fontSize:12,color:isAnswer?D.green:isSelected&&!isAnswer?D.red:D.t3}}>{opt}</div>
                  );
                })}
              </div>
              {q.explanation&&<div style={{padding:"10px 14px",borderRadius:10,background:`rgba(255,255,255,0.03)`,border:`1px solid ${D.b1}`,fontSize:12,color:D.t3,lineHeight:1.6}}>💡 {q.explanation}</div>}
            </Card>
          );
        })}
      </div>
    </div>
  );

  return null;
}

/* ══════════════════════════════════════════════════════════════
   MOCK INTERVIEW — Camera + AI Interviewer
══════════════════════════════════════════════════════════════ */
function MockInterview({student,requests,setRequests,showNotif}){
  const[phase,setPhase]=useState("lobby"); // lobby → room
  const[reqType,setReqType]=useState("dsa");
  const[submitted,setSubmitted]=useState(false);
  const[inRoom,setInRoom]=useState(null);
  const videoRef=useRef(null);
  const[camOn,setCamOn]=useState(false);
  const[micOn,setMicOn]=useState(true);
  const[messages,setMessages]=useState([]);
  const[input,setInput]=useState("");
  const[aiLoading,setAiLoading]=useState(false);
  const[interviewState,setInterviewState]=useState("intro"); // intro → q1 → q2... → done
  const[questionNo,setQuestionNo]=useState(0);
  const[interviewDone,setInterviewDone]=useState(false);
  const[feedback,setFeedback]=useState(null);
  const endRef=useRef(null);
  const streamRef=useRef(null);
  const total_lc=student.easy+student.medium+student.hard;

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  useEffect(()=>{
    if(phase==="room"&&!camOn){
      navigator.mediaDevices?.getUserMedia({video:true,audio:true}).then(stream=>{
        streamRef.current=stream;
        if(videoRef.current)videoRef.current.srcObject=stream;
        setCamOn(true);
        /* Start interview */
        startInterview();
      }).catch(()=>{
        setCamOn(false);
        startInterview();
      });
    }
    return()=>{
      if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());
    };
  },[phase]);

  const startInterview=async()=>{
    setAiLoading(true);
    try{
      const gemKey=window.__GEMINI_KEY||"";
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system_instruction:{parts:[{text:`You are an interviewer at a top tech company conducting a ${inRoom?.type||reqType} mock interview. Candidate: ${student.name}, ${student.dept}, LeetCode ${total_lc} solved, CF ${student.cfRating}. Be professional, concise. Ask one question at a time.`}]},
          contents:[{role:"user",parts:[{text:"Start the interview with a warm greeting and your first question."}]}],
          generationConfig:{maxOutputTokens:350}
        })
      });
      const data=await res.json();
      const text=data.candidates?.[0]?.content?.parts?.[0]?.text||"Hello! Welcome to your mock interview. Let's start — can you introduce yourself and your coding journey?";
      setMessages([{role:"ai",text,ts:new Date().toLocaleTimeString()}]);
      setQuestionNo(1);
    }catch{
      setMessages([{role:"ai",text:`Hello ${student.name}! Welcome to your ${inRoom?.type||reqType} mock interview. I'll be your interviewer today. Let's begin — can you start by introducing yourself?`,ts:new Date().toLocaleTimeString()}]);
      setQuestionNo(1);
    }
    setAiLoading(false);
  };

  const sendAnswer=async()=>{
    if(!input.trim()||aiLoading)return;
    const ans=input;setInput("");
    const newMsgs=[...messages,{role:"user",text:ans,ts:new Date().toLocaleTimeString()}];
    setMessages(newMsgs);
    setAiLoading(true);
    const qCount=newMsgs.filter(m=>m.role==="ai").length;
    const isEnd=qCount>=5;
    try{
      const gemKey=window.__GEMINI_KEY||"";
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system_instruction:{parts:[{text:`You are an interviewer conducting a ${inRoom?.type||reqType} mock interview with ${student.name}. Be professional. ${isEnd?"This is the final evaluation. Give feedback on strengths and areas to improve. End with 'Interview complete. Good luck!'":"Ask a follow-up or next question. Keep under 100 words."}`}]},
          contents:newMsgs.map(m=>({role:m.role==="ai"?"model":"user",parts:[{text:m.text}]})),
          generationConfig:{maxOutputTokens:500}
        })
      });
      const data=await res.json();
      const text=data.candidates?.[0]?.content?.parts?.[0]?.text||"Thank you for that answer. Let me ask you something else...";
      setMessages(p=>[...p,{role:"ai",text,ts:new Date().toLocaleTimeString()}]);
      setQuestionNo(p=>p+1);
      if(isEnd){setInterviewDone(true);setFeedback(text);}
    }catch{
      setMessages(p=>[...p,{role:"ai",text:"Good answer! Let's move to the next question. Can you explain the concept of dynamic programming?",ts:new Date().toLocaleTimeString()}]);
    }
    setAiLoading(false);
  };

  const endInterview=()=>{
    if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());
    setCamOn(false);setPhase("lobby");
    if(!interviewDone)showNotif("Interview ended","info");
  };

  const submitRequest=()=>{
    const req={id:Date.now(),studentId:student.id,studentName:student.name,studentRoll:student.roll,type:reqType,status:"pending",ts:new Date().toLocaleTimeString(),dept:student.dept,section:student.section};
    setRequests(p=>[...p,req]);
    setSubmitted(true);
    showNotif("✅ Mock interview request submitted","success");
  };

  /* Already approved request? */
  const approvedReq=requests.find(r=>r.studentId===student.id&&r.status==="approved");

  if(phase==="room")return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:16,height:"calc(100vh - 140px)",minHeight:600}}>
      {/* Camera + Controls */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Video */}
        <Card style={{flex:1,padding:0,overflow:"hidden",position:"relative",background:"#000",minHeight:320}} accent={D.orange}>
          {camOn?(
            <video ref={videoRef} autoPlay muted playsInline style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          ):(
            <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,background:"#000",minHeight:320}}>
              <div style={{fontSize:56}}>👤</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:D.t4}}>Camera not available</div>
              <div style={{fontSize:11,color:D.t4,fontFamily:"'JetBrains Mono',monospace"}}>Allow camera access for full experience</div>
            </div>
          )}
          {/* Overlay info */}
          <div style={{position:"absolute",top:16,left:16,padding:"6px 14px",borderRadius:20,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",border:`1px solid rgba(255,107,43,0.3)`,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:D.red,animation:"pulsate 1.5s infinite"}}/>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t1}}>LIVE · Mock Interview</span>
          </div>
          {/* Name overlay */}
          <div style={{position:"absolute",bottom:16,left:16,padding:"6px 14px",borderRadius:10,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)"}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:D.t1}}>{student.name}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4}}>{student.roll} · {student.dept}</div>
          </div>
          {/* AI interviewer pip */}
          <div style={{position:"absolute",bottom:16,right:16,width:120,height:90,borderRadius:12,background:`linear-gradient(135deg,${D.bg3},${D.bg4})`,border:`1px solid rgba(255,107,43,0.3)`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:4}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${D.orange},#FF3D00)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,animation:aiLoading?"glowPulse 1s infinite":"none"}}>✦</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.orange}}>BEACON AI</div>
          </div>
        </Card>
        {/* Controls */}
        <div style={{display:"flex",gap:12,justifyContent:"center",padding:"14px 20px",background:D.bg2,borderRadius:14,border:`1px solid ${D.b1}`}}>
          {[
            {icon:micOn?"🎤":"🔇",label:micOn?"Mic On":"Muted",action:()=>setMicOn(!micOn),color:micOn?D.green:D.red},
            {icon:camOn?"📷":"📵",label:camOn?"Cam On":"Cam Off",action:()=>{},color:camOn?D.blue:D.red},
            {icon:"🔴",label:"End Interview",action:endInterview,color:D.red},
          ].map(ctrl=>(
            <button key={ctrl.label} onClick={ctrl.action} style={{padding:"10px 20px",background:`${ctrl.color}14`,border:`1px solid ${ctrl.color}30`,borderRadius:12,color:ctrl.color,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:8,fontWeight:600}}>
              {ctrl.icon} {ctrl.label}
            </button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
            <Chip color={D.violet}>Q{questionNo}</Chip>
            {interviewDone&&<Chip color={D.green}>Complete</Chip>}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <Card style={{padding:0,display:"flex",flexDirection:"column",overflow:"hidden"}} accent={D.orange}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${D.b1}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${D.orange},#FF3D00)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:800,color:D.t1}}>Beacon AI Interviewer</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.orange}}>{(inRoom?.type||reqType).toUpperCase()} INTERVIEW</div>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
          {messages.map((m,i)=>(
            <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"90%"}}>
              {m.role==="ai"&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.orange,marginBottom:4}}>Beacon AI · {m.ts}</div>}
              <div style={{
                padding:"12px 16px",
                borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                background:m.role==="user"?`linear-gradient(135deg,${D.orangeD},#CC2800)`:`rgba(26,26,34,0.98)`,
                border:m.role==="ai"?`1px solid ${D.b1}`:"none",
                fontSize:13,lineHeight:1.65,color:D.t1,
              }}>{m.text}</div>
              {m.role==="user"&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:4,textAlign:"right"}}>{m.ts}</div>}
            </div>
          ))}
          {aiLoading&&<div style={{alignSelf:"flex-start"}}><div style={{padding:"12px 16px",borderRadius:"18px 18px 18px 4px",background:`rgba(26,26,34,0.98)`,border:`1px solid ${D.b1}`,display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:D.orange,animation:`bounce 1s ${i*0.2}s infinite`}}/>)}</div></div>}
          <div ref={endRef}/>
        </div>
        {!interviewDone?(
          <div style={{padding:"12px",borderTop:`1px solid ${D.b1}`,display:"flex",gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendAnswer()} placeholder="Type your answer…" style={{flex:1,padding:"11px 14px",background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.b2}`,borderRadius:11,color:D.t1,fontSize:13,outline:"none"}}/>
            <button onClick={sendAnswer} disabled={aiLoading} style={{width:44,height:44,borderRadius:11,background:aiLoading?`rgba(255,107,43,0.2)`:`linear-gradient(135deg,${D.orange},#FF3D00)`,border:"none",color:"#fff",cursor:aiLoading?"not-allowed":"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
          </div>
        ):(
          <div style={{padding:"14px",borderTop:`1px solid ${D.b1}`,textAlign:"center"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.green,marginBottom:8}}>✓ Interview Complete</div>
            <button onClick={endInterview} style={{padding:"10px 24px",background:`linear-gradient(135deg,${D.green},#00A856)`,border:"none",borderRadius:11,color:"#000",fontWeight:800,fontSize:13,cursor:"pointer"}}>View Summary</button>
          </div>
        )}
      </Card>
    </div>
  );

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Mock Interview</h1>
        <p style={{color:D.t4,fontSize:12,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>AI-powered mock interviews · Camera + voice simulation · Real interview feel</p>
      </div>

      {/* If an approved request exists → show Enter Room */}
      {approvedReq&&(
        <Card className="fade-up" glow accent={D.green} style={{padding:28,marginBottom:20,background:`rgba(0,232,122,0.04)`}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{fontSize:32}}>🚀</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:D.green}}>Interview Approved!</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t4,marginTop:4}}>Your {approvedReq.type.toUpperCase()} mock interview has been approved. Room is ready.</div>
            </div>
            <button onClick={()=>{setInRoom(approvedReq);setPhase("room");}} style={{padding:"14px 28px",background:`linear-gradient(135deg,${D.green},#00A856)`,border:"none",borderRadius:12,color:"#000",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:`0 0 20px rgba(0,232,122,0.4)`}}>Enter Room →</button>
          </div>
        </Card>
      )}

      {/* Practice without approval */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Card style={{padding:28}} accent={D.orange}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:D.t1,marginBottom:8}}>⚡ Practice Now</div>
          <p style={{fontSize:13,color:D.t3,lineHeight:1.7,marginBottom:20}}>Jump into an immediate AI mock interview without waiting for approval. Good for practice!</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
            {["dsa","system","hr","fullstack"].map(t=>(
              <button key={t} onClick={()=>setReqType(t)} style={{padding:"10px",borderRadius:10,border:`1px solid ${reqType===t?D.orange:D.b1}`,background:reqType===t?`rgba(255,107,43,0.1)`:`rgba(255,255,255,0.03)`,color:reqType===t?D.orange:D.t3,fontSize:12,cursor:"pointer",fontWeight:reqType===t?700:400}}>
                {t==="dsa"?"⚡ DSA":t==="system"?"🏗 System Design":t==="hr"?"👤 HR/Behavioral":"🔧 Full Stack"}
              </button>
            ))}
          </div>
          <button onClick={()=>{setInRoom({type:reqType});setPhase("room");}} style={{width:"100%",padding:"14px",background:`linear-gradient(135deg,${D.orange},#FF3D00)`,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:`0 0 20px rgba(255,107,43,0.35)`}}>
            Start Interview Now →
          </button>
        </Card>
        <Card style={{padding:28}} accent={D.blue}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:D.t1,marginBottom:8}}>📋 Request Official Review</div>
          <p style={{fontSize:13,color:D.t3,lineHeight:1.7,marginBottom:20}}>Submit a request for your Section Incharge to schedule and monitor your mock interview.</p>
          {!submitted?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
                {["dsa","system","hr","fullstack"].map(t=>(
                  <button key={t} onClick={()=>setReqType(t)} style={{padding:"10px",borderRadius:10,border:`1px solid ${reqType===t?D.blue:D.b1}`,background:reqType===t?`rgba(61,142,255,0.1)`:`rgba(255,255,255,0.03)`,color:reqType===t?D.blue:D.t3,fontSize:12,cursor:"pointer",fontWeight:reqType===t?700:400}}>
                    {t==="dsa"?"⚡ DSA":t==="system"?"🏗 System":t==="hr"?"👤 HR":"🔧 Full Stack"}
                  </button>
                ))}
              </div>
              <button onClick={submitRequest} style={{width:"100%",padding:"14px",background:`linear-gradient(135deg,${D.blue},#1A5FCC)`,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:`0 0 20px rgba(61,142,255,0.35)`}}>
                Submit Request →
              </button>
            </>
          ):(
            <div style={{textAlign:"center",padding:20}}>
              <div style={{fontSize:36,marginBottom:12}}>📬</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:D.blue}}>Request Submitted</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:D.t4,marginTop:8}}>Waiting for your Section Incharge to approve</div>
            </div>
          )}
        </Card>
      </div>

      {/* My Requests */}
      {requests.length>0&&(
        <Card style={{padding:0,overflow:"hidden"}} accent={D.violet}>
          <div style={{padding:"16px 24px",borderBottom:`1px solid ${D.b1}`}}><SectionLabel accent={D.violet}>My Interview Requests</SectionLabel></div>
          {requests.map((r,i)=>(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 24px",borderBottom:i<requests.length-1?`1px solid ${D.b1}`:"none"}}>
              <div style={{fontSize:16}}>{r.status==="approved"?"✅":r.status==="rejected"?"❌":"⏳"}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:D.t1}}>{r.type.toUpperCase()} Mock Interview</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t4,marginTop:2}}>Submitted {r.ts}</div>
              </div>
              <Chip color={r.status==="approved"?D.green:r.status==="rejected"?D.red:D.amber}>{r.status.toUpperCase()}</Chip>
              {r.status==="approved"&&<button onClick={()=>{setInRoom(r);setPhase("room");}} style={{padding:"8px 16px",background:`rgba(0,232,122,0.1)`,border:`1px solid rgba(0,232,122,0.25)`,borderRadius:9,color:D.green,fontSize:12,cursor:"pointer",fontWeight:700}}>Enter Room</button>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   INTERVIEW APPROVALS (for Section Incharge)
══════════════════════════════════════════════════════════════ */
function InterviewApprovals({requests,setRequests,currentUser,students,showNotif}){
  const myRequests=requests.filter(r=>students.some(s=>s.id===r.studentId));
  const approve=(id)=>{setRequests(p=>p.map(r=>r.id===id?{...r,status:"approved"}:r));showNotif("✅ Interview approved","success");};
  const reject=(id)=>{setRequests(p=>p.map(r=>r.id===id?{...r,status:"rejected"}:r));showNotif("❌ Request rejected","error");};
  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:900,letterSpacing:-1,color:D.t1}}>Interview Requests</h1>
        <p style={{color:D.t4,fontSize:12,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{currentUser?.dept}-{currentUser?.section} · {myRequests.filter(r=>r.status==="pending").length} pending</p>
      </div>
      {myRequests.length===0?(
        <Card style={{padding:60,textAlign:"center"}} accent={D.t4}>
          <div style={{fontSize:40,marginBottom:16,opacity:0.3}}>⚔</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:D.t4}}>No interview requests yet</div>
        </Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {myRequests.map(r=>{
            const stu=students.find(s=>s.id===r.studentId);
            return(
              <Card key={r.id} accent={r.status==="approved"?D.green:r.status==="rejected"?D.red:D.amber} style={{padding:24}}>
                <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${stu?TIER[stu.tier]?.color:D.t4},${stu?TIER[stu.tier]?.color:D.t4}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:900,flexShrink:0}}>{stu?.avatar||"??"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:D.t1}}>{r.studentName}</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.t4,marginTop:2}}>{r.studentRoll} · {r.type.toUpperCase()} Interview · {r.ts}</div>
                    {stu&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:D.t3,marginTop:3}}>Score: {stu.score} · CF: {stu.cfRating} · LC: {stu.easy+stu.medium+stu.hard}</div>}
                  </div>
                  <Chip color={r.status==="approved"?D.green:r.status==="rejected"?D.red:D.amber}>{r.status.toUpperCase()}</Chip>
                  {r.status==="pending"&&(
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={()=>approve(r.id)} style={{padding:"10px 20px",background:`rgba(0,232,122,0.12)`,border:`1px solid rgba(0,232,122,0.3)`,borderRadius:10,color:D.green,fontWeight:700,fontSize:13,cursor:"pointer"}}>Approve ✓</button>
                      <button onClick={()=>reject(r.id)} style={{padding:"10px 20px",background:`rgba(255,61,90,0.1)`,border:`1px solid rgba(255,61,90,0.25)`,borderRadius:10,color:D.red,fontWeight:700,fontSize:13,cursor:"pointer"}}>Reject ✕</button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
