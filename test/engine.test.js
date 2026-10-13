global.window=global;require('../src/topics.js');var E=require('../src/engine.js');
var W=E.loadWords(window.HP_CARDS);var assert=require('assert');
assert(E.isCorrect(W.find(w=>w.w==='象'),'ぞう'));assert(E.isCorrect(W.find(w=>w.w==='弓・弓矢'),'弓矢'));assert(E.isCorrect(W.find(w=>w.w==='タクシー'),'たくしー'));assert(!E.isCorrect(W.find(w=>w.w==='象'),'ねこ'));
// reveal order & scoring
E.setSeed(5);var G=E.newGame([{name:'A'},{name:'B'},{name:'C'},{name:'D'}],W);E.startRound(G);
E.act(G,W,{t:'roll',die:3},null);assert.equal(G.target,G.card[2]);
var L=['L',0,0,10,10];E.act(G,W,{t:'submit',p:1,strokes:[L,L,L]});E.act(G,W,{t:'submit',p:2,strokes:[L]});E.act(G,W,{t:'submit',p:3,strokes:[L,L,L]});
assert.deepEqual(G.order,[2,1,3]);assert.equal(G.phase,'reveal');
E.act(G,W,{t:'guess',text:'xx'});E.act(G,W,{t:'guess',text:W[G.target].w});
assert.deepEqual(G.players.map(p=>p.score),[2,2,0,0]);
E.act(G,W,{t:'next'});assert.equal(G.ans,1);
// tie order from answerer 1: seats 2,3,0 ; all same count
E.act(G,W,{t:'roll'});[0,2,3].forEach(p=>E.act(G,W,{t:'submit',p,strokes:[L]}));assert.deepEqual(G.order,[2,3,0]);
E.act(G,W,{t:'guess',text:'a'});E.act(G,W,{t:'guess',text:'b'});E.act(G,W,{t:'guess',text:'c'});assert.equal(G.phase,'roundEnd');assert(!G.result.ok);
E.act(G,W,{t:'override'},2);assert(G.result.ok&&G.result.k===3&&G.result.drawer===0);assert.deepEqual(G.players.map(p=>p.score),[4,4,0,0]);
E.act(G,W,{t:'next'});E.act(G,W,{t:'roll'});[0,1,3].forEach(p=>E.act(G,W,{t:'submit',p,strokes:[L]}));E.act(G,W,{t:'guess',text:W[G.target].w});assert.equal(G.result.k,1);
E.act(G,W,{t:'next'});E.act(G,W,{t:'roll'});[0,1,2].forEach(p=>E.act(G,W,{t:'submit',p,strokes:[L]}));E.act(G,W,{t:'guess',text:'?'});E.act(G,W,{t:'guess',text:'?'});E.act(G,W,{t:'guess',text:W[G.target].w});
E.act(G,W,{t:'next'});assert.equal(G.phase,'end');console.log('rules ok',G.players.map(p=>p.score));
// CPU sim: hit rates by level vs CPU drawers
for(var lv=0;lv<4;lv++){var hit=0,k=0,N=600;for(var t=0;t<N;t++){var P=[{name:'g',cpu:lv}];for(var d=0;d<3;d++)P.push({name:'d',cpu:lv});var g=E.newGame(P,W);E.startRound(g);E.act(g,W,{t:'roll'});while(g.phase==='reveal')E.act(g,W,{t:'guess',text:E.cpuGuess(g,W,lv)});if(g.result.ok){hit++;k+=g.result.k}}console.log(E.LV[lv],'正解率',(hit/N*100).toFixed(0)+'%','平均枚数',(k/hit).toFixed(2), 'CPU画数', W.slice(0,50).reduce((a,w)=>a+E.cpuDraw(w,lv).length,0)/50)}
