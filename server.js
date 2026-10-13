const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const raw = require('./categories');
const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
const rooms = new Map();
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const categories = raw.map(([name,hint,words]) => ({name,hint,valid:new Set(words.map(norm))}));
const freshDeck = () => categories.map((_,i)=>i).sort(()=>Math.random()-.5);
const response = (ack, data) => {if(typeof ack === 'function') ack(data)};
const cleanName = s => String(s || '').trim().slice(0,24) || 'Player';
function roomCode(){let code; do {code=crypto.randomBytes(3).toString('hex').toUpperCase()} while(rooms.has(code));return code;}
function publicState(r){return {code:r.code,phase:r.phase,round:r.round,category:r.category === null ? null : {name:categories[r.category].name,hint:categories[r.category].hint},startedAt:r.startedAt,finishedAt:r.finishedAt,winner:r.winner,players:r.players.map(p=>p?{name:p.name,connected:!!p.socketId,score:p.answers.size,wins:p.wins,answers:[...p.answers]}:null)};}
function broadcast(r){io.to(r.code).emit('state',publicState(r));}
function getSeat(socket){const code=socket.data.code;const r=rooms.get(code);const seat=socket.data.seat;return r && r.players[seat]?.socketId===socket.id?{r,seat,p:r.players[seat]}:null;}
function leaveCurrent(socket){const found=getSeat(socket); if(!found)return; const {r,p}=found; p.socketId=null;socket.leave(r.code);socket.data.code=null; if(r.phase==='playing'){r.phase='waiting';r.startedAt=null;r.category=null;r.players.forEach(v=>{if(v)v.answers.clear()})} broadcast(r);}
io.on('connection', socket=>{
 socket.on('create',({name,token}={},ack)=>{
   leaveCurrent(socket); const code=roomCode();const t=typeof token==='string'&&token.length>=12?token:crypto.randomUUID();
   const r={code,players:[{name:cleanName(name),token:t,socketId:socket.id,answers:new Set(),wins:0},null],phase:'waiting',round:0,category:null,deck:freshDeck(),startedAt:null,finishedAt:null,winner:null};
   rooms.set(code,r);socket.join(code);socket.data={code,seat:0};response(ack,{ok:true,code,seat:0,token:t});broadcast(r);
 });
 socket.on('join',({code,name,token}={},ack)=>{
  code=String(code||'').trim().toUpperCase();const r=rooms.get(code);if(!r){response(ack,{ok:false,error:'Room not found. Check the code.'});return;}
  let seat=r.players.findIndex(p=>p && p.token===token && typeof token==='string');
  if(seat<0){seat=r.players.findIndex(p=>!p);if(seat<0){response(ack,{ok:false,error:'This room already has two players.'});return;}}
  leaveCurrent(socket);
  const old=r.players[seat];if(old?.socketId) io.sockets.sockets.get(old.socketId)?.disconnect(true);
  const t=old?.token || crypto.randomUUID(); r.players[seat]=old?{...old,socketId:socket.id}:{name:cleanName(name),token:t,socketId:socket.id,answers:new Set(),wins:0};
  socket.join(code);socket.data={code,seat};response(ack,{ok:true,code,seat,token:t});broadcast(r);
 });
 socket.on('start',(_,ack)=>{
  const s=getSeat(socket);if(!s)return response(ack,{ok:false,error:'Not in a room.'});const {r,seat}=s;
  if(seat!==0)return response(ack,{ok:false,error:'Only the room host can start rounds.'});
  if(r.phase==='playing')return response(ack,{ok:false,error:'Round already in progress.'});
  if(r.players.some(p=>!p?.socketId))return response(ack,{ok:false,error:'Both players must be connected.'});
  if(!r.deck.length)r.deck=freshDeck();if(r.deck.length>1 && r.deck.at(-1)===r.category){const last=r.deck.pop();r.deck.unshift(last)}
  r.category=r.deck.pop();r.round++;r.phase='playing';r.winner=null;r.finishedAt=null;r.startedAt=Date.now();r.players.forEach(p=>p.answers.clear());response(ack,{ok:true});broadcast(r);
 });
 socket.on('answer',({answer}={},ack)=>{
  const s=getSeat(socket);if(!s)return response(ack,{ok:false,error:'Not connected to room.'});const {r,seat,p}=s;
  if(r.phase!=='playing')return response(ack,{ok:false,error:'Round not active.'});
  const word=norm(answer);if(!word||word.length>80)return response(ack,{ok:false,error:'Enter a shorter answer.'});
  if(!categories[r.category].valid.has(word))return response(ack,{ok:false,error:'Not on the accepted-answer list. Try another!'});
  if(p.answers.has(word))return response(ack,{ok:false,error:'You already used that answer.'});
  p.answers.add(word);if(p.answers.size===10){r.winner=seat;r.phase='finished';r.finishedAt=Date.now();p.wins++}
  response(ack,{ok:true});broadcast(r);
 });
 socket.on('disconnect',()=>leaveCurrent(socket));
});
setInterval(()=>{for(const [code,r] of rooms){if(r.players.every(p=>!p?.socketId))rooms.delete(code)}},60*60*1000).unref();
const port=process.env.PORT||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Category Clash running on port ${port}`));
