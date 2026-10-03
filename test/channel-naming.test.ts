import {it,expect} from 'vitest';
import {Store} from '../src/storage/database.js';
import {displayTitle,deriveTags,projectStrategy} from '../src/core/projection.js';
import {inScope} from '../src/core/config.js';
it('normalizes att display titles without redundant prefix or changing source names',()=>{
 expect(displayTitle('att-a-practice')).toBe('A Practice');
 expect(displayTitle('attack-a-practice')).toBe('A Practice');
 for(const prefix of ['attack','att','𝗔𝗧𝗧','ATT']) expect(deriveTags(`${prefix}-a-default`)).toEqual(['attack']);
 for(const prefix of ['defense','def','𝗗𝗘𝗙','DEF']) expect(deriveTags(`${prefix}-a-default`)).toEqual(['defense']);
 expect(deriveTags(' 𝗗𝗘𝗙 · a default')).toEqual(['defense']);
 expect(deriveTags('𝗔𝗧𝗧')).toEqual(['attack']);
 expect(deriveTags('default')).toEqual([]);
 expect(deriveTags('attic')).toEqual([]);
 expect(displayTitle('𝗔𝗧𝗧-a-default')).toBe('A Default');
 expect(displayTitle('𝗗𝗘𝗙-a-default')).toBe('A Default');
 expect(displayTitle('𝗔𝗧𝗧')).toBe('Attack');
 expect(displayTitle('def')).toBe('Defense');
});
it('classifies existing Unicode and abbreviated channel snapshots when reading',()=>{
 const store=new Store(':memory:');
 try{
  for(const [id,name,expected] of [['synthetic-maple-a','𝗔𝗧𝗧-𝐁-sample-sequence','attack'],['synthetic-maple-b','𝗗𝗘𝗙-𝐀-sample-control','defense'],['synthetic-cedar-a','att-a-practice','attack'],['synthetic-cedar-b','def-a-practice','defense']] as const){
   const strategy=projectStrategy({channelId:id,categoryId:'category',sourceName:name,messages:[]});
   store.publish({...strategy,tags:[],title:name});
   expect(store.getStrategy(id).tags).toEqual([expected]);
   expect(store.listStrategies().find(s=>s.id===id)?.tags).toEqual([expected]);
  }
 }finally{store.close();}
});
it('hides marker channels from scope and already stored content',()=>{
 const scope={includedCategoryIds:new Set(['category']),excludedChannelIds:new Set<string>()};
 expect(inScope({id:'hidden',categoryId:'category',name:'xxxxxx-divider'},scope)).toBe(false);
 const store=new Store(':memory:');
 try{
  store.publish(projectStrategy({channelId:'hidden',categoryId:'category',sourceName:'XXXXXX-divider',messages:[]}));
  store.publish(projectStrategy({channelId:'visible',categoryId:'category',sourceName:'att-a-default',messages:[]}));
  expect(store.getStrategy('hidden')).toBeNull();
  expect(store.listStrategies().map(s=>s.id)).toEqual(['visible']);
  expect(store.getStrategy('visible').title).toBe('A Default');
  expect(store.getStrategy('visible').sourceName).toBe('att-a-default');
 }finally{store.close();}
});
