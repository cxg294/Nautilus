import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSpeech } from '../../shared/speech-controls.js';
import { alignControlledSpeech } from './speech-alignment.js';
import { listCatalogVoices, getCatalogVoice } from './voice-catalog.js';
const reading={kind:'reading',text:'W3C',alias:'网络协议标准'};
test('plain text remains unchanged and XML only activates for explicit controls',()=>{
 const plain=compileSpeech('a < b & 你');assert.equal(plain.text,'a < b & 你');assert.equal(plain.enabled,false);
 const compiled=compileSpeech('a < b & 你',[{kind:'pause',after:'你',occurrence:1,timeMs:500}]);
 assert.equal(compiled.text,'<speak>a &lt; b &amp; 你<break time="500ms"/></speak>');
});
test('readings affect all occurrences; pauses select one occurrence; originals and Unicode survive',()=>{
 const c=compileSpeech('😀W3C，W3C。',[reading,{kind:'pause',after:'W3C',occurrence:2,timeMs:800}]);
 assert.equal(c.spokenText,'😀网络协议标准，网络协议标准。');
 assert(c.text.includes('<sub alias="网络协议标准">W3C</sub>'));
 assert(c.text.endsWith('<break time="800ms"/>。</speak>'));
 assert.deepEqual(c.characterMap[1],{begin:1,end:4});
});
test('aliases cannot inject XML or remote audio',()=>{
 const c=compileSpeech('示例',[{kind:'reading',text:'示例',alias:'"/><audio src="https://bad"/>'}]);
 assert(!c.text.includes('<audio'));
 assert(c.text.includes('&lt;audio'));
});
test('invalid, absent, overlapping and conflicting controls fail before a provider call',()=>{
 for(const controls of [
  [{kind:'pause',after:'不在正文',timeMs:500}],
  [{kind:'pause',after:'W3C',timeMs:20}],
  [reading,{kind:'reading',text:'3C',alias:'别名'}],
  [reading,{kind:'pause',after:'W3',timeMs:500}],
  [{kind:'pause',after:'W3C',timeMs:500},{kind:'pause',after:'W3C',timeMs:700}],
  [{kind:'unknown'}],
  Array(31).fill(reading)
 ]) assert.throws(()=>compileSpeech('W3C',controls));
});
test('spoken alias timestamps map back to a single original substring across a pause',()=>{
 const c=compileSpeech('你好，W3C！再见。',[reading,{kind:'pause',after:'W3C',timeMs:500}]);
 const chars=Array.from(c.spokenText);
 const words=chars.map((text,i)=>({text,begin_time:i*100+(i>8?500:0),end_time:(i+1)*100+(i>8?500:0)}));
 const result=alignControlledSpeech([{output:{type:'sentence-end',sentence:{index:0,words}}}],c);
 assert.equal(result.sentences[0].text,'你好，W3C！再见。');
 const alias=result.sentences[0].words.find(w=>w.text==='W3C');
 assert.deepEqual([alias.beginIndex,alias.endIndex],[3,6]);
 assert.equal(alias.beginTimeMs,300);assert.equal(alias.endTimeMs,900);
 assert(!result.sentences[0].words.some(w=>w.text.includes('网络')));
});
test('catalog voice IDs are unique, model-specific and preserve capability restrictions',()=>{
 const voices=listCatalogVoices();assert.equal(voices.length,1208);
 assert.equal(new Set(voices.map(v=>v.voice)).size,voices.length);
 assert.equal(voices.filter(v=>v.source==='basic').length,1194);
 assert(voices.every(v=>v.readOnly&&v.status==='OK'));
 assert.equal(getCatalogVoice('longanhuan_v3.6').targetModel,'qwen-audio-3.0-tts-flash');
 assert.equal(getCatalogVoice('longanhuan_v3.6').ssmlSupported,false);
 assert.equal(getCatalogVoice('qwen-audio-3.0-tts-flash-longcanzhuyue').ssmlSupported,true);
});
