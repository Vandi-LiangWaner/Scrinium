"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

export type Card = {
  kind?: "paper"|"author"|"journal"|"topic"|"project";
  id: number; title: string; authors: string; year: string; journal: string; doi: string;
  topics: string[]; keywords: string[]; projects: string[]; status: string; categories?: string[];
  findings: string; methods: string; limitations: string; notes: string; link: string;
  quartile?: string; impactFactor?: string; acceptanceRate?: string; medianFirstDecision?: string;
  createdAt?: number;
  images?: {id:number; name:string; data:string}[];
  subtopics?: string[];
};

const seed: Card[] = [
  { id: 1, title: "Attention Is All You Need", authors: "Vaswani, A. et al.", year: "2017", journal: "NeurIPS", doi: "10.48550/arXiv.1706.03762", topics: ["machine learning", "language"], keywords: ["transformers", "attention"], projects: ["Thesis"], status: "Read", findings: "A sequence model based entirely on attention achieves strong translation results while training more efficiently than recurrent architectures.", methods: "Encoder–decoder architecture using stacked multi-head self-attention and position-wise feed-forward layers.", limitations: "Evaluated primarily on machine translation; quadratic attention cost with sequence length.", notes: "The clean architectural separation makes this useful as a baseline. Revisit positional encoding choices.", link: "https://arxiv.org/abs/1706.03762" },
  { id: 2, title: "The Magical Number Seven, Plus or Minus Two", authors: "Miller, G. A.", year: "1956", journal: "Psychological Review", doi: "10.1037/h0043158", topics: ["cognition"], keywords: ["memory", "chunking"], projects: ["Memory review"], status: "Annotated", findings: "Immediate memory span has practical limits, while recoding information into chunks can expand effective capacity.", methods: "Synthesis of experiments on absolute judgment and immediate memory.", limitations: "The popular seven-item interpretation overstates a nuanced argument.", notes: "Useful historically, but pair with Cowan's later estimate and modern replication work.", link: "" },
  { id: 3, title: "The Capacity of Visual Working Memory", authors: "Luck, S. J. & Vogel, E. K.", year: "1997", journal: "Nature", doi: "10.1038/36846", topics: ["cognition", "perception"], keywords: ["working memory", "visual change"], projects: ["Memory review"], status: "To read", findings: "Visual working memory appears limited by the number of integrated objects rather than individual features.", methods: "Change-detection experiments manipulating features and object counts.", limitations: "Capacity estimates depend on task assumptions and measurement model.", notes: "Compare object-slot account with resource models.", link: "" },
  { id: 4, title: "Situated Knowledges", authors: "Haraway, D.", year: "1988", journal: "Feminist Studies", doi: "10.2307/3178066", topics: ["epistemology"], keywords: ["objectivity", "standpoint"], projects: ["Methods chapter"], status: "Read", findings: "Responsible knowledge is partial, located, and embodied rather than produced from an impossible view from nowhere.", methods: "Theoretical and critical essay.", limitations: "Offers an epistemological position rather than an operational empirical framework.", notes: "Strong language for framing researcher positionality without abandoning objectivity.", link: "" },
  { id: 5, title: "Designing for Interaction", authors: "Saffer, D.", year: "2010", journal: "New Riders", doi: "", topics: ["design"], keywords: ["interaction", "affordance"], projects: ["Card box"], status: "Annotated", findings: "Good interaction design makes available actions perceptible and supports users through feedback and constraints.", methods: "Practice-based synthesis with product examples.", limitations: "Examples age faster than the underlying principles.", notes: "The card itself should be the editing surface—avoid a separate settings form.", link: "" },
  { id: 6, title: "Personal Knowledge Models", authors: "Jones, W.", year: "2007", journal: "Communications of the ACM", doi: "10.1145/1216016.1216022", topics: ["knowledge work"], keywords: ["personal information", "organization"], projects: ["Card box"], status: "To read", findings: "Personal information systems should fit the structures people naturally use to organize their work.", methods: "Conceptual review of personal information management research.", limitations: "Broad framework with limited longitudinal validation.", notes: "Potential rationale for overlapping, non-exclusive groupings.", link: "" },
  { id: 101, kind:"author", title:"Donna Haraway", authors:"University of California, Santa Cruz", year:"1944–", journal:"History of Consciousness", doi:"", topics:["feminist theory","science studies"], keywords:["situated knowledge","cyborg"], projects:[], status:"", findings:"Scholar of science and technology studies whose work examines how knowledge, bodies, and technologies are situated within relations of power.", methods:"Interdisciplinary critical theory, feminist epistemology, and cultural analysis.", limitations:"", notes:"Connect to the paper card for Situated Knowledges and the methods chapter.", link:"https://histcon.ucsc.edu/faculty/haraway.html" },
  { id: 201, kind:"journal", title:"Nature", authors:"Springer Nature", year:"1869–", journal:"Weekly · London", doi:"", topics:["multidisciplinary science"], keywords:["high impact","general science"], projects:[], status:"", findings:"International weekly journal publishing peer-reviewed research across science and technology.", methods:"", limitations:"Broad scope and highly selective editorial process.", notes:"Track relevant cognition and methods papers.", link:"https://www.nature.com/" },
];

const defaultStatuses = ["To read", "Reading", "Read", "Annotated"];
const blank = (kind:"paper"|"author"|"journal"|"topic"|"project"): Card => ({ id: Date.now(), createdAt:Date.now(), kind, title: kind==="paper"?"Untitled paper":kind==="author"?"Unnamed author":kind==="journal"?"Untitled journal":kind==="project"?"Untitled project":"Untitled topic", authors: "", year: "", journal: "", doi: "", topics: [], keywords: [], projects: [], status: "", categories:[], findings: "", methods: "", limitations: "", notes: "", link: "", subtopics:[] });
const split = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
const plain = (s:string) => s.replace(/\r?\n|\t/g," ").replace(/<\s*br\s*\/?\s*>/gi,"\n").replace(/<\/(?:p|div|li)>/gi,"\n").replace(/<li[^>]*>/gi,"• ").replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\n{3,}/g,"\n\n").trim();
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]||ch));
const authorParts=(value:string)=>value.split(/\s*;\s*|\s*\n+\s*|\s+(?:&|and)\s+/i).map(name=>name.trim()).filter(Boolean);
const normalizeAuthorText=(value:string)=>value.normalize("NFKC").replace(/[.,]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase();
const singleAuthorIdentity=(name:string)=>{if(name.includes(",")){const [last,...rest]=name.split(",");return normalizeAuthorText(`${rest.join(" ")} ${last}`)}const words=name.trim().split(/\s+/);return normalizeAuthorText(`${words.slice(0,-1).join(" ")} ${words.at(-1)||""}`)};
const authorIdentity=(value:string)=>authorParts(value).map(singleAuthorIdentity).filter(Boolean).join(";");
const sameStrings=(left:string[],right:string[])=>left===right||(left.length===right.length&&left.every((value,index)=>value===right[index]));
const samePaths=(left:string[][],right:string[][])=>left===right||(left.length===right.length&&left.every((path,index)=>sameStrings(path,right[index])));
const authorSortKey=(value:string)=>{const first=authorParts(value)[0]||"";if(first.includes(","))return first.toLowerCase();const words=first.trim().split(/\s+/);return `${words.at(-1)||""}, ${words.slice(0,-1).join(" ")}`.toLowerCase()};
const cardCategories=(card:Card)=>Array.from(new Map([...(card.categories||[]),...(card.status?[card.status]:[])].map(value=>[value.trim().toLowerCase(),value.trim()] as const).filter(([key])=>key)).values());
const withCategories=(card:Card,categories:string[]):Card=>{const next=Array.from(new Map(categories.map(value=>[value.trim().toLowerCase(),value.trim()] as const).filter(([key])=>key)).values());return {...card,categories:next,status:next[0]||""}};
const duplicateTitleKey=(card:Card)=>{if((card.kind||"paper")!=="paper")return "";const title=plain(card.title).toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu," ").trim();return !title||title==="untitled paper"?"":title};
function canonicalAuthors(cards:Card[]){
  const authors=new Map<string,string>();
  cards.forEach(card=>getCardMeta(card).authors.forEach(({id,label})=>{const previous=authors.get(id);const score=(value:string)=>/[a-z]/.test(value)?2:/[A-Z]/.test(value)?1:0;if(!previous||score(label)>score(previous))authors.set(id,label)}));
  return Array.from(authors.values()).sort((a,b)=>authorSortKey(a).localeCompare(authorSortKey(b)));
}
const firstAuthor=(value:string)=>value.split(/\s*;\s*|\s+(?:&|and)\s+/i).map(v=>v.trim()).filter(Boolean)[0]?.replace(/\s+et\s+al\.?$/i,"")||"";
const yearNumber=(value:string)=>Number(value.match(/\b\d{4}\b/)?.[0]||0);
const createdTime=(card:Card)=>card.createdAt||(card.id>1_000_000_000_000?card.id:0);
const cardSearchText=(c:Card,categories=cardCategories(c))=>[c.title,c.authors,c.year,c.journal,c.doi,c.keywords.join(" "),c.projects.join(" "),categories.join(" "),plain(c.findings),c.methods,c.limitations,plain(c.notes),c.link,c.quartile,c.impactFactor,c.acceptanceRate,c.medianFirstDecision].join(" ").toLowerCase();
type LibraryState={cards:Card[];statuses:string[];topicOrder:string[]};
type GroupBy="all"|"status"|"keyword"|"project"|"author";
type CardMeta={search:string;authors:{id:string;label:string}[];authorIds:string[];categories:string[];duplicateKey:string;keywords:string[];sortAuthor:string;sortKeyword:string;sortTitle:string;sortTopic:string;created:number};
const cardMetaCache=new WeakMap<Card,CardMeta>();
function getCardMeta(card:Card){
  const cached=cardMetaCache.get(card);if(cached)return cached;
  const categories=cardCategories(card),authors=Array.from(new Map(authorParts(card.authors).map(label=>({id:singleAuthorIdentity(label),label})).filter(author=>author.id).map(author=>[author.id,author])).values()),keywords=Array.from(new Set(card.keywords.filter(Boolean)));
  const meta:CardMeta={search:cardSearchText(card,categories),authors,authorIds:authors.map(author=>author.id),categories,duplicateKey:duplicateTitleKey(card),keywords,sortAuthor:authorSortKey(card.authors),sortKeyword:(keywords[0]||"Untagged").toLocaleLowerCase(),sortTitle:card.title.toLocaleLowerCase(),sortTopic:(card.projects.join(" > ")||"Unfiled").toLocaleLowerCase(),created:createdTime(card)};
  cardMetaCache.set(card,meta);return meta;
}
let browserDbPromise:Promise<IDBDatabase|null>|null=null;
function openBrowserDatabase(){
  if(typeof indexedDB==="undefined")return Promise.resolve(null);
  if(!browserDbPromise)browserDbPromise=new Promise(resolve=>{const request=indexedDB.open("literature-box",1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("state"))request.result.createObjectStore("state")};request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null)});
  return browserDbPromise;
}
async function loadBrowserState(){
  const db=await openBrowserDatabase();
  if(db){const stored=await new Promise<unknown>(resolve=>{const request=db.transaction("state","readonly").objectStore("state").get("main");request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null)});if(stored)return stored}
  const legacy=localStorage.getItem("literature-box-cards");if(legacy)try{return JSON.parse(legacy)}catch{}
  return null;
}
async function saveBrowserState(state:LibraryState){
  const db=await openBrowserDatabase();
  if(db){await new Promise<void>((resolve,reject)=>{const transaction=db.transaction("state","readwrite");transaction.objectStore("state").put(state,"main");transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});return}
  localStorage.setItem("literature-box-cards",JSON.stringify(state));
}
let serializerWorker:Worker|null=null,serializerSequence=0;
const serializerRequests=new Map<number,{resolve:(json:string)=>void;reject:(error:Error)=>void}>();
function stringifyOffThread(value:unknown){
  if(typeof Worker==="undefined")return Promise.resolve(JSON.stringify(value));
  if(!serializerWorker){const source=`self.onmessage=function(event){try{self.postMessage({id:event.data.id,json:JSON.stringify(event.data.value)})}catch(error){self.postMessage({id:event.data.id,error:String(error)})}}`;const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));serializerWorker=new Worker(url);URL.revokeObjectURL(url);serializerWorker.onmessage=event=>{const pending=serializerRequests.get(event.data.id);if(!pending)return;serializerRequests.delete(event.data.id);event.data.error?pending.reject(new Error(event.data.error)):pending.resolve(event.data.json)}}
  const id=++serializerSequence;return new Promise<string>((resolve,reject)=>{serializerRequests.set(id,{resolve,reject});serializerWorker!.postMessage({id,value})});
}
const limitRichBlankLines=(html:string)=>html.replace(/(?:(?:<(?:p|div)>\s*(?:(?:&nbsp;|&#160;|<br>)\s*)*<\/(?:p|div)>)){3,}/gi,"<p><br></p><p><br></p>");
function cleanRichHtml(html:string){
  const box=document.createElement("div");box.innerHTML=html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi,"").replace(/<xml[\s\S]*?<\/xml>/gi,"");
  box.querySelectorAll("script,style,meta,link,img,xml,head,title").forEach(node=>node.remove());
  box.querySelectorAll("*").forEach(node=>{const tag=node.tagName.toLowerCase();if(tag.includes(":")){node.remove();return}const style=node.getAttribute("style")||"",doubleUnderline=node.classList.contains("double-underline")||(/text-decoration[^;]*underline/i.test(style)&&/double/i.test(style));if(/font-weight\s*:\s*(?:bold|[6-9]00)/i.test(style)){const strong=document.createElement("strong");strong.append(...Array.from(node.childNodes));node.append(strong)}if(/font-style\s*:\s*italic/i.test(style)){const em=document.createElement("em");em.append(...Array.from(node.childNodes));node.append(em)}[...node.attributes].forEach(attribute=>node.removeAttribute(attribute.name));if(tag==="span"&&doubleUnderline)node.setAttribute("class","double-underline");else if(!["b","strong","i","em","ul","ol","li","p","div","br"].includes(tag))node.replaceWith(...Array.from(node.childNodes))});
  return limitRichBlankLines(box.innerHTML.replace(/\r?\n|\t/g," ").replace(/ {2,}/g," "));
}
function allowTab(e:React.KeyboardEvent<HTMLTextAreaElement>){if(e.key!=="Tab")return;e.preventDefault();const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;const next=`${el.value.slice(0,start)}\t${el.value.slice(end)}`;const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")?.set;setter?.call(el,next);el.dispatchEvent(new Event("input",{bubbles:true}));requestAnimationFrame(()=>el.setSelectionRange(start+1,start+1))}
function HighlightText({text,term}:{text:string;term:string}){
  const needle=term.trim();
  if(!needle)return <>{text}</>;
  const escaped=needle.replace(/[|\\{}()[\]^$+*?.-]/g,"\\$&");
  const parts=text.split(new RegExp(`(${escaped})`,"gi"));
  return <>{parts.map((part,i)=>i%2?<mark className="search-highlight" key={i}>{part}</mark>:part)}</>;
}
function safeRichHtml(value:string,term=""){
  let safe=limitRichBlankLines(value.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi,"").replace(/<!--[\s\S]*?-->/g,"").replace(/<xml[\s\S]*?<\/xml>/gi,"").replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<\/?(?:o|w|m):[^>]*>/gi,"").replace(/\r?\n|\t/g," ").replace(/<span\b[^>]*class=["']double-underline["'][^>]*>/gi,'<span class="double-underline">').replace(/<(b|strong|i|em|ul|ol|li|p|div)\b[^>]*>/gi,"<$1>").replace(/<br\b[^>]*>/gi,"<br>").replace(/<(?!\/?(?:b|strong|i|em|ul|ol|li|p|div|br|span)\b)[^>]*>/gi,"").replace(/<span(?! class="double-underline">)[^>]*>/gi,""));
  const needle=term.trim();if(!needle)return safe;
  const escaped=needle.replace(/[|\\{}()[\]^$+*?.-]/g,"\\$&"),matcher=new RegExp(`(${escaped})`,"gi");
  return safe.split(/(<[^>]+>)/g).map(part=>part.startsWith("<")?part:part.replace(matcher,'<mark class="search-highlight">$1</mark>')).join("");
}
function RichPreview({html,term="",className="",inline=false}:{html:string;term?:string;className?:string;inline?:boolean}){let rendered=safeRichHtml(html,term);if(inline)rendered=rendered.replace(/<(?:p|div|ul|ol)>/gi,"").replace(/<li>/gi,"• ").replace(/<\/(?:p|div|li|ul|ol)>/gi,"<br>").replace(/(?:<br>\s*)+$/gi,"");return <div className={className} dangerouslySetInnerHTML={{__html:rendered}}/>}
function searchExcerpt(text:string,term:string){const needle=term.trim().toLowerCase();const index=text.toLowerCase().indexOf(needle);if(index<0)return text;const start=Math.max(0,index-58),end=Math.min(text.length,index+needle.length+82);return `${start?"…":""}${text.slice(start,end).trim()}${end<text.length?"…":""}`}
function parseCitation(raw:string):Partial<Card>{
  const text=raw.replace(/\s+/g," ").trim();
  if(!text)return{};
  const doiMatch=text.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[\w.()/:;-]+)/i);
  const yearMatch=text.match(/\((\d{4}[a-z]?)\)|\b(1[5-9]\d{2}|20\d{2})[a-z]?\b/i);
  const year=(yearMatch?.[1]||yearMatch?.[2]||"").slice(0,4);
  const yearIndex=yearMatch?.index??-1;
  let authors=yearIndex>0?text.slice(0,yearIndex).replace(/[\s.,;:]+$/g,""):"";
  authors=authors.replace(/\s+(?:&|and)\s+/gi,"; ").replace(/\s*;\s*/g,"; ");
  const apaNames=authors.match(/(?:[\p{L}'’-]+(?:\s+[\p{L}'’-]+)*,\s*(?:[A-Z]\.?\s*){1,4})/gu);
  if(apaNames&&apaNames.length>1)authors=apaNames.map(name=>name.trim().replace(/[,.\s]+$/,"" )).join("; ");
  let remainder=yearIndex>=0?text.slice(yearIndex+(yearMatch?.[0].length||0)):text;
  remainder=remainder.replace(/^[\s.,;:()]+/,"").replace(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/[\w.()/:;-]+\.?/ig,"").trim();
  const quoted=remainder.match(/^[“\"']([^”\"']+)[”\"'][,.]?\s*(.*)$/);
  let title="",journal="";
  if(quoted){title=quoted[1].trim();journal=quoted[2].split(/,\s*(?:vol\.?|no\.?|pp?\.?|\d+\s*\()/i)[0].replace(/[.,\s]+$/g,"").trim()}
  else {const parts=remainder.split(/\.\s+(?=[A-Z])/).map(p=>p.trim()).filter(Boolean);title=(parts.shift()||"").replace(/[.\s]+$/g,"");journal=(parts.shift()||"").split(/,\s*(?:vol\.?|no\.?|pp?\.?|\d+\s*\()/i)[0].replace(/[.,\s]+$/g,"").trim()}
  return {authors,year,title,journal,doi:doiMatch?.[1]?.replace(/[.)]+$/g,"")||""};
}

function DraftInput({value,onCommit,...props}:{value:string;onCommit:(value:string)=>void}&Omit<InputHTMLAttributes<HTMLInputElement>,"value"|"onChange">){
  const [draft,setDraft]=useState(value),ref=useRef<HTMLInputElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{if(document.activeElement!==ref.current)setDraft(value)},[value]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  const queue=(next:string)=>{setDraft(next);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>onCommit(next),500)};
  const finish=(next=draft)=>{if(timer.current)clearTimeout(timer.current);onCommit(next)};
  return <input {...props} ref={ref} value={draft} onChange={event=>queue(event.target.value)} onBlur={event=>{finish(event.currentTarget.value);props.onBlur?.(event)}}/>;
}
function DraftTextarea({value,onCommit,...props}:{value:string;onCommit:(value:string)=>void}&Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,"value"|"onChange">){
  const [draft,setDraft]=useState(value),ref=useRef<HTMLTextAreaElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{if(document.activeElement!==ref.current)setDraft(value)},[value]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  const queue=(next:string)=>{setDraft(next);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>onCommit(next),500)};
  const finish=(next=draft)=>{if(timer.current)clearTimeout(timer.current);onCommit(next)};
  return <textarea {...props} ref={ref} value={draft} onChange={event=>queue(event.target.value)} onBlur={event=>{finish(event.currentTarget.value);props.onBlur?.(event)}}/>;
}
function CitationImporter({onIdentify}:{onIdentify:(fields:Partial<Card>)=>void}){
  const [citation,setCitation]=useState("");
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  const identify=(value:string)=>{setCitation(value);if(timer.current)clearTimeout(timer.current);if(value.trim())timer.current=setTimeout(()=>onIdentify(parseCitation(value)),500)};
  return <label className="citation-importer">Paste text citation<textarea value={citation} placeholder="Paste an APA, Harvard, or similar bibliography entry…" onChange={e=>identify(e.target.value)}/><small className="field-help">Title, authors, year, journal, and DOI are identified automatically. Check the fields below before closing.</small></label>;
}
function RichField({label,value,onChange}:{label:string,value:string,onChange:(v:string)=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{const editor=ref.current;if(editor&&document.activeElement!==editor&&editor.innerHTML!==value)editor.innerHTML=value},[value]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  const commit=(html:string,immediate=false)=>{if(timer.current)clearTimeout(timer.current);if(immediate)onChange(html);else timer.current=setTimeout(()=>onChange(html),500)};
  const doubleUnderline=()=>{const editor=ref.current,selection=window.getSelection();if(!editor||!selection||!selection.rangeCount)return;const range=selection.getRangeAt(0);if(range.collapsed||!editor.contains(range.commonAncestorContainer))return;const span=document.createElement("span");span.className="double-underline";try{range.surroundContents(span)}catch{span.append(range.extractContents());range.insertNode(span)}selection.removeAllRanges();const next=document.createRange();next.selectNodeContents(span);selection.addRange(next);editor.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"formatUnderline"}))};
  return <div className="rich-label"><span className="rich-title">{label}</span><span className="rich-tools">
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("bold")}}><b>B</b></button>
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("italic")}}><i>I</i></button>
    <button type="button" className="double-underline-tool" title="Double underline" aria-label="Double underline" onMouseDown={e=>{e.preventDefault();doubleUnderline()}}>U</button>
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("insertUnorderedList")}}>• List</button>
  </span><div ref={ref} className="rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label={label} aria-multiline="true" onKeyDown={e=>{if(e.key==="Tab"){e.preventDefault();document.execCommand("insertHTML",false,"&nbsp;&nbsp;&nbsp;&nbsp;")}}} onPaste={e=>{if(Array.from(e.clipboardData.files).some(file=>file.type.startsWith("image/")))return;e.preventDefault();const html=e.clipboardData.getData("text/html");document.execCommand(html?"insertHTML":"insertText",false,html?cleanRichHtml(html):e.clipboardData.getData("text/plain"))}} onInput={e=>commit(e.currentTarget.innerHTML)} onBlur={e=>commit(e.currentTarget.innerHTML,true)}/></div>
}

function TagField({label,values,onChange,suggestions=[]}:{label:string;values:string[];onChange:(values:string[])=>void;suggestions?:string[]}) {
  const [text,setText]=useState(values.join(", "));
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==input.current)setText(values.join(", "))},[values]);
  const commit=()=>{const parsed=split(text);setText(parsed.join(", "));onChange(parsed)};
  return <label>{label}<input ref={input} value={text} placeholder="Separate tags with commas" onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();input.current?.blur()}}}/>{suggestions.some(s=>!values.includes(s))&&<span className="tag-suggestions">{suggestions.filter(s=>!values.includes(s)).slice(0,10).map(s=><button type="button" key={s} onMouseDown={e=>e.preventDefault()} onClick={()=>{const next=[...values,s];setText(next.join(", "));onChange(next)}}>＋ {s}</button>)}</span>}</label>;
}

function ProjectField({values,onChange,suggestions=[]}:{values:string[];onChange:(values:string[])=>void;suggestions?:string[][]}) {
  const [text,setText]=useState(values.join(" > "));
  const [menuOpen,setMenuOpen]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==input.current)setText(values.join(" > "))},[values]);
  const commit=()=>{const levels=text.split(">").map(x=>x.trim()).filter(Boolean).slice(0,5);setText(levels.join(" > "));onChange(levels)};
  const needle=(text.trim()===values.join(" > ")?"":text.trim()).toLowerCase();
  const available=suggestions.filter(path=>path.length&&path.join(" > ")!==values.join(" > ")&&(!needle||path.join(" > ").toLowerCase().includes(needle)));
  const choose=(path:string[])=>{const next=path.slice(0,5);setText(next.join(" > "));onChange(next);setMenuOpen(false)};
  return <label className="project-field">Topic hierarchy<input ref={input} value={text} role="combobox" aria-expanded={menuOpen} aria-controls="topic-path-options" autoComplete="off" placeholder="Topic > Subtopic > Section (5 levels max)" onFocus={()=>setMenuOpen(true)} onChange={e=>{setText(e.target.value);setMenuOpen(true)}} onBlur={()=>{commit();setTimeout(()=>setMenuOpen(false),100)}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();setMenuOpen(false);input.current?.blur()}else if(e.key==="Escape")setMenuOpen(false)}}/>{menuOpen&&available.length>0&&<div id="topic-path-options" className="topic-path-dropdown" role="listbox" onMouseDown={e=>e.preventDefault()}>{available.map(path=><button type="button" role="option" aria-selected={false} key={path.join("/")} onClick={()=>choose(path)}>{path.map((level,index)=><span key={`${level}-${index}`} style={{paddingLeft:`${index*10}px`}}>{index?"› ":""}{level}</span>)}</button>)}</div>}<small className="field-help">Separate levels with &gt;, or choose an existing topic from the scrollable menu.</small></label>;
}

type TopicNode={name:string;path:string[];children:TopicNode[]};
type TopicDropPlacement="before"|"inside"|"after";
function buildTopicTree(paths:string[][],customOrder:string[]){
  type TopicBranch={name:string;path:string[];children:Map<string,TopicBranch>};
  const root=new Map<string,TopicBranch>();
  paths.forEach(path=>{let level=root;path.slice(0,5).forEach((name,index)=>{let node=level.get(name);if(!node){node={name,path:path.slice(0,index+1),children:new Map()};level.set(name,node)}level=node.children})});
  const order=new Map(customOrder.map((key,index)=>[key.toLowerCase(),index]));
  const materialize=(branches:Map<string,TopicBranch>):TopicNode[]=>Array.from(branches.values()).sort((a,b)=>(order.get(a.path.join(" > ").toLowerCase())??Number.MAX_SAFE_INTEGER)-(order.get(b.path.join(" > ").toLowerCase())??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name)).map(branch=>({name:branch.name,path:branch.path,children:materialize(branch.children)}));
  return materialize(root);
}
const TopicNavigation=memo(function TopicNavigation({paths,selected,onSelect,onEdit,onDropCard,onReorder,onRename,customOrder,count,total,unfiledCount,showUnfiled,onSelectUnfiled}:{paths:string[][];selected:string[];onSelect:(path:string[])=>void;onEdit:()=>void;onDropCard:(id:number,path:string[])=>void;onReorder:(source:string[],target:string[],placement:TopicDropPlacement)=>void;onRename:(path:string[],name:string)=>void;customOrder:string[];count:(path:string[])=>number;total:number;unfiledCount:number;showUnfiled:boolean;onSelectUnfiled:()=>void}){
  const [search,setSearch]=useState("");
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set());
  const [renaming,setRenaming]=useState<string|null>(null);
  const [renameDraft,setRenameDraft]=useState("");
  const [dropTarget,setDropTarget]=useState<{key:string;placement:TopicDropPlacement}|null>(null);
  const tree=useMemo(()=>buildTopicTree(paths,customOrder),[paths,customOrder]);
  const needle=search.trim().toLowerCase();
  const selectedKey=selected.join(" > ");
  const expandedWithSelection=useMemo(()=>{const next=new Set(expanded);selected.forEach((_,index)=>next.add(selected.slice(0,index+1).join(" > ")));return next},[expanded,selected]);
  const matchingKeys=useMemo(()=>{if(!needle)return null;const matches=new Set<string>();const visit=(node:TopicNode):boolean=>{const match=node.name.toLowerCase().includes(needle)||node.children.some(visit);if(match)matches.add(node.path.join(" > "));return match};tree.forEach(visit);return matches},[tree,needle]);
  const toggle=(key:string)=>setExpanded(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next});
  const finishRename=(node:TopicNode)=>{const name=renameDraft.trim();if(name&&name!==node.name)onRename(node.path,name);setRenaming(null)};
  const placementFor=(event:React.DragEvent<HTMLDivElement>):TopicDropPlacement=>{const box=event.currentTarget.getBoundingClientRect(),ratio=(event.clientY-box.top)/Math.max(1,box.height);return ratio<.25?"before":ratio>.75?"after":"inside"};
  const render=(nodes:TopicNode[]):ReactNode=>nodes.filter(node=>!matchingKeys||matchingKeys.has(node.path.join(" > "))).map(node=>{
    const key=node.path.join(" > "),open=matchingKeys?matchingKeys.has(key):expandedWithSelection.has(key),active=key===selectedKey,editing=renaming===key,drop=dropTarget?.key===key?` topic-drop-${dropTarget.placement}`:"";
    return <li key={key}><div className={`${active?"topic-tree-row active":"topic-tree-row"}${drop}`} style={{paddingLeft:`${(node.path.length-1)*17}px`}} draggable={!editing&&!needle}
      onDragStart={e=>{e.stopPropagation();e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("application/x-literature-topic-path",JSON.stringify(node.path));e.dataTransfer.setData("text/plain",JSON.stringify(node.path))}}
      onDragEnd={()=>setDropTarget(null)}
      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDropTarget(current=>current?.key===key?null:current)}}
      onDragOver={e=>{if(!e.dataTransfer.types.includes("application/x-literature-topic-path")&&!e.dataTransfer.types.includes("text/plain"))return;e.preventDefault();e.stopPropagation();const placement=placementFor(e);e.dataTransfer.dropEffect="move";setDropTarget(current=>current?.key===key&&current.placement===placement?current:{key,placement})}}
      onDrop={e=>{e.preventDefault();e.stopPropagation();const source=e.dataTransfer.getData("application/x-literature-topic-path"),placement=placementFor(e);setDropTarget(null);if(source){try{const sourcePath=JSON.parse(source) as string[];onReorder(sourcePath,node.path,placement);if(placement==="inside")setExpanded(current=>new Set(current).add(key))}catch{}return}const id=Number(e.dataTransfer.getData("text/plain"));if(id)onDropCard(id,node.path)}}>
      {node.children.length?<button className="topic-disclosure" aria-label={open?`Collapse ${node.name}`:`Expand ${node.name}`} onClick={()=>toggle(key)}>{open?"▾":"▸"}</button>:<span className="topic-leaf"/>}
      {editing?<input className="topic-rename-input" autoFocus value={renameDraft} onChange={e=>setRenameDraft(e.target.value)} onBlur={()=>finishRename(node)} onKeyDown={e=>{if(e.key==="Enter")finishRename(node);if(e.key==="Escape")setRenaming(null)}}/>:<button className="topic-name" title={node.name} onClick={()=>onSelect(node.path)}>{node.name}</button>}
      <em className="topic-tree-count">{count(node.path)}</em>{!editing&&<button className="topic-rename" title={`Rename ${node.name}`} aria-label={`Rename ${node.name}`} onClick={()=>{setRenaming(key);setRenameDraft(node.name)}}>✎</button>}<span className="topic-drag" title="Drag before, inside, or after another topic">⋮⋮</span>
    </div>{node.children.length>0&&open&&<ul>{render(node.children)}</ul>}</li>
  });
  return <div className="topic-navigator"><div className="topic-navigator-title"><b>Topics</b><button onClick={onEdit}>＋ Edit</button></div><label className="topic-filter"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter topics"/>{search&&<button aria-label="Clear topic filter" onClick={()=>setSearch("")}>×</button>}</label><button className={!showUnfiled&&!selected.length?"all-topics active":"all-topics"} onClick={()=>onSelect([])}><span>All topics</span><em className="topic-tree-count">{total}</em></button><button className={showUnfiled?"all-topics active":"all-topics"} onClick={onSelectUnfiled}><span>Without topic</span><em className="topic-tree-count">{unfiledCount}</em></button><ul className="topic-tree">{render(tree)}</ul>{!tree.length&&<p className="no-topics">No topics yet. Add one from a card.</p>}</div>;
},(previous,next)=>samePaths(previous.paths,next.paths)&&sameStrings(previous.selected,next.selected)&&sameStrings(previous.customOrder,next.customOrder)&&previous.total===next.total&&previous.unfiledCount===next.unfiledCount&&previous.showUnfiled===next.showUnfiled&&(previous.count===next.count||previous.paths.every(path=>previous.count(path)===next.count(path))));

const ValueNavigation=memo(function ValueNavigation({title,values,selected,onSelect,count,onEdit,onDropCard}:{title:string;values:string[];selected:string;onSelect:(value:string)=>void;count:(value:string)=>number;onEdit?:()=>void;onDropCard?:(id:number,value:string)=>void}){
  const [search,setSearch]=useState("");
  const [order,setOrder]=useState<"name"|"count">("name");
  const [scrollTop,setScrollTop]=useState(0);
  const [viewportHeight,setViewportHeight]=useState(360);
  const listRef=useRef<HTMLDivElement>(null);
  const needle=search.trim().toLowerCase();
  const shown=useMemo(()=>values.filter(value=>value.toLowerCase().includes(needle)).sort((a,b)=>order==="count"?count(b)-count(a)||a.localeCompare(b):a.localeCompare(b)),[values,needle,order,count]);
  useEffect(()=>{const list=listRef.current;if(!list)return;const measure=()=>setViewportHeight(list.clientHeight||360);measure();if(typeof ResizeObserver==="undefined")return;const observer=new ResizeObserver(measure);observer.observe(list);return()=>observer.disconnect()},[]);
  const resetScroll=()=>{setScrollTop(0);if(listRef.current)listRef.current.scrollTop=0};
  const rowHeight=36,overscan=6,start=Math.max(0,Math.floor(scrollTop/rowHeight)-overscan),end=Math.min(shown.length,Math.ceil((scrollTop+viewportHeight)/rowHeight)+overscan),visibleRows=shown.slice(start,end);
  return <div className="value-navigator"><div className="topic-navigator-title"><b>{title}</b>{onEdit&&<button onClick={onEdit}>＋ Edit</button>}</div><label className="topic-filter"><span>⌕</span><input value={search} onChange={e=>{setSearch(e.target.value);resetScroll()}} placeholder={`Filter ${title.toLowerCase()}`}/>{search&&<button aria-label={`Clear ${title.toLowerCase()} filter`} onClick={()=>{setSearch("");resetScroll()}}>×</button>}</label><label className="value-order">Order <select value={order} onChange={e=>{setOrder(e.target.value as "name"|"count");resetScroll()}}><option value="name">A–Z</option><option value="count">Most cards</option></select></label><button className={selected==="All cards"?"value-nav-row active":"value-nav-row"} onClick={()=>onSelect("All cards")}><span>All cards</span></button><div ref={listRef} className="value-nav-list" onScroll={e=>setScrollTop(e.currentTarget.scrollTop)}><div className="virtual-list-spacer" style={{height:`${shown.length*rowHeight}px`}}>{visibleRows.map((value,index)=><button key={value} className={selected===value?"value-nav-row active":"value-nav-row"} style={{position:"absolute",top:`${(start+index)*rowHeight}px`,height:`${rowHeight}px`}} onClick={()=>onSelect(value)} onDragOver={e=>{if(onDropCard)e.preventDefault()}} onDrop={e=>{if(!onDropCard)return;e.preventDefault();const id=Number(e.dataTransfer.getData("text/plain"));if(id)onDropCard(id,value)}}><span title={value}>{value}</span><em>{count(value)}</em></button>)}</div></div>{!shown.length&&<p className="no-topics">No matches.</p>}</div>;
},(previous,next)=>previous.title===next.title&&previous.selected===next.selected&&sameStrings(previous.values,next.values)&&(previous.count===next.count||previous.values.every(value=>previous.count(value)===next.count(value))));

const FacetMenu=memo(function FacetMenu({title,values,count,onSelect}:{title:string;values:string[];count:(value:string)=>number;onSelect:(value:string)=>void}){
  const [open,setOpen]=useState(false),[search,setSearch]=useState(""),[scrollTop,setScrollTop]=useState(0);
  const details=useRef<HTMLDetailsElement>(null),needle=search.trim().toLowerCase(),shown=useMemo(()=>values.filter(value=>value.toLowerCase().includes(needle)),[values,needle]);
  const rowHeight=34,viewportHeight=238,overscan=5,start=Math.max(0,Math.floor(scrollTop/rowHeight)-overscan),end=Math.min(shown.length,Math.ceil((scrollTop+viewportHeight)/rowHeight)+overscan);
  return <details ref={details} className="tag-search facet-menu" onToggle={event=>{const next=event.currentTarget.open;setOpen(next);if(!next){setSearch("");setScrollTop(0)}}}><summary>{title} ▾</summary>{open&&<div className="facet-menu-popover"><label className="facet-menu-filter"><span>⌕</span><input autoFocus value={search} onChange={event=>{setSearch(event.target.value);setScrollTop(0)}} placeholder={`Filter ${title.toLowerCase()}`}/>{search&&<button type="button" aria-label={`Clear ${title.toLowerCase()} filter`} onClick={()=>setSearch("")}>×</button>}</label><div className="facet-menu-list" onScroll={event=>setScrollTop(event.currentTarget.scrollTop)}><div className="virtual-list-spacer" style={{height:`${shown.length*rowHeight}px`}}>{shown.slice(start,end).map((value,index)=><button type="button" key={value} style={{position:"absolute",top:`${(start+index)*rowHeight}px`,height:`${rowHeight}px`}} onClick={()=>{onSelect(value);if(details.current)details.current.open=false}}><span title={value}>{value}</span><em>{count(value)}</em></button>)}</div></div>{!shown.length&&<p className="no-topics">No matches.</p>}</div>}</details>;
},(previous,next)=>previous.title===next.title&&sameStrings(previous.values,next.values)&&(previous.count===next.count||previous.values.every(value=>previous.count(value)===next.count(value))));

export default function Home({initialCards,initialGroupBy="all"}:{initialCards?:Card[];initialGroupBy?:GroupBy}={}) {
  const [cards, setCards] = useState<Card[]>(()=>initialCards||seed.map((c,i)=>withCategories({...c,createdAt:1704067200000+i,keywords:Array.from(new Set([...c.keywords,...c.topics,...(c.subtopics||[])])),topics:[],subtopics:[]},cardCategories(c))));
  const deferredCards=useDeferredValue(cards);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery=useDeferredValue(query);
  const [filter, setFilter] = useState("All cards");
  const [open, setOpen] = useState<Card | null>(null);
  const [sort, setSort] = useState("project");
  const [saved, setSaved] = useState(true);
  const [position, setPosition] = useState(0);
  const [previewExpanded,setPreviewExpanded]=useState(false);
  const [duplicatesOnly,setDuplicatesOnly]=useState(false);
  const [kind, setKind] = useState<"paper"|"author"|"journal"|"project">("paper");
  const [groupBy,setGroupBy]=useState<GroupBy>(initialGroupBy);
  const [projectPath,setProjectPath]=useState<string[]>([]);
  const [introExpanded,setIntroExpanded]=useState(false);
  const [statuses,setStatuses]=useState(defaultStatuses);
  const [topicOrder,setTopicOrder]=useState<string[]>([]);
  const [editingStatuses,setEditingStatuses]=useState(false);
  const [statusDraft,setStatusDraft]=useState(defaultStatuses);
  const [editingValues,setEditingValues]=useState<"keyword"|"project"|null>(null);
  const [valueDraft,setValueDraft]=useState<string[]>([]);
  const [addingCategoryFor,setAddingCategoryFor]=useState<number|null>(null);
  const [newCategoryName,setNewCategoryName]=useState("");
  const [previewImage,setPreviewImage]=useState<{name:string;data:string}|null>(null);
  const [clearingAll,setClearingAll]=useState(false);
  const [clearConfirmation,setClearConfirmation]=useState("");
  const history=useRef<Card[][]>([]);
  const future=useRef<Card[][]>([]);
  const searchRef=useRef<HTMLInputElement>(null);
  const valueTabsRef=useRef<HTMLElement>(null);
  const cardPreviewRef=useRef<HTMLElement>(null);
  const pendingCard=useRef<Card|null>(null);
  const openCardRef=useRef<Card|null>(null);
  const editorCommitTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const saveGeneration=useRef(0);
  const searchCards=useCallback((value:string)=>{setQuery(value);setPosition(0)},[]);
  const selectFilter=useCallback((value:string)=>{setFilter(value);setPosition(0)},[]);

  useEffect(() => {let cancelled=false;(async()=>{let raw:unknown=window.literatureBox?await window.literatureBox.loadCards():await loadBrowserState();if(cancelled)return;const stored=Array.isArray(raw)?raw:(raw as {cards?:Card[]})?.cards;const savedStatuses=!Array.isArray(raw)?(raw as {statuses?:string[]})?.statuses:undefined;const savedTopicOrder=!Array.isArray(raw)?(raw as {topicOrder?:string[]})?.topicOrder:undefined;if(savedStatuses?.length)setStatuses(savedStatuses);if(savedTopicOrder?.length)setTopicOrder(savedTopicOrder);if(stored){const migrated:Card[]=stored.map((c:Card,i:number)=>withCategories({...c,createdAt:c.createdAt||(c.id>1_000_000_000_000?c.id:Date.now()-(stored.length-i)*1000),kind:c.kind||"paper",keywords:Array.from(new Set([...(c.keywords||[]),...(c.topics||[]),...(c.subtopics||[])])),topics:[],subtopics:[]},cardCategories(c)));if(!migrated.some(c=>c.kind==="author"))migrated.push({...seed.find(c=>c.kind==="author")!,createdAt:Date.now(),keywords:Array.from(new Set([...(seed.find(c=>c.kind==="author")?.keywords||[]),...(seed.find(c=>c.kind==="author")?.topics||[])])),topics:[]});if(!migrated.some(c=>c.kind==="journal"))migrated.push({...seed.find(c=>c.kind==="journal")!,createdAt:Date.now(),keywords:Array.from(new Set([...(seed.find(c=>c.kind==="journal")?.keywords||[]),...(seed.find(c=>c.kind==="journal")?.topics||[])])),topics:[]});const existingProjects=new Set(migrated.filter(c=>c.kind==="project").map(c=>c.projects.join(" > ")));const topicNames=Array.from(new Set(migrated.filter(c=>(c.kind||"paper")==="paper").map(c=>c.projects[0]).filter(Boolean)));topicNames.forEach((title,i)=>{if(!existingProjects.has(title))migrated.push({...blank("project"),id:4000+i,title,projects:[title]})});setCards(migrated)}setReady(true)})();return()=>{cancelled=true}}, []);
  useEffect(() => {if(!ready)return;const generation=++saveGeneration.current;setSaved(false);let idleHandle:number|null=null;const scheduler=window as Window&{requestIdleCallback?:(callback:()=>void,options?:{timeout:number})=>number;cancelIdleCallback?:(handle:number)=>void};const timer=setTimeout(()=>{const save=async()=>{if(generation!==saveGeneration.current)return;try{const state:LibraryState={cards,statuses,topicOrder};if(window.literatureBox){const json=await stringifyOffThread(state);if(generation!==saveGeneration.current)return;await window.literatureBox.saveCards(json)}else await saveBrowserState(state);if(generation===saveGeneration.current)setSaved(true)}catch(error){console.error("Literature Box save failed",error)}};if(scheduler.requestIdleCallback)idleHandle=scheduler.requestIdleCallback(()=>void save(),{timeout:1200});else void save()},1400);return()=>{clearTimeout(timer);if(idleHandle!==null)scheduler.cancelIdleCallback?.(idleHandle)}},[cards,statuses,topicOrder,ready]);
  useEffect(()=>()=>{if(editorCommitTimer.current)clearTimeout(editorCommitTimer.current)},[]);
  useEffect(()=>{openCardRef.current=open},[open]);
  useEffect(()=>{const tabs=valueTabsRef.current;if(!tabs)return;const wheel=(event:WheelEvent)=>{if(tabs.scrollWidth<=tabs.clientWidth)return;event.preventDefault();event.stopPropagation();tabs.scrollLeft+=Math.abs(event.deltaY)>Math.abs(event.deltaX)?event.deltaY:event.deltaX};tabs.addEventListener("wheel",wheel,{passive:false});return()=>tabs.removeEventListener("wheel",wheel)},[kind,groupBy]);

  const cardMetadata=useMemo(()=>new Map(deferredCards.map(card=>[card.id,getCardMeta(card)])),[deferredCards]);
  const duplicateTitleCounts=useMemo(()=>{const counts=new Map<string,number>();cardMetadata.forEach(meta=>{if(meta.duplicateKey)counts.set(meta.duplicateKey,(counts.get(meta.duplicateKey)||0)+1)});return counts},[cardMetadata]);
  const queryNeedle=deferredQuery.trim().toLowerCase();
  const duplicateCardCount=useMemo(()=>deferredCards.filter(card=>{const meta=cardMetadata.get(card.id);return meta&&(duplicateTitleCounts.get(meta.duplicateKey)||0)>1&&(!queryNeedle||meta.search.includes(queryNeedle))}).length,[deferredCards,cardMetadata,duplicateTitleCounts,queryNeedle]);
  const visible = useMemo(() => deferredCards.filter(c => {
    const meta=cardMetadata.get(c.id)!;
    const grouped=kind!=="paper"||groupBy==="all"||(groupBy==="project"?(filter==="Without topic"?!c.projects.length:projectPath.every((level,i)=>c.projects[i]===level)):filter==="All cards"||(groupBy==="status"?(filter==="Without category"?!meta.categories.length:meta.categories.some(category=>category.toLowerCase()===filter.toLowerCase())):groupBy==="author"?meta.authorIds.includes(singleAuthorIdentity(filter)):meta.keywords.includes(filter)));
    const duplicateMatch=kind!=="paper"||!duplicatesOnly||(duplicateTitleCounts.get(meta.duplicateKey)||0)>1;
    return (c.kind||"paper")===kind&&grouped&&duplicateMatch&&(!queryNeedle||meta.search.includes(queryNeedle));
  }).sort((a,b)=>{const left=cardMetadata.get(a.id)!,right=cardMetadata.get(b.id)!;return sort==="project"?left.sortTopic.localeCompare(right.sortTopic)||right.created-left.created:sort==="keyword"?left.sortKeyword.localeCompare(right.sortKeyword)||right.created-left.created:sort==="author"?left.sortAuthor.localeCompare(right.sortAuthor):sort==="title"?left.sortTitle.localeCompare(right.sortTitle):sort==="oldest"?left.created-right.created:right.created-left.created}),[deferredCards,cardMetadata,queryNeedle,filter,sort,kind,groupBy,projectPath,duplicatesOnly,duplicateTitleCounts]);
  const deckItems=useMemo(()=>visible.map(card=>({type:"card" as const,card})),[visible]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;const editing=target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();searchRef.current?.focus()}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"){e.preventDefault();addCard()}else if(!openCardRef.current&&!editing&&e.key==="ArrowRight")setPosition(p=>Math.min(deckItems.length-1,p+1));else if(!openCardRef.current&&!editing&&e.key==="ArrowLeft")setPosition(p=>Math.max(0,p-1));else if(!editing&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo()}else if(!editing&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo()}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[deckItems.length,kind]);
  const boundedPosition=Math.min(position,Math.max(deckItems.length-1,0));
  const currentItem=deckItems[boundedPosition];
  const current=currentItem?.type==="card"?currentItem.card:null;
  useEffect(()=>{const card=cardPreviewRef.current;if(!card||previewExpanded)return;const fit=()=>{const finding=card.querySelector<HTMLElement>(".finding.rich-preview"),footer=card.querySelector<HTMLElement>("footer"),tags=card.querySelector<HTMLElement>(".tags"),matches=card.querySelector<HTMLElement>(".search-matches");if(!finding||!footer)return;const lineHeight=parseFloat(getComputedStyle(finding).lineHeight)||24;const reserve=matches?Math.min(62,matches.scrollHeight+10):tags&&tags.children.length?Math.min(62,tags.scrollHeight+22):8;const available=Math.max(lineHeight,footer.getBoundingClientRect().top-finding.getBoundingClientRect().top-reserve);card.style.setProperty("--preview-lines",String(Math.max(1,Math.min(8,Math.floor(available/lineHeight)))))};fit();if(typeof ResizeObserver==="undefined")return;const observer=new ResizeObserver(fit);observer.observe(card);return()=>observer.disconnect()},[current?.id,current?.title,current?.findings,current?.keywords.length,deferredQuery,previewExpanded]);
  const kindCards=useMemo(()=>deferredCards.filter(c=>(c.kind||"paper")===kind),[deferredCards,kind]);
  const matchingKindCards=useMemo(()=>kindCards.filter(card=>{const meta=cardMetadata.get(card.id)!;return(!queryNeedle||meta.search.includes(queryNeedle))&&(kind!=="paper"||!duplicatesOnly||(duplicateTitleCounts.get(meta.duplicateKey)||0)>1)}),[kindCards,cardMetadata,queryNeedle,kind,duplicatesOnly,duplicateTitleCounts]);
  const allTags=useMemo(()=>Array.from(new Set(kindCards.flatMap(c=>getCardMeta(c).keywords))).sort(),[kindCards]);
  const allKeywords=allTags;
  const existingTopicPaths=useMemo(()=>{if(kind!=="paper")return[];const paths=deferredCards.filter(c=>(c.kind||"paper")==="paper"||c.kind==="project").map(c=>c.projects.filter(Boolean).slice(0,5)).filter(path=>path.length);const order=new Map(topicOrder.map((key,index)=>[key.toLowerCase(),index]));return Array.from(new Map(paths.map(path=>[path.join(" > ").toLowerCase(),path])).values()).sort((a,b)=>(order.get(a.join(" > ").toLowerCase())??Number.MAX_SAFE_INTEGER)-(order.get(b.join(" > ").toLowerCase())??Number.MAX_SAFE_INTEGER)||a.join(" > ").localeCompare(b.join(" > ")))},[deferredCards,topicOrder,kind]);
  const allAuthors=useMemo(()=>kind==="paper"?canonicalAuthors(kindCards):[],[kind,kindCards]);
  const groupValues=useMemo(()=>kind!=="paper"?[]:groupBy==="status"?statuses:groupBy==="keyword"?allTags:groupBy==="author"?allAuthors:groupBy==="project"?Array.from(new Set(kindCards.filter(c=>projectPath.every((level,i)=>c.projects[i]===level)).map(c=>c.projects[projectPath.length]).filter(Boolean))).sort():[],[kind,groupBy,statuses,kindCards,projectPath,allTags,allAuthors]);
  const facetCounts=useMemo(()=>{const statusesMap=new Map<string,number>(),keywordsMap=new Map<string,number>(),authorsMap=new Map<string,number>(),topicsMap=new Map<string,number>();matchingKindCards.forEach(card=>{const meta=cardMetadata.get(card.id)!;if(!meta.categories.length)statusesMap.set("",(statusesMap.get("")||0)+1);meta.categories.forEach(value=>statusesMap.set(value.toLowerCase(),(statusesMap.get(value.toLowerCase())||0)+1));meta.keywords.forEach(value=>keywordsMap.set(value,(keywordsMap.get(value)||0)+1));meta.authorIds.forEach(key=>authorsMap.set(key,(authorsMap.get(key)||0)+1));card.projects.forEach((_,i)=>{const key=card.projects.slice(0,i+1).join(" > ");topicsMap.set(key,(topicsMap.get(key)||0)+1)})});return{statusesMap,keywordsMap,authorsMap,topicsMap}},[matchingKindCards,cardMetadata]);
  const groupCount=useCallback((value:string)=>groupBy==="status"?(facetCounts.statusesMap.get(value.toLowerCase())||0):groupBy==="keyword"?(facetCounts.keywordsMap.get(value)||0):groupBy==="author"?(facetCounts.authorsMap.get(singleAuthorIdentity(value))||0):(facetCounts.topicsMap.get([...projectPath,value].join(" > "))||0),[groupBy,facetCounts,projectPath]);
  const keywordFacetCount=useCallback((value:string)=>facetCounts.keywordsMap.get(value)||0,[facetCounts]);
  const authorFacetCount=useCallback((value:string)=>facetCounts.authorsMap.get(singleAuthorIdentity(value))||0,[facetCounts]);
  const topicCount=useCallback((path:string[])=>(facetCounts.topicsMap.get(path.join(" > "))||0),[facetCounts]);
  const collectionCounts=useMemo(()=>{const result={paper:0,author:0,journal:0};deferredCards.forEach(card=>{const cardKind=(card.kind||"paper") as "paper"|"author"|"journal"|"project",meta=cardMetadata.get(card.id)!;if(cardKind==="project")return;if(queryNeedle&&!meta.search.includes(queryNeedle))return;if(cardKind==="paper"&&duplicatesOnly&&(duplicateTitleCounts.get(meta.duplicateKey)||0)<2)return;result[cardKind]++});return result},[deferredCards,cardMetadata,queryNeedle,duplicatesOnly,duplicateTitleCounts]);
  const projectCardsByPath=useMemo(()=>{const map=new Map<string,Card>();if(kind==="paper"&&groupBy==="project")deferredCards.forEach(card=>{if(card.kind==="project")map.set(card.projects.join(" > ")||card.title,card)});return map},[deferredCards,kind,groupBy]);
  const selectedProjectCard=useMemo(()=>projectCardsByPath.get(projectPath.join(" > "))||projectCardsByPath.get(projectPath.at(-1)||""),[projectCardsByPath,projectPath]);
  const topicTrail=useMemo(()=>projectPath.map((level,i)=>{const path=projectPath.slice(0,i+1);return {level,path,card:projectCardsByPath.get(path.join(" > "))||projectCardsByPath.get(level)}}),[projectCardsByPath,projectPath]);

  function change(fn:(cs:Card[])=>Card[],remember=true) { setCards(cs=>{if(remember){history.current.push(cs);future.current=[];if(history.current.length>30)history.current.shift()}return fn(cs)}); }
  function commitOpenCard(card=pendingCard.current){if(editorCommitTimer.current){clearTimeout(editorCommitTimer.current);editorCommitTimer.current=null}if(!card)return;pendingCard.current=null;setCards(current=>current.map(item=>item.id===card.id?card:item));setOpen(current=>current?.id===card.id?card:current)}
  function update(card: Card,immediate=false) { openCardRef.current=card;pendingCard.current=card;if(editorCommitTimer.current)clearTimeout(editorCommitTimer.current);if(immediate)commitOpenCard(card);else editorCommitTimer.current=setTimeout(()=>commitOpenCard(card),650); }
  function patchOpen(fields:Partial<Card>,immediate=false){const current=openCardRef.current;if(current)update({...current,...fields},immediate)}
  function openCard(card:Card){commitOpenCard();pendingCard.current=null;openCardRef.current=card;setOpen(card)}
  function closeCard(){commitOpenCard();openCardRef.current=null;setOpen(null)}
  function removeOpenCard(){if(!open)return;if(editorCommitTimer.current)clearTimeout(editorCommitTimer.current);pendingCard.current=null;openCardRef.current=null;setCards(current=>current.filter(card=>card.id!==open.id));setOpen(null)}
  function undo(){const previous=history.current.pop();if(previous){if(open)setOpen(previous.find(c=>c.id===open.id)||null);setCards(current=>{future.current.push(current);return previous})}}
  function redo(){const next=future.current.pop();if(next){if(open)setOpen(next.find(c=>c.id===open.id)||null);setCards(current=>{history.current.push(current);return next})}}
  function addCard() { commitOpenCard();const c = blank(kind); setCards(cs => [c, ...cs]);openCardRef.current=c;setOpen(c); }
  function selectProjectLevel(level:string){const path=[...projectPath,level].slice(0,5);setProjectPath(path);setPosition(0);setIntroExpanded(false);if(!cards.some(c=>c.kind==="project"&&c.projects.join(" > ")===path.join(" > "))){const project={...blank("project"),id:Date.now(),title:level,projects:path};change(cs=>[project,...cs])}}
  function selectProjectPath(path:string[]){const next=path.slice(0,5);setProjectPath(next);selectFilter("All cards");setIntroExpanded(false);if(next.length&&!cards.some(c=>c.kind==="project"&&c.projects.join(" > ")===next.join(" > "))){const project={...blank("project"),id:Date.now(),title:next.at(-1)||"Topic",projects:next};change(cs=>[project,...cs])}}
  function editCurrentTabs(){if(groupBy==="status"){setStatusDraft(statuses);setEditingStatuses(true);return}setValueDraft(groupValues);setEditingValues(groupBy as "keyword"|"project")}
  function saveEditedValues(){if(!editingValues)return;const before=groupValues;const next=valueDraft.map(value=>value.trim());change(cs=>{const updated=cs.map(card=>{if(editingValues==="keyword"){return {...card,keywords:Array.from(new Set(card.keywords.map(keyword=>{const i=before.indexOf(keyword);return i<0?keyword:(next[i]||"")}).filter(Boolean)))}}if(!projectPath.every((level,i)=>card.projects[i]===level))return card;const old=card.projects[projectPath.length];const i=before.indexOf(old);if(i<0)return card;const projects=[...card.projects];if(next[i])projects[projectPath.length]=next[i];else projects.splice(projectPath.length,1);return {...card,projects,title:card.kind==="project"&&card.projects.length===projectPath.length+1?(next[i]||card.title):card.title}});if(editingValues!=="project")return updated;const additions=next.slice(before.length).filter(Boolean).filter(name=>!before.includes(name)).map((name,i)=>({...blank("project"),id:Date.now()+i,title:name,projects:[...projectPath,name].slice(0,5)}));return [...additions,...updated]});setEditingValues(null)}
  function addCategoryFromCard(card:Card){setNewCategoryName("");setAddingCategoryFor(card.id)}
  function saveNewCategory(){const category=newCategoryName.trim();const card=(open?.id===addingCategoryFor?open:null)||cards.find(c=>c.id===addingCategoryFor);if(!category||!card)return;const existing=statuses.find(s=>s.toLowerCase()===category.toLowerCase())||category;if(!statuses.some(s=>s.toLowerCase()===category.toLowerCase()))setStatuses(current=>[...current,category]);update(withCategories(card,[...cardCategories(card),existing]),true);setAddingCategoryFor(null);setNewCategoryName("")}
  function toggleCategory(card:Card,category:string){const current=cardCategories(card),exists=current.some(value=>value.toLowerCase()===category.toLowerCase());update(withCategories(card,exists?current.filter(value=>value.toLowerCase()!==category.toLowerCase()):[...current,category]))}
  function reorderTopic(source:string[],target:string[],placement:TopicDropPlacement){
    source=source.filter(Boolean).slice(0,5);target=target.filter(Boolean).slice(0,5);
    const same=(left:string[],right:string[])=>left.length===right.length&&left.every((level,index)=>level===right[index]);
    const startsWith=(path:string[],prefix:string[])=>prefix.every((level,index)=>path[index]===level);
    if(!source.length||!target.length||same(source,target)||startsWith(target,source))return;
    const parent=placement==="inside"?target:target.slice(0,-1),newPrefix=[...parent,source[source.length-1]];
    const descendants=existingTopicPaths.filter(path=>startsWith(path,source)),deepestSuffix=Math.max(0,...descendants.map(path=>path.length-source.length));
    if(newPrefix.length+deepestSuffix>5)return;
    const collision=existingTopicPaths.some(path=>startsWith(path,newPrefix)&&!startsWith(path,source));
    if(collision)return;
    const transform=(path:string[])=>startsWith(path,source)?[...newPrefix,...path.slice(source.length)]:path;
    const allPaths=Array.from(new Map(existingTopicPaths.flatMap(path=>path.map((_,index)=>path.slice(0,index+1))).map(path=>[path.join(" > ").toLowerCase(),path])).values());
    const rank=new Map(topicOrder.map((key,index)=>[key.toLowerCase(),index]));
    const ordered=allPaths.sort((a,b)=>(rank.get(a.join(" > ").toLowerCase())??Number.MAX_SAFE_INTEGER)-(rank.get(b.join(" > ").toLowerCase())??Number.MAX_SAFE_INTEGER)||a.join(" > ").localeCompare(b.join(" > ")));
    const moving=ordered.filter(path=>startsWith(path,source)).map(transform),remaining=ordered.filter(path=>!startsWith(path,source));
    let insertion=remaining.length;
    if(placement==="before"){const targetIndex=remaining.findIndex(path=>same(path,target));insertion=targetIndex<0?remaining.length:targetIndex}
    else {const lastTarget=remaining.reduce((last,path,index)=>startsWith(path,target)?index:last,-1);if(lastTarget>=0)insertion=lastTarget+1}
    const nextOrder=[...remaining.slice(0,insertion),...moving,...remaining.slice(insertion)].map(path=>path.join(" > "));
    change(current=>current.map(card=>startsWith(card.projects,source)?{...card,projects:transform(card.projects)}:card));
    setTopicOrder(Array.from(new Set(nextOrder)));
    setProjectPath(current=>startsWith(current,source)?transform(current):current);
  }
  function renameTopic(path:string[],name:string){const clean=name.trim();if(!clean)return;const depth=path.length-1,oldPrefix=path.join(" > "),nextPath=[...path.slice(0,-1),clean],newPrefix=nextPath.join(" > ");change(current=>current.map(card=>{if(!path.every((level,index)=>card.projects[index]===level))return card;const projects=[...card.projects];projects[depth]=clean;return {...card,projects,title:card.kind==="project"&&card.projects.length===path.length?clean:card.title}}));setTopicOrder(current=>Array.from(new Set(current.map(key=>key===oldPrefix||key.startsWith(`${oldPrefix} > `)?`${newPrefix}${key.slice(oldPrefix.length)}`:key))));setProjectPath(current=>path.every((level,index)=>current[index]===level)?[...nextPath,...current.slice(path.length)]:current)}
  async function attachImages(files: FileList) {
    const additions=await Promise.all(Array.from(files).filter(f=>f.type.startsWith("image/")).map(file=>new Promise<{id:number;name:string;data:string}>((resolve,reject)=>{
      const reader=new FileReader(); reader.onerror=reject; reader.onload=()=>{const img=new Image(); img.onerror=reject; img.onload=()=>{const max=1600, scale=Math.min(1,max/Math.max(img.width,img.height)); const canvas=document.createElement("canvas"); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale); canvas.getContext("2d")?.drawImage(img,0,0,canvas.width,canvas.height); resolve({id:Date.now()+Math.random(),name:file.name,data:canvas.toDataURL("image/jpeg",.82)})}; img.src=String(reader.result)}; reader.readAsDataURL(file)
    })));
    const current=openCardRef.current;if(current&&additions.length) update({...current,images:[...(current.images||[]),...additions]});
  }
  useEffect(()=>{const paste=(event:ClipboardEvent)=>{if(!openCardRef.current)return;const images=Array.from(event.clipboardData?.files||[]).filter(file=>file.type.startsWith("image/"));if(!images.length)return;event.preventDefault();const transfer=new DataTransfer();images.forEach(file=>transfer.items.add(file));attachImages(transfer.files)};window.addEventListener("paste",paste);return()=>window.removeEventListener("paste",paste)},[]);
  function download(kind: "json"|"csv"|"md"|"doc", suppliedBody="") {
    let body = "", type = "text/plain";
    if(kind==="doc"){body=suppliedBody;type="application/msword"}
    if (kind === "json") { body = JSON.stringify({version:3,statuses,topicOrder,cards}, null, 2); type = "application/json"; }
    if (kind === "csv") { const keys = Object.keys(cards[0]) as (keyof Card)[]; body = [keys.join(","), ...cards.map(c => keys.map(k => `"${String(Array.isArray(c[k]) ? (c[k] as string[]).join("; ") : c[k]).replaceAll('"','""')}"`).join(","))].join("\n"); type="text/csv"; }
    if (kind === "md") body = cards.map(c => `# ${c.title}\n\n**${c.authors} (${c.year})** — ${c.journal}\n\n## Key findings\n${c.findings}\n\n## Methods\n${c.methods}\n\n## Limitations\n${c.limitations}\n\n## My notes\n${c.notes}\n`).join("\n---\n\n");
    if(window.literatureBox){window.literatureBox.exportFile(kind,body);return} const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([body],{type})); a.download=`literature-box.${kind}`; a.click(); URL.revokeObjectURL(a.href);
  }
  async function confirmClearAll(){
    if(clearConfirmation!=="DELETE ALL")return;
    const body=JSON.stringify({version:3,statuses,topicOrder,cards},null,2);
    if(window.literatureBox){const saved=await window.literatureBox.exportFile("json",body);if(saved===false)return}
    else{const a=document.createElement("a");const url=URL.createObjectURL(new Blob([body],{type:"application/json"}));a.href=url;a.download="literature-box-before-delete.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
    if(editorCommitTimer.current)clearTimeout(editorCommitTimer.current);pendingCard.current=null;history.current.push(cards);future.current=[];setCards([]);setOpen(null);setPosition(0);setFilter("All cards");setProjectPath([]);setTopicOrder([]);setClearingAll(false);setClearConfirmation("");
  }
  function topicDocumentContent(){
    const papers=cards.filter(c=>(c.kind||"paper")==="paper").sort((a,b)=>(a.projects.join(" > ")||"Unfiled").localeCompare(b.projects.join(" > ")||"Unfiled")||a.title.localeCompare(b.title));
    let previous:string[]=[];let content="";
    papers.forEach(card=>{const path=card.projects.length?card.projects.slice(0,5):["Unfiled"];path.forEach((level,i)=>{if(previous[i]!==level){content+=`<h${i+1} class="project-heading level-${i+1}">${escapeHtml(level)}</h${i+1}>`}});previous=path;content+=`<article><h2 class="paper-title">${escapeHtml(card.title)}</h2><p class="citation">${escapeHtml(card.authors)}${card.year?` (${escapeHtml(card.year)})`:""}${card.journal?` — <i>${escapeHtml(card.journal)}</i>`:""}</p>${card.doi?`<p class="doi">DOI: ${escapeHtml(card.doi)}</p>`:""}${card.findings?`<div class="paper-section"><b>Key findings:</b> ${card.findings}</div>`:""}${card.images?.length?`<div class="figures">${card.images.map(image=>`<figure><img src="${image.data}"/><figcaption>${escapeHtml(image.name)}</figcaption></figure>`).join("")}</div>`:""}${card.methods?`<p class="paper-section"><b>Method:</b> ${escapeHtml(card.methods)}</p>`:""}${card.limitations?`<p class="paper-section"><b>Limitations:</b> ${escapeHtml(card.limitations)}</p>`:""}${card.notes?`<div class="paper-section"><b>My notes:</b> ${card.notes}</div>`:""}</article>`});
    return content||"<h1>No paper cards</h1>";
  }
  const documentStyles=`body{font:11pt/1.55 Georgia,serif;color:#26211d;max-width:760px;margin:auto}h1{font-size:26pt;border-bottom:2px solid #6f442c;padding-bottom:8px;page-break-before:always}h1:first-child{page-break-before:auto}h2.project-heading{font-size:20pt;color:#60422f;border-bottom:1px solid #b9a58b}h3.project-heading{font-size:16pt;color:#72533d}h4.project-heading,h5.project-heading{font-size:13pt;color:#80644d}.paper-title{font-size:16pt;margin:0 0 5px;border:0;color:#251e19}.citation,.doi{margin:3px 0;color:#655c53}.doi{font-size:9pt}article{margin:20px 0 30px;padding:0 0 20px;border-bottom:1px solid #d8cdbc;page-break-inside:avoid}.paper-section{margin:9px 0}.paper-section>b{color:#5f4d41}.figures{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0}.figures figure{margin:0}.figures img{width:100%;max-height:260px;object-fit:contain}.figures figcaption{font-size:8pt;color:#756b61}`;
  function exportWord(){download("doc",`<!doctype html><html><head><meta charset="utf-8"><title>Literature Box — by topic</title><style>${documentStyles}</style></head><body>${topicDocumentContent()}</body></html>`)}
  function exportPdf(){
    const frame=document.createElement("iframe");frame.style.position="fixed";frame.style.right="0";frame.style.bottom="0";frame.style.width="0";frame.style.height="0";frame.style.border="0";document.body.appendChild(frame);const doc=frame.contentDocument;if(!doc)return;doc.open();doc.write(`<!doctype html><html><head><title>Literature Box — by topic</title><style>@page{margin:20mm}${documentStyles}@media print{body{max-width:none}}</style></head><body>${topicDocumentContent()}</body></html>`);doc.close();setTimeout(()=>{frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),1000)},250)}

  function importJson(file: File) { const r = new FileReader(); r.onload=() => { try { const data=JSON.parse(String(r.result));const imported:Array<Card>|null=Array.isArray(data)?data:Array.isArray(data.cards)?data.cards:null;if(imported)setCards(current=>{const signatures=new Set(current.map(card=>`${card.kind||"paper"}\u0000${card.title.trim().toLowerCase()}\u0000${authorIdentity(card.authors)}\u0000${card.year}`));const ids=new Set(current.map(card=>card.id));let nextId=Date.now();const additions=imported.filter(card=>{const signature=`${card.kind||"paper"}\u0000${card.title.trim().toLowerCase()}\u0000${authorIdentity(card.authors)}\u0000${card.year}`;if(signatures.has(signature))return false;signatures.add(signature);return true}).map((card,i)=>{while(ids.has(nextId))nextId++;const id=ids.has(card.id)?nextId++:card.id;ids.add(id);return withCategories({...card,id,createdAt:card.createdAt||(card.id>1_000_000_000_000?card.id:Date.now()-(imported.length-i)*1000)},cardCategories(card))});return[...additions,...current]});if(!Array.isArray(data)&&Array.isArray(data.statuses))setStatuses(current=>Array.from(new Set([...current,...data.statuses])));if(!Array.isArray(data)&&Array.isArray(data.topicOrder))setTopicOrder(current=>Array.from(new Set([...current,...data.topicOrder]))) } catch { alert("That file is not valid JSON."); } }; r.readAsText(file); }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">L</span><div><h1>The Literature Box</h1><p>{cards.length} cards · stored on this device</p></div></div>
      <div className="top-actions">
        <label className="import-btn">↥ Import<input type="file" accept=".json" onChange={e => e.target.files?.[0] && importJson(e.target.files[0])}/></label>
        <details className="export-menu"><summary>↓ Export</summary><div><button onClick={exportPdf}>PDF by topic</button><button onClick={exportWord}>Word by topic</button><button onClick={()=>download("md")}>Markdown</button><button onClick={()=>download("csv")}>CSV</button><button onClick={()=>download("json")}>JSON backup</button></div></details>
        <button className="data-btn" onClick={()=>{setClearConfirmation("");setClearingAll(true)}}>Data</button>
        <button onClick={undo} disabled={!history.current.length}>↶ Undo</button><button onClick={redo} disabled={!future.current.length}>↷ Redo</button><button className="add-btn" title="Ctrl+N / ⌘N" onClick={addCard}>＋ Add new card</button>
      </div>
    </header>

    <nav className="collections" aria-label="Card boxes">{(["paper","author","journal"] as const).map(k=><button key={k} className={kind===k?"active":""} onClick={()=>{setKind(k);searchCards("");selectFilter("All cards");setSort(previous=>k==="paper"||["newest","oldest","author","title"].includes(previous)?previous:"title")}}><span>{k==="paper"?"Papers":k==="author"?"Authors":"Journals"}</span><em>{collectionCounts[k]}</em></button>)}</nav>

    <section className="controls">
      <label className="search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>searchCards(e.target.value)} placeholder="Search notes, authors, or keywords…"/>{query&&<button type="button" className="clear-search" aria-label="Clear search" onClick={()=>{searchCards("");searchRef.current?.focus()}}>×</button>}<kbd>⌘ K</kbd></label>
      <FacetMenu title="Keywords" values={allTags} count={keywordFacetCount} onSelect={searchCards}/>
      {kind==="paper"&&<FacetMenu title="Authors" values={allAuthors} count={authorFacetCount} onSelect={searchCards}/>}
      {kind==="paper"&&<button type="button" className={duplicatesOnly?"duplicate-filter active":"duplicate-filter"} aria-pressed={duplicatesOnly} onClick={()=>{setDuplicatesOnly(value=>!value);setPosition(0)}}>Duplicates <em>{duplicateCardCount}</em></button>}
      <label className="sort">Sort by <select value={sort} onChange={e=>{setSort(e.target.value);setPosition(0)}}>{kind==="paper"&&<><option value="project">Topic</option><option value="keyword">Keyword</option></>}<option value="newest">Newest cards first</option><option value="oldest">Oldest cards first</option><option value="author">Author</option><option value="title">Title</option></select></label>
      <span className={`save-state ${saved ? "" : "saving"}`}>{saved ? "● Saved locally" : "○ Saving…"}</span>
    </section>

    {kind==="paper"&&<nav className="dividers organizer-tabs" aria-label="Choose organization">
      {([['all','All cards'],['project','Topics'],['status','Categories'],['keyword','Keywords'],['author','Authors']] as const).map(([value,label])=><button key={value} className={groupBy===value?"active":""} onClick={()=>{setGroupBy(value);selectFilter("All cards");setProjectPath([]);setIntroExpanded(false)}}><span>{label}</span>{value==="all"&&<em>{visible.length}</em>}</button>)}
    </nav>}
    {kind==="paper"&&groupBy==="status"&&<div className="tab-scroller"><button type="button" className="tab-scroll-button" aria-label="Scroll tabs left" onClick={()=>valueTabsRef.current?.scrollBy({left:-260,behavior:"smooth"})}>‹</button><nav ref={valueTabsRef} className="dividers value-tabs" aria-label={`${groupBy} values`} tabIndex={0} onKeyDown={e=>{if(e.key==="ArrowRight"){e.preventDefault();e.currentTarget.scrollBy({left:180,behavior:"smooth"})}if(e.key==="ArrowLeft"){e.preventDefault();e.currentTarget.scrollBy({left:-180,behavior:"smooth"})}}}>
      <button className={filter==="Without category"?"active":""} onClick={()=>selectFilter("Without category")}><span>Without category</span><em>{facetCounts.statusesMap.get("")||0}</em></button>
      {groupValues.map(s=><button key={s} className={filter===s?"active":""} onClick={()=>selectFilter(s)} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=Number(e.dataTransfer.getData("text/plain"));change(cs=>cs.map(c=>c.id!==id?c:withCategories(c,[...cardCategories(c),s])));selectFilter(s)}}><span>{s}</span><em>{groupCount(s)}</em></button>)}
      <button className="edit-statuses" onClick={editCurrentTabs}>＋ Edit</button>
    </nav><button type="button" className="tab-scroll-button" aria-label="Scroll tabs right" onClick={()=>valueTabsRef.current?.scrollBy({left:260,behavior:"smooth"})}>›</button></div>}
    <div className={kind==="paper"&&groupBy==="project"?"topic-layout":kind==="paper"&&(groupBy==="keyword"||groupBy==="author")?"value-navigation-layout":""}>
    {kind==="paper"&&groupBy==="project"&&<aside className="topic-navigation-panel"><TopicNavigation paths={existingTopicPaths} selected={projectPath} onSelect={selectProjectPath} onEdit={editCurrentTabs} onDropCard={(id,path)=>change(cs=>cs.map(card=>card.id===id?{...card,projects:path}:card))} onReorder={reorderTopic} onRename={renameTopic} customOrder={topicOrder} count={topicCount} total={matchingKindCards.length} unfiledCount={matchingKindCards.filter(card=>!card.projects.length).length} showUnfiled={filter==="Without topic"} onSelectUnfiled={()=>{setProjectPath([]);selectFilter("Without topic")}}/>{projectPath.length>0&&<div className="topic-intro-panel"><nav className="topic-breadcrumb" aria-label="Topic path"><button onClick={()=>selectProjectPath([])}>Topics</button>{projectPath.map((level,i)=><button key={`${level}-${i}`} className={i===projectPath.length-1?"active":""} onClick={()=>selectProjectPath(projectPath.slice(0,i+1))}>› {level}</button>)}</nav><div className="topic-intro-trail">{topicTrail.map((item,i)=>{const html=item.card?.findings||"";const current=i===topicTrail.length-1;return <section key={item.path.join("/")} className={current?"topic-intro-item current":"topic-intro-item"} role="button" tabIndex={0} onClick={()=>item.card&&openCard(item.card)} onKeyDown={e=>{if((e.key==="Enter"||e.key===" ")&&item.card)openCard(item.card)}}><small>{i===0?"Topic":`Level ${i+1}`}</small><h2>{item.level}</h2>{html?<RichPreview html={html} className={`topic-intro-content ${current&&introExpanded?"expanded":""}`}/>:<p className="topic-intro-content">No introduction yet.</p>}<em>Edit introduction ↗</em></section>})}</div>{plain(selectedProjectCard?.findings||"").length>220&&<button className="intro-toggle" onClick={()=>setIntroExpanded(v=>!v)}>{introExpanded?"Show less":"Show more"}</button>}</div>}</aside>}

    {kind==="paper"&&(groupBy==="keyword"||groupBy==="author")&&<aside className="value-navigation-panel"><ValueNavigation key={groupBy} title={groupBy==="keyword"?"Keywords":"Authors"} values={groupValues} selected={filter} onSelect={selectFilter} count={groupCount} onEdit={groupBy==="keyword"?editCurrentTabs:undefined} onDropCard={groupBy==="keyword"?(id,value)=>{change(cs=>cs.map(card=>card.id===id?{...card,keywords:Array.from(new Set([...card.keywords,value]))}:card));selectFilter(value)}:undefined}/></aside>}

    <section className="deck-area">
      <div className="deck-heading"><span>{visible.length} {visible.length===1?"card":"cards"} in this stack</span><button type="button" className={previewExpanded?"global-preview-toggle active":"global-preview-toggle"} onClick={()=>setPreviewExpanded(value=>!value)}>{previewExpanded?"✓ Expanded cards":"Expand all cards"}</button><span>Use ← → or click to flip</span></div>
      {currentItem ? <div className="deck-wrap">
        <button className="flip prev" aria-label="Previous card" disabled={boundedPosition===0} onClick={()=>setPosition(Math.max(0,boundedPosition-1))}>←</button>
        <div className="deck-shadow shadow-three"/><div className="deck-shadow shadow-two"/><div className="deck-shadow shadow-one"/>
        <article ref={cardPreviewRef} className={`note-card deck-card ${kind}-card ${previewExpanded?"preview-expanded":""}`} key={currentItem.card.id} draggable onDragStart={e=>e.dataTransfer.setData("text/plain",String(currentItem.card.id))} onClick={()=>openCard(currentItem.card)}>
          <div className="card-number">{String(boundedPosition+1).padStart(2,"0")} / {String(deckItems.length).padStart(2,"0")}</div>{kind==="paper"?<span className={`status-dot ${cardCategories(currentItem.card)[0]?.toLowerCase().replace(" ","-")||"uncategorized"}`}>{cardCategories(currentItem.card).join(" · ")||"Uncategorized"}</span>:<span className="status-dot">{kind}</span>}{(duplicateTitleCounts.get(duplicateTitleKey(currentItem.card))||0)>1&&<span className="duplicate-mark" title="Another paper card has the same title">Duplicate title ×{duplicateTitleCounts.get(duplicateTitleKey(currentItem.card))}</span>}
          {(()=>{const current=currentItem.card;const matchedDetails=deferredQuery.trim()?[['Methods',current.methods],['Limitations',current.limitations],['My notes',plain(current.notes)]].filter(([,text])=>text.toLowerCase().includes(deferredQuery.trim().toLowerCase())).map(([label,text])=>[label,searchExcerpt(text,deferredQuery)]):[];return <>
          <h2><HighlightText text={current.title} term={deferredQuery}/></h2><p className="citation"><HighlightText text={kind==="paper"?firstAuthor(current.authors):current.authors} term={deferredQuery}/>{current.year&&<> · <HighlightText text={current.year} term={deferredQuery}/></>}</p><p className="journal"><HighlightText text={current.journal} term={deferredQuery}/>{current.doi&&<> · <a href={`https://doi.org/${current.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"")}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>DOI</a></>}</p><div className="rule"/>
          <RichPreview className="finding rich-preview" html={current.findings} term={deferredQuery} inline={!previewExpanded}/>{previewExpanded&&<div className="preview-details">{current.methods&&<p><b>Methods:</b> <HighlightText text={current.methods} term={deferredQuery}/></p>}{current.limitations&&<p><b>Limitations:</b> <HighlightText text={current.limitations} term={deferredQuery}/></p>}{plain(current.notes)&&<div className="preview-rich-row"><b>My notes:</b><RichPreview className="rich-preview compact" html={current.notes} term={deferredQuery}/></div>}</div>}{!previewExpanded&&matchedDetails.length>0&&<div className="search-matches">{matchedDetails.map(([label,text])=><p key={label}><b>{label}</b><span><HighlightText text={text} term={deferredQuery}/></span></p>)}</div>}<div className="tags">{current.keywords.slice(0,previewExpanded?12:4).map(t=><button key={t} onClick={e=>{e.stopPropagation();searchCards(t)}}><HighlightText text={t} term={deferredQuery}/></button>)}</div>
          {!!current.images?.length&&<div className="card-thumbs">{current.images.slice(0,3).map((image,i)=><button type="button" key={image.id} aria-label={`Enlarge ${image.name}`} onClick={e=>{e.stopPropagation();setPreviewImage(image)}} style={{transform:`rotate(${i%2?2:-2}deg)`}}><img src={image.data} alt={image.name}/></button>)}{current.images.length>3&&<em>+{current.images.length-3}</em>}</div>}
          <footer><span title={current.projects.join(" › ")}>{current.projects.join(" › ") || (kind==="paper"?"Unfiled":kind==="author"?"Author card":kind==="project"?"Topic card":"Journal card")}</span><b>Click to read & edit ↗</b></footer></>})()}
        </article>
        <button className="flip next" aria-label="Next card" disabled={boundedPosition>=deckItems.length-1} onClick={()=>setPosition(Math.min(deckItems.length-1,boundedPosition+1))}>→</button>
      </div> : <div className="empty"><b>No cards found</b><span>Try another phrase or divider.</span></div>}
      <div className="deck-dots">{deckItems.slice(Math.max(0,boundedPosition-3),boundedPosition+4).map((item,index)=>{const itemPosition=Math.max(0,boundedPosition-3)+index;return <button key={item.card.id} className={itemPosition===boundedPosition?"active":""} onClick={()=>setPosition(itemPosition)} aria-label="Open page"/>})}</div>
    </section></div>

    {open && <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)closeCard()}}><section key={open.id} className="card-modal" role="dialog" aria-modal="true">
      <div className="modal-top"><span className="catalog-label">{open.kind==="project"?"TOPIC":(open.kind||"paper").toUpperCase()} CARD · {open.year || "UNDATED"}</span><button aria-label="Close card" onClick={closeCard}>×</button></div>
      {(open.kind||"paper")==="paper"&&<CitationImporter onIdentify={fields=>patchOpen(Object.fromEntries(Object.entries(fields).filter(([,value])=>value)))}/>}
      <DraftInput className="title-input" value={open.title} onCommit={title=>patchOpen({title})}/>
      {open.kind!=="project"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Authors":(open.kind==="author"?"Affiliation":"Publisher")}<DraftInput value={open.authors} placeholder={(open.kind||"paper")==="paper"?"Lastname, Firstname; or Firstname Lastname":""} onCommit={authors=>patchOpen({authors})}/>{(open.kind||"paper")==="paper"&&<small className="field-help">Either name order works. Separate multiple authors with semicolons.</small>}</label><label className="year-field">{open.kind==="author"?"Years":"Year"}<DraftInput value={open.year} onCommit={year=>patchOpen({year})}/></label></div>}
      {open.kind!=="project"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Journal":open.kind==="author"?"Department / field":"Frequency / location"}<DraftInput value={open.journal} onCommit={journal=>patchOpen({journal})}/></label>{(open.kind||"paper")==="paper"&&<label>DOI<div className="doi-field"><DraftInput value={open.doi} onCommit={doi=>patchOpen({doi})}/>{open.doi&&<a href={`https://doi.org/${open.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"")}`} target="_blank" rel="noreferrer">Open ↗</a>}</div></label>}</div>}
      {open.kind==="journal"&&<div className="journal-metrics"><label>Quartile<DraftInput value={open.quartile||""} placeholder="e.g. Q1" onCommit={quartile=>patchOpen({quartile})}/></label><label>Impact factor<DraftInput value={open.impactFactor||""} onCommit={impactFactor=>patchOpen({impactFactor})}/></label><label>Acceptance rate<DraftInput value={open.acceptanceRate||""} placeholder="e.g. 12%" onCommit={acceptanceRate=>patchOpen({acceptanceRate})}/></label><label>Median to first decision<DraftInput value={open.medianFirstDecision||""} placeholder="e.g. 21 days" onCommit={medianFirstDecision=>patchOpen({medianFirstDecision})}/></label></div>}
      {open.kind!=="project"&&<TagField label="Keywords" values={open.keywords} suggestions={allKeywords} onChange={keywords=>patchOpen({keywords})}/>}
      {(open.kind||"paper")==="paper"&&<div className="field-row"><ProjectField values={open.projects} suggestions={existingTopicPaths} onChange={projects=>patchOpen({projects})}/><div className="category-picker"><span className="category-picker-title">Categories</span><div className="category-options">{statuses.map(category=>{const active=cardCategories(open).some(value=>value.toLowerCase()===category.toLowerCase());return <button type="button" key={category} className={active?"active":""} aria-pressed={active} onClick={()=>toggleCategory(open,category)}>{active?"✓ ":"＋ "}{category}</button>})}{!statuses.length&&<small>No categories yet.</small>}</div><button type="button" className="new-category-button" onClick={()=>addCategoryFromCard(open)}>＋ New category</button></div></div>}
      <RichField label={(open.kind||"paper")==="paper"?"Key findings":open.kind==="author"?"Profile":open.kind==="project"?"Topic introduction":"Journal overview"} value={open.findings} onChange={findings=>patchOpen({findings})}/>
      <div className="attachments findings-images"><div className="attachment-head"><span>Images · paste anywhere with Ctrl/⌘ + V</span><label className="attach-button">＋ Attach images<input type="file" accept="image/*" multiple onChange={e=>e.target.files&&attachImages(e.target.files)}/></label></div>
        {open.images?.length ? <div className="image-grid">{open.images.map(image=><figure key={image.id}><img className="zoomable-image" src={image.data} alt={image.name} title="Click to enlarge" onClick={()=>setPreviewImage(image)}/><figcaption title={image.name}>{image.name}</figcaption><button aria-label={`Remove ${image.name}`} onClick={()=>patchOpen({images:(openCardRef.current?.images||[]).filter(item=>item.id!==image.id)})}>×</button></figure>)}</div> : <p className="attachment-empty">Add figures, diagrams, screenshots, or handwritten notes.</p>}
      </div>
      {open.kind!=="project"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Methods":open.kind==="author"?"Approach / traditions":"Scope"}<DraftTextarea value={open.methods} onKeyDown={allowTab} onCommit={methods=>patchOpen({methods})}/></label><label>{(open.kind||"paper")==="paper"?"Limitations":open.kind==="author"?"Cautions / critiques":"Submission notes"}<DraftTextarea value={open.limitations} onKeyDown={allowTab} onCommit={limitations=>patchOpen({limitations})}/></label></div>}
      <RichField label="My notes" value={open.notes} onChange={notes=>patchOpen({notes})}/>
      {open.kind!=="project"&&<label>PDF or EndNote link<DraftInput value={open.link} placeholder="https://…" onCommit={link=>patchOpen({link})}/></label>}
      <div className="modal-foot"><button className="delete" onClick={()=>{if(confirm("Remove this card?"))removeOpenCard()}}>Remove card</button><span>Changes save automatically</span><button className="done" onClick={closeCard}>Done</button></div>
    </section></div>}
    {editingStatuses&&<div className="modal-backdrop"><section className="status-editor" role="dialog" aria-modal="true"><div className="modal-top"><div><span className="catalog-label">CARD CATEGORIES</span><h2>Edit categories</h2></div><button aria-label="Close" onClick={()=>setEditingStatuses(false)}>×</button></div><p>Add as many categories as you need. Their order becomes the tab order.</p><div className="status-fields">{statusDraft.map((status,i)=><div key={i}><span>{i+1}</span><input value={status} autoFocus={i===0} onChange={e=>setStatusDraft(ds=>ds.map((d,n)=>n===i?e.target.value:d))}/><button aria-label={`Remove ${status}`} onClick={()=>setStatusDraft(ds=>ds.map((value,n)=>n===i?"":value))}>×</button></div>)}</div><button className="add-status" onClick={()=>setStatusDraft(ds=>[...ds,`Category ${ds.length+1}`])}>＋ Add category</button><div className="modal-foot"><button onClick={()=>setEditingStatuses(false)}>Cancel</button><span>{statusDraft.length} categories</span><button className="done" onClick={()=>{const draft=statusDraft.map(value=>value.trim());const next=Array.from(new Set(draft.filter(Boolean)));setCards(cs=>cs.map(card=>withCategories(card,cardCategories(card).map(category=>{const index=statuses.findIndex(value=>value.toLowerCase()===category.toLowerCase());return index>=0?(draft[index]||""):category}).filter(Boolean))));setStatuses(next);selectFilter("All cards");setEditingStatuses(false)}}>Save categories</button></div></section></div>}
    {editingValues&&<div className="modal-backdrop"><section className="status-editor" role="dialog" aria-modal="true"><div className="modal-top"><div><span className="catalog-label">{editingValues==="project"?"TOPIC LEVEL":"KEYWORDS"}</span><h2>Edit {editingValues==="project"?"topics":"keywords"}</h2></div><button aria-label="Close" onClick={()=>setEditingValues(null)}>×</button></div><p>{editingValues==="project"?(projectPath.length?`Manage subtopics under ${projectPath.at(-1)}.`:"Manage top-level topics."):"Rename an item below, or remove it from every card."}</p><div className="status-fields">{valueDraft.map((value,i)=><div key={i}><span>{i+1}</span><input value={value} autoFocus={i===0} placeholder={editingValues==="project"?"Topic name":"Keyword"} onChange={e=>setValueDraft(values=>values.map((item,n)=>n===i?e.target.value:item))}/><button aria-label={`Remove ${value}`} onClick={()=>setValueDraft(values=>values.map((item,n)=>n===i?"":item))}>×</button></div>)}</div>{editingValues==="project"&&projectPath.length<5&&<button className="add-status" onClick={()=>setValueDraft(values=>[...values,""])}>＋ Add topic here</button>}<div className="modal-foot"><button onClick={()=>setEditingValues(null)}>Cancel</button><span>{editingValues==="project"?"Maximum five levels":"Applies to all matching cards"}</span><button className="done" onClick={saveEditedValues}>Save changes</button></div></section></div>}
    {addingCategoryFor!==null&&<div className="modal-backdrop"><section className="status-editor compact-editor" role="dialog" aria-modal="true"><div className="modal-top"><div><span className="catalog-label">CARD CATEGORY</span><h2>Add a category</h2></div><button aria-label="Close" onClick={()=>setAddingCategoryFor(null)}>×</button></div><p>Enter a new name, or type an existing category to assign it.</p><input className="new-category-input" autoFocus value={newCategoryName} list="category-names" onChange={e=>setNewCategoryName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveNewCategory()}}/><datalist id="category-names">{statuses.map(status=><option key={status} value={status}/>)}</datalist><div className="modal-foot"><button onClick={()=>setAddingCategoryFor(null)}>Cancel</button><button className="done" disabled={!newCategoryName.trim()} onClick={saveNewCategory}>Add & assign</button></div></section></div>}
    {clearingAll&&<div className="modal-backdrop"><section className="status-editor danger-editor" role="dialog" aria-modal="true" aria-labelledby="delete-all-title"><div className="modal-top"><div><span className="catalog-label">DATA MANAGEMENT</span><h2 id="delete-all-title">Delete all cards?</h2></div><button aria-label="Close" onClick={()=>setClearingAll(false)}>×</button></div><p>A JSON backup will be created first. This removes every paper, author, journal, and topic card from this device.</p><label className="danger-confirm">Type <b>DELETE ALL</b> to confirm<input autoFocus value={clearConfirmation} onChange={e=>setClearConfirmation(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void confirmClearAll()}}/></label><div className="modal-foot"><button onClick={()=>setClearingAll(false)}>Cancel</button><span>{cards.length} cards</span><button className="delete-all-confirm" disabled={clearConfirmation!=="DELETE ALL"} onClick={()=>void confirmClearAll()}>Back up & delete all</button></div></section></div>}
    {previewImage&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label={previewImage.name} onClick={()=>setPreviewImage(null)}><button type="button" aria-label="Close image" onClick={()=>setPreviewImage(null)}>×</button><img src={previewImage.data} alt={previewImage.name} onClick={e=>e.stopPropagation()}/><span>{previewImage.name}</span></div>}
  </main>;
}
