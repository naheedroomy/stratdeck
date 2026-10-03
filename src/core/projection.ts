import {createHash} from 'node:crypto';
import type {SourceMessage, Strategy} from './types.js';

export function displayTitle(sourceName:string):string { return sourceName.normalize('NFKC').trim().replace(/^(attack|att|defense|def)(?=$|[^\p{L}\p{N}])/iu,prefix=>/^att/i.test(prefix)?'Attack':'Defense').replace(/[-_]+/g,' ').trim().replace(/\s+/g,' ').replace(/\b\p{L}/gu,c=>c.toLocaleUpperCase()); }
export function deriveTags(name:string):('attack'|'defense')[] {const prefix=name.normalize('NFKC').trim().toLowerCase().match(/^(attack|att|defense|def)(?=$|[^\p{L}\p{N}])/u)?.[1];return prefix? [prefix.startsWith('att')?'attack':'defense']:[];}
export function isEligibleMessage(message:SourceMessage){return !message.authorBot&&!message.webhookId;}
export function projectStrategy(input:{channelId:string;categoryId:string;position?:number;sourceName:string;messages:SourceMessage[];publishedAt?:string;warnings?:string[]}):Strategy {
 const messages=[...input.messages].filter(isEligibleMessage).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||compareSnowflakes(a.id,b.id));
 const overview:Strategy['overview']=[],steps:Strategy['steps']=[]; let active:Strategy['steps'][number]|undefined;
 for(const message of messages){const pics=message.attachments.filter(a=>isImage(a.contentType,a.filename));const imageBearing=message.attachments.some(a=>isImageAttachment(a.contentType,a.filename));
   if(imageBearing){ active={id:message.id,messageIds:[message.id],notes:message.content.trim()?[{messageId:message.id,markdown:message.content}]:[],images:pics.map(a=>({attachmentId:a.id,file:`images/${'0'.repeat(64)}.${extension(a.filename,a.contentType)}`}))}; steps.push(active); continue; }
   if(!message.content.trim()) continue;
   const note={messageId:message.id,markdown:message.content};if(active){active.messageIds.push(message.id);active.notes.push(note);}else overview.push(note);
 }
 const publishedAt=input.publishedAt??new Date().toISOString(); const stableMessages=messages.map(m=>({...m,attachments:m.attachments.map(({url:_url,...metadata})=>metadata)}));const revision=createHash('sha256').update(JSON.stringify({channelId:input.channelId,categoryId:input.categoryId,position:input.position??0,sourceName:input.sourceName,messages:stableMessages})).digest('hex');
 const sourceUpdatedAt=messages.reduce<string|null>((latest,m)=>{const updated=m.editedAt??m.createdAt;return latest===null||updated>latest?updated:latest;},null);
 return {id:input.channelId,categoryId:input.categoryId,position:input.position??0,sourceName:input.sourceName,title:displayTitle(input.sourceName),tags:deriveTags(input.sourceName),overview,steps,sourceMessages:messages.map(m=>({...m,attachments:m.attachments.map(({url: _privateUrl,...metadata})=>metadata)})),revision,sourceUpdatedAt,syncStatus:'current',publishedAt,warnings:input.warnings??[],available:true};
}
function compareSnowflakes(a:string,b:string){try{const x=BigInt(a),y=BigInt(b);return x<y?-1:x>y?1:0;}catch{return a.localeCompare(b);}}
function isImage(mime:string|null,name:string){return /^image\/(png|jpeg|webp)$/i.test(mime??'')||/\.(png|jpe?g|webp)$/i.test(name);}
function isImageAttachment(mime:string|null,name:string){return /^image\//i.test(mime??'')||/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name);}
function extension(name:string,mime:string|null){const ext=name.toLowerCase().split('.').pop();if(ext==='jpeg')return 'jpg';if(['png','jpg','webp'].includes(ext??''))return ext==='jpg'?'jpg':ext!=='undefined'?ext:'png';return mime?.includes('jpeg')?'jpg':mime?.includes('webp')?'webp':'png';}
