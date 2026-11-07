"use client";

import { memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { FigureGrid, FigureLightbox, type Figure } from "./figures";
import { useLibrarySave } from "./library-save";
import { CardLinkPicker, RichField } from "./rich-field";
import { inlineCardIds, linkedCardId, remapInlineLinks, safeRichHtml, type LinkableCard } from "./rich-text";
import { displayName } from "../package.json";

const collectionLabels = { paper: "Papers", author: "Authors", journal: "Journals", note: "Notes" };
type Collection = keyof typeof collectionLabels;
type CollectionCategories = Record<Exclude<Collection, "paper">, string[]>;
const isCategoryCollection = (kind: Card["kind"]): kind is Collection =>
  kind === "paper" || kind === "author" || kind === "journal" || kind === "note";
const categoryFilter = (name: string) => `category:${name.toLowerCase()}`;

export type Card = {
  kind?: Collection|"topic"|"project";
  id: number; title: string; authors: string; year: string; journal: string; doi: string;
  topics: string[]; keywords: string[]; projects: string[]; status: string; categories?: string[];
  findings: string; methods: string; limitations: string; notes: string; link: string;
  quartile?: string; impactFactor?: string; acceptanceRate?: string; medianFirstDecision?: string;
  createdAt?: number;
  images?: Figure[];
  relatedCardIds?: number[];
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
const AUTOSAVE_INTERVAL_MS = 5 * 60_000;
const AUTOSAVE_IDLE_MS = 1_200;
const afterPaint = () => new Promise<void>(resolve => setTimeout(resolve, 32));
const blank = (kind:NonNullable<Card["kind"]>): Card => ({ id: Date.now(), createdAt:Date.now(), kind, title: kind==="paper"?"Untitled paper":kind==="author"?"Unnamed author":kind==="journal"?"Untitled journal":kind==="project"?"Untitled project":kind==="note"?"Untitled note":"Untitled topic", authors: "", year: "", journal: "", doi: "", topics: [], keywords: [], projects: [], status: "", categories:[], findings: "", methods: "", limitations: "", notes: "", link: "", subtopics:[] });
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
const cardSearchText=(c:Card,categories=cardCategories(c))=>[c.title,c.authors,c.year,c.journal,c.doi,c.keywords.join(" "),c.projects.join(" "),categories.join(" "),plain(c.findings),c.methods,c.limitations,plain(c.notes),c.link,c.quartile,c.impactFactor,c.acceptanceRate,c.medianFirstDecision,...(c.images || []).map(figure => figure.caption)].join(" ").toLowerCase();
type LibraryState={cards:Card[];statuses:string[];topicOrder:string[];collectionCategories:CollectionCategories};
function restoreLibrary(raw: unknown, legacyExamples: boolean): LibraryState | null {
  const stored = (Array.isArray(raw) ? { cards: raw } : raw) as Partial<LibraryState> | null;
  if (!Array.isArray(stored?.cards)) return null;
  const cards = stored.cards.map((card, index) => withCategories({
    ...card,
    createdAt: card.createdAt || (card.id > 1_000_000_000_000 ? card.id : 1704067200000 + index),
    kind: card.kind || "paper",
    keywords: Array.from(new Set([...(card.keywords || []), ...(card.topics || []), ...(card.subtopics || [])])),
    topics: [], subtopics: [],
  }, cardCategories(card)));
  if (legacyExamples) {
    for (const collection of ["author", "journal"] as const) {
      if (cards.some(card => card.kind === collection)) continue;
      const sample = seed.find(card => card.kind === collection)!;
      cards.push({ ...sample, createdAt: Date.now(), keywords: Array.from(new Set([...sample.keywords, ...sample.topics])), topics: [] });
    }
    const existingProjects = new Set(cards.filter(card => card.kind === "project").map(card => card.projects.join(" > ")));
    const topicNames = new Set(cards.filter(card => card.kind === "paper").map(card => card.projects[0]).filter(Boolean));
    Array.from(topicNames).forEach((title, index) => {
      if (!existingProjects.has(title)) cards.push({ ...blank("project"), id: 4000 + index, title, projects: [title] });
    });
  }
  return {
    cards,
    statuses: Array.isArray(stored.statuses) ? stored.statuses : defaultStatuses,
    topicOrder: Array.isArray(stored.topicOrder) ? stored.topicOrder : [],
    collectionCategories: {
      author: stored.collectionCategories?.author || [],
      journal: stored.collectionCategories?.journal || [],
      note: stored.collectionCategories?.note || [],
    },
  };
}
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
function allowTab(e:React.KeyboardEvent<HTMLTextAreaElement>){if(e.key!=="Tab")return;e.preventDefault();const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;const next=`${el.value.slice(0,start)}\t${el.value.slice(end)}`;const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")?.set;setter?.call(el,next);el.dispatchEvent(new Event("input",{bubbles:true}));requestAnimationFrame(()=>el.setSelectionRange(start+1,start+1))}
function HighlightText({text,term}:{text:string;term:string}){
  const needle=term.trim();
  if(!needle)return <>{text}</>;
  const escaped=needle.replace(/[|\\{}()[\]^$+*?.-]/g,"\\$&");
  const parts=text.split(new RegExp(`(${escaped})`,"gi"));
  return <>{parts.map((part,i)=>i%2?<mark className="search-highlight" key={i}>{part}</mark>:part)}</>;
}
const RichPreview = memo(function RichPreview({html,term="",className="",onOpenCard,compact=false}:{html:string;term?:string;className?:string;onOpenCard?:(id:number)=>void;compact?:boolean}) {
  // A compact card can show only a few lines. Keep long documents out of
  // the preview DOM until the user expands or opens the card.
  const content = compact && html.length > 6_000
    ? html.slice(0, 6_000).replace(/<[^>]*$|&[a-zA-Z0-9#]*$/g, "") : html;
  const rendered = safeRichHtml(content, term);
  return <div className={className} dangerouslySetInnerHTML={{__html:rendered}} onClick={event => {
    const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href) return;
    event.stopPropagation();
    const id = linkedCardId(href);
    if (id !== null) { event.preventDefault(); onOpenCard?.(id); }
  }}/>;
});
function LinkedCardFront({ card, onOpenCard, onClose, onFlip }: {
  card: Card;
  onOpenCard: (id: number) => void;
  onClose: () => void;
  onFlip: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const kind = card.kind || "paper";
  const categories = cardCategories(card);
  return <dialog ref={dialog} className="linked-card-dialog" aria-label={`Front of ${card.title}`} aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => event.stopPropagation()}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <article className={`note-card deck-card ${kind}-card linked-card-face`}>
      <div className="modal-top">
        <span className="status-dot">{categories.join(" · ") || `${kind} card`}</span>
        <button type="button" aria-label="Close card front" onClick={onClose}>×</button>
      </div>
      <h2>{card.title}</h2>
      {kind !== "note" && <>
        <p className="citation">{[kind === "paper" ? firstAuthor(card.authors) : card.authors, card.year].filter(Boolean).join(" · ")}</p>
        {card.journal && <p className="journal">{card.journal}</p>}
      </>}
      {kind === "journal" && <JournalSummary card={card} term=""/>}
      <div className="rule"/>
      <RichPreview className="finding rich-preview" html={kind === "note" ? card.notes : card.findings} onOpenCard={onOpenCard} compact/>
      <div className="modal-foot"><button type="button" className="done" onClick={onFlip}>Flip to back</button></div>
    </article>
  </dialog>;
}
function searchExcerpt(text:string,term:string){const needle=term.trim().toLowerCase();const index=text.toLowerCase().indexOf(needle);if(index<0)return text;const start=Math.max(0,index-58),end=Math.min(text.length,index+needle.length+82);return `${start?"…":""}${text.slice(start,end).trim()}${end<text.length?"…":""}`}
const citationSentences=(value:string)=>value.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'(])/u).map(part=>part.trim()).filter(Boolean);
const cleanCitationField=(value:string)=>value.replace(/^[\s.,;:()[\]]+|[\s.,;:()[\]]+$/g,"").trim();
const cleanJournal=(value:string)=>cleanCitationField(value.split(/,\s*(?:vol\.?|no\.?|pp?\.?|\d+\s*\(|\d+\s*[,;:]\s*\d)/i)[0]||"");
export function parseCitation(raw:string):Partial<Card>{
  const text=raw.replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim();
  if(!text)return{};
  const doiMatch=text.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[\w.()/:;-]+)/i);
  const withoutDoi=text.replace(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/[\w.()/:;-]+\.?/ig,"").replace(/https?:\/\/\S+/g,"").trim();
  const yearMatch=withoutDoi.match(/\(((?:1[5-9]\d{2}|20\d{2})[a-z]?)\)|\b((?:1[5-9]\d{2}|20\d{2})[a-z]?)\b/i);
  const year=(yearMatch?.[1]||yearMatch?.[2]||"").slice(0,4);
  const yearIndex=yearMatch?.index??-1;
  const afterYear=yearIndex>=0?cleanCitationField(withoutDoi.slice(yearIndex+(yearMatch?.[0].length||0))):"";
  const afterYearHasTitle=/[\p{L}]{3}/u.test(afterYear)&&!/^(?:\d+\s*)?[;:,]\s*\d/.test(afterYear);
  const quoted=withoutDoi.match(/[“\"']([^”\"']{4,})[”\"']/);
  let authors="",title="",journal="";

  if(quoted){
    title=cleanCitationField(quoted[1]);
    const quoteIndex=quoted.index??0;
    const beforeQuote=withoutDoi.slice(0,quoteIndex).replace(yearMatch?.[0]||"","");
    authors=cleanCitationField(beforeQuote);
    journal=cleanJournal(withoutDoi.slice(quoteIndex+quoted[0].length));
  }else if(yearIndex>=0&&afterYearHasTitle){
    authors=cleanCitationField(withoutDoi.slice(0,yearIndex));
    const parts=citationSentences(afterYear);
    title=cleanCitationField(parts.shift()||afterYear);
    journal=cleanJournal(parts.shift()||"");
  }else{
    const beforeYear=yearIndex>=0?withoutDoi.slice(0,yearIndex):withoutDoi;
    const parts=citationSentences(beforeYear);
    authors=cleanCitationField(parts.shift()||"");
    title=cleanCitationField(parts.shift()||"");
    journal=cleanJournal(parts.shift()||"");
  }

  authors=authors.replace(/\s+(?:&|and)\s+/gi,"; ").replace(/\s*;\s*/g,"; ");
  const apaNames=authors.match(/(?:[\p{L}'’-]+(?:\s+[\p{L}'’-]+)*,\s*(?:[A-Z]\.?\s*){1,4})/gu);
  if(apaNames&&apaNames.length>1)authors=apaNames.map(name=>name.trim().replace(/[,.\s]+$/,"")).join("; ");
  return {authors,year,title,journal,doi:doiMatch?.[1]?.replace(/[.)]+$/g,"")||""};
}

function DraftInput({value,onCommit,...props}:{value:string;onCommit:(value:string,immediate?:boolean)=>void}&Omit<InputHTMLAttributes<HTMLInputElement>,"value"|"onChange">){
  const [draft,setDraft]=useState(value),ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==ref.current)setDraft(value)},[value]);
  const queue=(next:string)=>{setDraft(next);onCommit(next)};
  const finish=(next=draft)=>onCommit(next,true);
  return <input {...props} ref={ref} value={draft} onChange={event=>queue(event.target.value)} onBlur={event=>{finish(event.currentTarget.value);props.onBlur?.(event)}}/>;
}
function DraftTextarea({value,onCommit,...props}:{value:string;onCommit:(value:string,immediate?:boolean)=>void}&Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,"value"|"onChange">){
  const [draft,setDraft]=useState(value),ref=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{if(document.activeElement!==ref.current)setDraft(value)},[value]);
  const queue=(next:string)=>{setDraft(next);onCommit(next)};
  const finish=(next=draft)=>onCommit(next,true);
  return <textarea {...props} ref={ref} value={draft} onChange={event=>queue(event.target.value)} onBlur={event=>{finish(event.currentTarget.value);props.onBlur?.(event)}}/>;
}
function CitationImporter({onIdentify}:{onIdentify:(fields:Partial<Card>)=>void}){
  const [citation,setCitation]=useState("");
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  const identify=(value:string)=>{setCitation(value);if(timer.current)clearTimeout(timer.current);if(value.trim())timer.current=setTimeout(()=>onIdentify(parseCitation(value)),500)};
  return <label className="citation-importer">Paste text citation<textarea value={citation} placeholder="Paste an APA, Harvard, or similar bibliography entry…" onChange={e=>identify(e.target.value)}/><small className="field-help">Title, authors, year, journal, and DOI are identified automatically. Check the fields below before closing.</small></label>;
}
function TagField({label,values,onChange,suggestions=[]}:{label:string;values:string[];onChange:(values:string[],immediate?:boolean)=>void;suggestions?:string[]}) {
  const [text,setText]=useState(values.join(", "));
  const [search,setSearch]=useState("");
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==input.current)setText(values.join(", "))},[values]);
  const selected=split(text),selectedKeys=new Set(selected.map(value=>value.toLocaleLowerCase()));
  const available=suggestions.filter(s=>!selectedKeys.has(s.toLocaleLowerCase())&&(!search.trim()||s.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const draft=(next:string)=>{setText(next);onChange(split(next))};
  const commit=()=>{const parsed=split(text);setText(parsed.join(", "));onChange(parsed,true)};
  const add=(suggestion:string)=>{const next=Array.from(new Map([...selected,suggestion].map(value=>[value.toLocaleLowerCase(),value])).values());setText(next.join(", "));onChange(next)};
  return <div className="tag-field"><label>{label}<input ref={input} value={text} placeholder="Separate tags with commas" onChange={e=>draft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();input.current?.blur()}}}/></label>{suggestions.some(s=>!selectedKeys.has(s.toLocaleLowerCase()))&&<details className="keyword-picker" onToggle={e=>{if(!e.currentTarget.open)setSearch("")}}><summary>Choose existing keywords <em>{suggestions.length}</em></summary><div><label className="keyword-picker-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter keywords"/></label><div className="keyword-option-list">{available.map(s=><button type="button" key={s} onClick={()=>add(s)}>＋ {s}</button>)}{!available.length&&<small>No matching keywords.</small>}</div></div></details>}</div>;
}

function ProjectField({values,onChange,suggestions=[]}:{values:string[];onChange:(values:string[],immediate?:boolean)=>void;suggestions?:string[][]}) {
  const [text,setText]=useState(values.join(" > "));
  const [menuOpen,setMenuOpen]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==input.current)setText(values.join(" > "))},[values]);
  const parseLevels=(value:string)=>value.split(">").map(x=>x.trim()).filter(Boolean).slice(0,5);
  const commit=()=>{const levels=parseLevels(text);setText(levels.join(" > "));onChange(levels,true)};
  const needle=(text.trim()===values.join(" > ")?"":text.trim()).toLowerCase();
  const available=suggestions.filter(path=>path.length&&path.join(" > ")!==values.join(" > ")&&(!needle||path.join(" > ").toLowerCase().includes(needle)));
  const choose=(path:string[])=>{const next=path.slice(0,5);setText(next.join(" > "));onChange(next,true);setMenuOpen(false)};
  return <label className="project-field">Topic hierarchy<input ref={input} value={text} role="combobox" aria-expanded={menuOpen} aria-controls="topic-path-options" autoComplete="off" placeholder="Topic > Subtopic > Section (5 levels max)" onFocus={()=>setMenuOpen(true)} onChange={e=>{setText(e.target.value);onChange(parseLevels(e.target.value));setMenuOpen(true)}} onBlur={()=>{commit();setTimeout(()=>setMenuOpen(false),100)}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();setMenuOpen(false);input.current?.blur()}else if(e.key==="Escape")setMenuOpen(false)}}/>{menuOpen&&available.length>0&&<div id="topic-path-options" className="topic-path-dropdown" role="listbox" onMouseDown={e=>e.preventDefault()}>{available.map(path=><button type="button" role="option" aria-selected={false} key={path.join("/")} onClick={()=>choose(path)}>{path.map((level,index)=><span key={`${level}-${index}`} style={{paddingLeft:`${index*10}px`}}>{index?"› ":""}{level}</span>)}</button>)}</div>}<small className="field-help">Separate levels with &gt;, or choose an existing topic from the scrollable menu.</small></label>;
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

function JournalSummary({ card, term }: { card: Card; term: string }) {
  const metrics = [
    ["Quartile", card.quartile], ["Impact factor", card.impactFactor],
    ["Acceptance rate", card.acceptanceRate], ["Median to first decision", card.medianFirstDecision],
  ];
  if (!metrics.some(([, value]) => value?.trim())) return null;
  return <dl className="journal-summary" aria-label="Journal metrics">{metrics.map(([label, value]) => value?.trim() &&
    <div key={label}><dt>{label}</dt><dd><HighlightText text={value} term={term}/></dd></div>
  )}</dl>;
}

export default function Home({initialCards,initialGroupBy="all"}:{initialCards?:Card[];initialGroupBy?:GroupBy}={}) {
  const [cards, setCards] = useState<Card[]>(()=>initialCards||seed.map((c,i)=>withCategories({...c,createdAt:1704067200000+i,keywords:Array.from(new Set([...c.keywords,...c.topics,...(c.subtopics||[])])),topics:[],subtopics:[]},cardCategories(c))));
  const deferredCards=useDeferredValue(cards);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery=useDeferredValue(query);
  const [filter, setFilter] = useState("All cards");
  const [open, setOpen] = useState<Card | null>(null);
  const [sort, setSort] = useState("project");
  const [hasDraft, setHasDraft] = useState(false);
  const [position, setPosition] = useState(0);
  const [previewExpanded,setPreviewExpanded]=useState(false);
  const [duplicatesOnly,setDuplicatesOnly]=useState(false);
  const [kind, setKind] = useState<Collection>("paper");
  const [groupBy,setGroupBy]=useState<GroupBy>(initialGroupBy);
  const [projectPath,setProjectPath]=useState<string[]>([]);
  const [introExpanded,setIntroExpanded]=useState(false);
  const [statuses,setStatuses]=useState(defaultStatuses);
  const [collectionCategories, setCollectionCategories] = useState<CollectionCategories>({ author: [], journal: [], note: [] });
  const [topicOrder,setTopicOrder]=useState<string[]>([]);
  const [editingStatuses,setEditingStatuses]=useState<Collection | null>(null);
  const [statusDraft,setStatusDraft]=useState(defaultStatuses);
  const [editingValues,setEditingValues]=useState<"keyword"|"project"|null>(null);
  const [valueDraft,setValueDraft]=useState<string[]>([]);
  const [addingCategoryFor,setAddingCategoryFor]=useState<number|null>(null);
  const [newCategoryName,setNewCategoryName]=useState("");
  const [figurePreview, setFigurePreview] = useState<{ cardId: number; imageId: number } | null>(null);
  const [returnToCard, setReturnToCard] = useState<number | null>(null);
  const [linkedFront, setLinkedFront] = useState<Card | null>(null);
  const [linkedBackId, setLinkedBackId] = useState<number | null>(null);
  const [clearingAll,setClearingAll]=useState(false);
  const [clearConfirmation,setClearConfirmation]=useState("");
  const history=useRef<Card[][]>([]);
  const future=useRef<Card[][]>([]);
  const searchRef=useRef<HTMLInputElement>(null);
  const cardPreviewRef=useRef<HTMLElement>(null);
  const pendingCard=useRef<Card|null>(null);
  const openCardRef=useRef<Card|null>(null);
  const editorCommitTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const draftStarted = useRef(0);
  const closingSave = useRef<Promise<boolean> | null>(null);
  const closingDrafts = useRef(new Map<number, () => Card>());
  const pendingRich = useRef<Partial<Record<"findings" | "notes", () => string>>>({});
  const library = useMemo(() => ({ cards, statuses, topicOrder, collectionCategories }), [cards, statuses, topicOrder, collectionCategories]);
  const { status: saveStatus, saveNow, stageCard, stagedCard, discardStagedCards, hasUnsaved, adoptSnapshot, snapshotRevision } = useLibrarySave(library, ready, saveBrowserState);
  const takeDraft = useCallback(() => {
    if (editorCommitTimer.current) clearTimeout(editorCommitTimer.current);
    editorCommitTimer.current = null;
    draftStarted.current = 0;
    const draft = pendingCard.current;
    const card = draft || openCardRef.current;
    const { findings, notes } = pendingRich.current;
    pendingCard.current = null;
    pendingRich.current = {};
    setHasDraft(false);
    if (!card || !(draft || findings || notes)) return undefined;
    return () => findings || notes
      ? { ...card, ...(findings && { findings: findings() }), ...(notes && { notes: notes() }) }
      : card;
  }, []);
  const publishCard = useCallback((card: Card) => {
    stageCard(card);
    startTransition(() => setCards(current => {
      const index = current.findIndex(item => item.id === card.id);
      if (index < 0 || current[index] === card) return current;
      const next = [...current];
      next[index] = card;
      return next;
    }));
  }, [stageCard]);
  const commitOpenCard = useCallback(() => {
    const read = takeDraft();
    if (!read) return;
    const card = read();
    openCardRef.current = card;
    setOpen(current => current?.id === card.id ? card : current);
    stageCard(card);
  }, [takeDraft, stageCard]);
  const publishOpenCard = useCallback(() => {
    commitOpenCard();
    const current = openCardRef.current;
    const staged = current && stagedCard(current.id);
    if (staged) publishCard(staged);
  }, [commitOpenCard, stagedCard, publishCard]);
  const flushAndSave = useCallback(async () => {
    if (closingSave.current) await closingSave.current;
    await afterPaint();
    commitOpenCard();
    return saveNow();
  }, [commitOpenCard, saveNow]);
  const scheduleOpenCommit = useCallback(() => {
    const now = Date.now();
    if (!draftStarted.current) { draftStarted.current = now; setHasDraft(true); }
    if (editorCommitTimer.current) clearTimeout(editorCommitTimer.current);
    const remaining = AUTOSAVE_INTERVAL_MS - (now - draftStarted.current);
    editorCommitTimer.current = setTimeout(commitOpenCard, Math.max(AUTOSAVE_IDLE_MS, remaining));
  }, [commitOpenCard]);
  const postponeAutosave = useCallback(() => {
    if (draftStarted.current) scheduleOpenCommit();
  }, [scheduleOpenCommit]);
  const draftRich = useCallback((field: "findings" | "notes", read: () => string) => {
    pendingRich.current[field] = read;
    scheduleOpenCommit();
  }, [scheduleOpenCommit]);
  const draftFindings = useCallback((read: () => string) => draftRich("findings", read), [draftRich]);
  const draftNotes = useCallback((read: () => string) => draftRich("notes", read), [draftRich]);
  const searchCards=useCallback((value:string)=>{setQuery(value);setPosition(0)},[]);
  const selectFilter=useCallback((value:string)=>{setFilter(value);setPosition(0)},[]);

  const applySnapshot = useCallback((snapshot: LibraryState, revision?: number) => {
    if (revision !== undefined) adoptSnapshot(snapshot, revision);
    setCards(snapshot.cards);
    setStatuses(snapshot.statuses);
    setTopicOrder(snapshot.topicOrder);
    setCollectionCategories(snapshot.collectionCategories);
  }, [adoptSnapshot]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const desktop = window.literatureBox;
        const snapshot = desktop ? await desktop.loadCards() : null;
        const raw = desktop ? snapshot?.json : await loadBrowserState();
        if (cancelled) return;
        const restored = restoreLibrary(typeof raw === "string" ? JSON.parse(raw) : raw, !desktop);
        if (restored) applySnapshot(restored, snapshot?.revision);
        setReady(true);
      } catch (error) {
        if (!cancelled) setLoadError(true);
        console.error("Literature Box load failed", error);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [applySnapshot]);

  useEffect(() => {
    const desktop = window.literatureBox;
    if (!desktop || !ready) return;
    let cancelled = false;
    let loading = false;
    let lastInput = 0;
    const recordInput = () => { lastInput = performance.now(); };
    const canRefresh = () => !cancelled && !document.hidden && !openCardRef.current &&
      !closingSave.current && !hasUnsaved() && !document.querySelector("[aria-modal=true], .card-pile:active, .flip:active") &&
      (lastInput === 0 || performance.now() - lastInput > 450);
    const refresh = async () => {
      if (loading || !canRefresh()) return;
      loading = true;
      const revision = snapshotRevision();
      try {
        const snapshot = await desktop.loadCards(revision);
        if (!snapshot?.json || !canRefresh() || snapshotRevision() !== revision) return;
        const restored = restoreLibrary(JSON.parse(snapshot.json), false);
        if (!restored) return;
        history.current = [];
        future.current = [];
        applySnapshot(restored, snapshot.revision);
      } catch (error) {
        console.error("Literature Box shared library refresh failed", error);
      } finally {
        loading = false;
      }
    };
    const interval = setInterval(() => void refresh(), 2_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pointerdown", recordInput, { passive: true });
    window.addEventListener("keydown", recordInput);
    window.addEventListener("wheel", recordInput, { passive: true });
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pointerdown", recordInput);
      window.removeEventListener("keydown", recordInput);
      window.removeEventListener("wheel", recordInput);
    };
  }, [ready, applySnapshot, hasUnsaved, snapshotRevision]);
  useEffect(() => () => { if (editorCommitTimer.current) clearTimeout(editorCommitTimer.current); }, []);
  useEffect(() => {
    if (window.literatureBox) return window.literatureBox.onCloseRequested(flushAndSave);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!pendingCard.current && !draftStarted.current && !closingSave.current && !hasUnsaved()) return;
      event.preventDefault();
      event.returnValue = true;
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") void flushAndSave();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [flushAndSave, hasUnsaved]);

  const cardMetadata=useMemo(()=>new Map(deferredCards.map(card=>[card.id,getCardMeta(card)])),[deferredCards]);
  const duplicateTitleCounts=useMemo(()=>{const counts=new Map<string,number>();cardMetadata.forEach(meta=>{if(meta.duplicateKey)counts.set(meta.duplicateKey,(counts.get(meta.duplicateKey)||0)+1)});return counts},[cardMetadata]);
  const queryNeedle=deferredQuery.trim().toLowerCase();
  const duplicateCardCount=useMemo(()=>deferredCards.filter(card=>{const meta=cardMetadata.get(card.id);return meta&&(duplicateTitleCounts.get(meta.duplicateKey)||0)>1&&(!queryNeedle||meta.search.includes(queryNeedle))}).length,[deferredCards,cardMetadata,duplicateTitleCounts,queryNeedle]);
  const visible = useMemo(() => deferredCards.filter(c => {
    const meta=cardMetadata.get(c.id)!;
    const categoryMatch = filter === "All cards" || (filter === "Without category" ? !meta.categories.length :
      meta.categories.some(category => categoryFilter(category) === filter));
    const grouped = kind !== "paper" || groupBy === "status" ? categoryMatch :
      groupBy === "all" || (groupBy === "project" ?
        (filter === "Without topic" ? !c.projects.length : projectPath.every((level, i) => c.projects[i] === level)) :
        filter === "All cards" || (groupBy === "author" ? meta.authorIds.includes(singleAuthorIdentity(filter)) : meta.keywords.includes(filter)));
    const duplicateMatch=kind!=="paper"||!duplicatesOnly||(duplicateTitleCounts.get(meta.duplicateKey)||0)>1;
    return (c.kind||"paper")===kind&&grouped&&duplicateMatch&&(!queryNeedle||meta.search.includes(queryNeedle));
  }).sort((a,b)=>{const left=cardMetadata.get(a.id)!,right=cardMetadata.get(b.id)!;return sort==="project"?left.sortTopic.localeCompare(right.sortTopic)||right.created-left.created:sort==="keyword"?left.sortKeyword.localeCompare(right.sortKeyword)||right.created-left.created:sort==="author"?left.sortAuthor.localeCompare(right.sortAuthor):sort==="title"?left.sortTitle.localeCompare(right.sortTitle):sort==="oldest"?left.created-right.created:right.created-left.created}),[deferredCards,cardMetadata,queryNeedle,filter,sort,kind,groupBy,projectPath,duplicatesOnly,duplicateTitleCounts]);
  const deckItems=useMemo(()=>visible.map(card=>({type:"card" as const,card})),[visible]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;const editing=target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"){e.preventDefault();void flushAndSave()}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();searchRef.current?.focus()}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"){e.preventDefault();addCard()}else if(!openCardRef.current&&!editing&&e.key==="ArrowRight")setPosition(p=>Math.min(deckItems.length-1,p+1));else if(!openCardRef.current&&!editing&&e.key==="ArrowLeft")setPosition(p=>Math.max(0,p-1));else if(!editing&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo()}else if(!editing&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo()}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[deckItems.length,kind,flushAndSave]);
  const boundedPosition=Math.min(position,Math.max(deckItems.length-1,0));
  const currentItem=deckItems[boundedPosition];
  const current=currentItem?.type==="card"?currentItem.card:null;
  useEffect(()=>{const card=cardPreviewRef.current;if(!card||previewExpanded)return;const fit=()=>{const finding=card.querySelector<HTMLElement>(".finding.rich-preview"),footer=card.querySelector<HTMLElement>("footer"),tags=card.querySelector<HTMLElement>(".tags"),matches=card.querySelector<HTMLElement>(".search-matches");if(!finding||!footer)return;const lineHeight=parseFloat(getComputedStyle(finding).lineHeight)||24;const reserve=matches?Math.min(62,matches.scrollHeight+10):tags&&tags.children.length?Math.min(62,tags.scrollHeight+22):8;const available=Math.max(lineHeight,footer.getBoundingClientRect().top-finding.getBoundingClientRect().top-reserve);card.style.setProperty("--preview-lines",String(Math.max(1,Math.min(8,Math.floor(available/lineHeight)))))};fit();if(typeof ResizeObserver==="undefined")return;const observer=new ResizeObserver(fit);observer.observe(card);return()=>observer.disconnect()},[current?.id,current?.title,current?.findings,current?.keywords.length,deferredQuery,previewExpanded]);
  const kindCards=useMemo(()=>deferredCards.filter(c=>(c.kind||"paper")===kind),[deferredCards,kind]);
  const matchingKindCards=useMemo(()=>kindCards.filter(card=>{const meta=cardMetadata.get(card.id)!;return(!queryNeedle||meta.search.includes(queryNeedle))&&(kind!=="paper"||!duplicatesOnly||(duplicateTitleCounts.get(meta.duplicateKey)||0)>1)}),[kindCards,cardMetadata,queryNeedle,kind,duplicatesOnly,duplicateTitleCounts]);
  const allTags=useMemo(()=>Array.from(new Set(kindCards.flatMap(c=>getCardMeta(c).keywords))).sort(),[kindCards]);
  const allKeywords=useMemo(()=>Array.from(new Map(deferredCards.filter(card=>card.kind!=="project").flatMap(card=>card.keywords||[]).map(value=>value.trim()).filter(Boolean).map(value=>[value.toLocaleLowerCase(),value])).values()).sort((a,b)=>a.localeCompare(b)),[deferredCards]);
  const existingTopicPaths=useMemo(()=>{if(kind!=="paper")return[];const paths=deferredCards.filter(c=>(c.kind||"paper")==="paper"||c.kind==="project").map(c=>c.projects.filter(Boolean).slice(0,5)).filter(path=>path.length);const order=new Map(topicOrder.map((key,index)=>[key.toLowerCase(),index]));return Array.from(new Map(paths.map(path=>[path.join(" > ").toLowerCase(),path])).values()).sort((a,b)=>(order.get(a.join(" > ").toLowerCase())??Number.MAX_SAFE_INTEGER)-(order.get(b.join(" > ").toLowerCase())??Number.MAX_SAFE_INTEGER)||a.join(" > ").localeCompare(b.join(" > ")))},[deferredCards,topicOrder,kind]);
  const allAuthors=useMemo(()=>kind==="paper"?canonicalAuthors(kindCards):[],[kind,kindCards]);
  const categoryLists = useMemo(() => {
    const unique = (values: string[]) => Array.from(new Map(values.map(name => [name.toLowerCase(), name])).values());
    const lists = {
      author: [...collectionCategories.author],
      journal: [...collectionCategories.journal],
      note: [...collectionCategories.note],
    };
    deferredCards.forEach(card => {
      if (card.kind === "author" || card.kind === "journal" || card.kind === "note") {
        lists[card.kind].push(...cardCategories(card));
      }
    });
    return { paper: statuses, author: unique(lists.author), journal: unique(lists.journal), note: unique(lists.note) };
  }, [statuses, collectionCategories, deferredCards]);
  const openCollection = open?.kind || "paper";
  const openCategories = open && isCategoryCollection(openCollection) ? categoryLists[openCollection] : [];
  const groupValues=useMemo(()=>kind!=="paper"?[]:groupBy==="status"?statuses:groupBy==="keyword"?allTags:groupBy==="author"?allAuthors:groupBy==="project"?Array.from(new Set(kindCards.filter(c=>projectPath.every((level,i)=>c.projects[i]===level)).map(c=>c.projects[projectPath.length]).filter(Boolean))).sort():[],[kind,groupBy,statuses,kindCards,projectPath,allTags,allAuthors]);
  const facetCounts=useMemo(()=>{const statusesMap=new Map<string,number>(),keywordsMap=new Map<string,number>(),authorsMap=new Map<string,number>(),topicsMap=new Map<string,number>();matchingKindCards.forEach(card=>{const meta=cardMetadata.get(card.id)!;if(!meta.categories.length)statusesMap.set("",(statusesMap.get("")||0)+1);meta.categories.forEach(value=>statusesMap.set(value.toLowerCase(),(statusesMap.get(value.toLowerCase())||0)+1));meta.keywords.forEach(value=>keywordsMap.set(value,(keywordsMap.get(value)||0)+1));meta.authorIds.forEach(key=>authorsMap.set(key,(authorsMap.get(key)||0)+1));card.projects.forEach((_,i)=>{const key=card.projects.slice(0,i+1).join(" > ");topicsMap.set(key,(topicsMap.get(key)||0)+1)})});return{statusesMap,keywordsMap,authorsMap,topicsMap}},[matchingKindCards,cardMetadata]);
  const groupCount=useCallback((value:string)=>groupBy==="status"?(facetCounts.statusesMap.get(value.toLowerCase())||0):groupBy==="keyword"?(facetCounts.keywordsMap.get(value)||0):groupBy==="author"?(facetCounts.authorsMap.get(singleAuthorIdentity(value))||0):(facetCounts.topicsMap.get([...projectPath,value].join(" > "))||0),[groupBy,facetCounts,projectPath]);
  const keywordFacetCount=useCallback((value:string)=>facetCounts.keywordsMap.get(value)||0,[facetCounts]);
  const authorFacetCount=useCallback((value:string)=>facetCounts.authorsMap.get(singleAuthorIdentity(value))||0,[facetCounts]);
  const topicCount=useCallback((path:string[])=>(facetCounts.topicsMap.get(path.join(" > "))||0),[facetCounts]);
  const collectionCounts=useMemo(()=>{const result={paper:0,author:0,journal:0,note:0};deferredCards.forEach(card=>{const cardKind=card.kind||"paper",meta=cardMetadata.get(card.id)!;if(cardKind==="project"||cardKind==="topic")return;if(queryNeedle&&!meta.search.includes(queryNeedle))return;if(cardKind==="paper"&&duplicatesOnly&&(duplicateTitleCounts.get(meta.duplicateKey)||0)<2)return;result[cardKind]++});return result},[deferredCards,cardMetadata,queryNeedle,duplicatesOnly,duplicateTitleCounts]);
  const displayedCardCount=collectionCounts.paper+collectionCounts.author+collectionCounts.journal+collectionCounts.note;
  const projectCardsByPath=useMemo(()=>{const map=new Map<string,Card>();if(kind==="paper"&&groupBy==="project")deferredCards.forEach(card=>{if(card.kind==="project")map.set(card.projects.join(" > ")||card.title,card)});return map},[deferredCards,kind,groupBy]);
  const selectedProjectCard=useMemo(()=>projectCardsByPath.get(projectPath.join(" > "))||projectCardsByPath.get(projectPath.at(-1)||""),[projectCardsByPath,projectPath]);
  const linkableCards = useMemo(() => deferredCards.flatMap((card): LinkableCard[] => {
    const type = card.kind || "paper";
    if (type !== "paper" && type !== "author" && type !== "journal") return [];
    const detail = [card.authors, card.year].filter(Boolean).join(" · ");
    return [{ id: card.id, kind: type, title: card.title, detail }];
  }).sort((a, b) => a.title.localeCompare(b.title)), [deferredCards]);
  const linkedCardsById = useMemo(() => new Map(linkableCards.map(card => [card.id, card])), [linkableCards]);
  const noteLinks = useMemo(() => open?.kind === "note" ? Array.from(new Set([
    ...(open.relatedCardIds || []), ...inlineCardIds(open.notes),
  ])) : [], [open?.kind, open?.relatedCardIds, open?.notes]);
  const galleryCard = figurePreview && (open?.id === figurePreview.cardId ? open : cards.find(card => card.id === figurePreview.cardId));
  const statusText = loadError ? "Could not load library" : saveStatus === "loading" ? "Loading library…" : saveStatus === "error" ? "Save failed" :
    saveStatus === "saving" ? "○ Saving…" : hasDraft ? "○ Unsaved changes" : "● Saved locally";
  const topicTrail=useMemo(()=>projectPath.map((level,i)=>{const path=projectPath.slice(0,i+1);return {level,path,card:projectCardsByPath.get(path.join(" > "))||projectCardsByPath.get(level)}}),[projectCardsByPath,projectPath]);

  function change(fn:(cs:Card[])=>Card[],remember=true) { setCards(cs=>{if(remember){history.current.push(cs);future.current=[];if(history.current.length>30)history.current.shift()}return fn(cs)}); }
  function update(card: Card, immediate = false) {
    openCardRef.current = card;
    pendingCard.current = card;
    if (immediate) setOpen(card);
    scheduleOpenCommit();
  }
  function patchOpen(fields: Partial<Card>, immediate = false) {
    const current = openCardRef.current;
    if (current && Object.entries(fields).some(([key, value]) => current[key as keyof Card] !== value)) {
      update({ ...current, ...fields }, immediate);
    } else if (immediate && pendingCard.current) setOpen(current);
  }
  const openCard = useCallback((card: Card) => {
    if (openCardRef.current?.id === card.id) return;
    publishOpenCard();
    const current = closingDrafts.current.get(card.id)?.() || stagedCard(card.id) || card;
    openCardRef.current = current;
    setOpen(current);
  }, [publishOpenCard, stagedCard]);
  function closeCard() {
    const id = openCardRef.current?.id;
    const read = takeDraft();
    const staged = id === undefined ? undefined : stagedCard(id);
    if (id !== undefined && (read || staged)) {
      let captured: Card | undefined;
      const capture = () => captured ??= read ? read() : staged!;
      closingDrafts.current.set(id, capture);
      const previous = closingSave.current;
      const work = (previous || Promise.resolve(true)).then(afterPaint).then(() => {
        publishCard(capture());
        if (closingDrafts.current.get(id) === capture) closingDrafts.current.delete(id);
        return saveNow();
      });
      closingSave.current = work;
      void work.finally(() => { if (closingSave.current === work) closingSave.current = null; });
    }
    const origin = returnToCard === null ? null :
      closingDrafts.current.get(returnToCard)?.() || stagedCard(returnToCard) || cards.find(card => card.id === returnToCard);
    openCardRef.current = origin || null;
    setOpen(origin || null);
    setReturnToCard(null);
    setLinkedBackId(null);
  }
  function removeOpenCard() {
    if (!open) return;
    if (editorCommitTimer.current) clearTimeout(editorCommitTimer.current);
    editorCommitTimer.current = null;
    pendingCard.current = null;
    pendingRich.current = {};
    discardStagedCards(open.id);
    draftStarted.current = 0;
    setHasDraft(false);
    setCards(current => current.filter(card => card.id !== open.id));
    const origin = cards.find(card => card.id === returnToCard);
    openCardRef.current = origin || null;
    setOpen(origin || null);
    setReturnToCard(null);
    setLinkedBackId(null);
  }
  function restoreOpen(snapshot: Card[]) {
    takeDraft();
    discardStagedCards();
    if (!openCardRef.current) return;
    openCardRef.current = snapshot.find(card => card.id === openCardRef.current?.id) || null;
    setOpen(openCardRef.current);
  }
  function undo(){const previous=history.current.pop();if(previous){restoreOpen(previous);setCards(current=>{future.current.push(current);return previous})}}
  function redo(){const next=future.current.pop();if(next){restoreOpen(next);setCards(current=>{history.current.push(current);return next})}}
  function addCard() {
    if (!ready) return;
    publishOpenCard();
    setReturnToCard(null);
    const card = blank(kind);
    setCards(current => {
      while (current.some(item => item.id === card.id)) card.id++;
      return [card, ...current];
    });
    openCardRef.current = card;
    setOpen(card);
  }
  const openLinkedCard = useCallback((id: number) => {
    const target = cards.find(card => card.id === id);
    if (!target) { alert("This linked card is unavailable."); return; }
    setLinkedFront(openCardRef.current?.id === id ? openCardRef.current :
      closingDrafts.current.get(id)?.() || stagedCard(id) || target);
  }, [cards, stagedCard]);
  function flipLinkedToBack() {
    if (!linkedFront) return;
    const { id } = linkedFront;
    const current = openCardRef.current;
    if (current && current.id !== id) setReturnToCard(origin => origin ?? current.id);
    openCard(linkedFront);
    setLinkedBackId(id);
    setLinkedFront(null);
  }
  function flipLinkedToFront() {
    const card = openCardRef.current;
    if (!card) return;
    setLinkedFront(card);
    const field = card.kind === "note" ? "notes" : "findings";
    const read = pendingRich.current[field];
    if (read) void afterPaint().then(() => {
      const latest = { ...card, [field]: read() };
      setLinkedFront(front => front === card ? latest : front);
    });
  }
  function showFigure(cardId: number, imageId: number) {
    if (pendingCard.current) setOpen(pendingCard.current);
    setFigurePreview({ cardId, imageId });
  }
  function moveFigure(sourceId: number, targetId: number) {
    const figures = openCardRef.current?.images;
    if (!figures || sourceId === targetId) return;
    const from = figures.findIndex(figure => figure.id === sourceId);
    const to = figures.findIndex(figure => figure.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...figures];
    const [moving] = reordered.splice(from, 1);
    reordered.splice(to, 0, moving);
    patchOpen({ images: reordered }, true);
  }
  function captionFigure(id: number, caption: string, immediate?: boolean) {
    const figures = openCardRef.current?.images || [];
    if ((figures.find(figure => figure.id === id)?.caption || "") === caption) {
      if (immediate && pendingCard.current) setOpen(pendingCard.current);
      return;
    }
    patchOpen({ images: figures.map(figure => figure.id === id ? { ...figure, caption } : figure) }, immediate);
  }
  function selectProjectLevel(level:string){const path=[...projectPath,level].slice(0,5);setProjectPath(path);setPosition(0);setIntroExpanded(false);if(!cards.some(c=>c.kind==="project"&&c.projects.join(" > ")===path.join(" > "))){const project={...blank("project"),id:Date.now(),title:level,projects:path};change(cs=>[project,...cs])}}
  function selectProjectPath(path:string[]){const next=path.slice(0,5);setProjectPath(next);selectFilter("All cards");setIntroExpanded(false);if(next.length&&!cards.some(c=>c.kind==="project"&&c.projects.join(" > ")===next.join(" > "))){const project={...blank("project"),id:Date.now(),title:next.at(-1)||"Topic",projects:next};change(cs=>[project,...cs])}}
  function editCategories(collection: Collection) {
    setStatusDraft(categoryLists[collection]);
    setEditingStatuses(collection);
  }
  function storeCategories(collection: Collection, values: string[]) {
    if (collection === "paper") setStatuses(values);
    else setCollectionCategories(current => ({ ...current, [collection]: values }));
  }
  function saveCategories() {
    if (!editingStatuses) return;
    const draft = statusDraft.map(value => value.trim());
    const next = Array.from(new Map(draft.filter(Boolean).map(value => [value.toLowerCase(), value])).values());
    const previous = categoryLists[editingStatuses];
    const renamed = new Map(previous.map((value, index) => [value.toLowerCase(), draft[index] || ""]));
    setCards(current => current.map(card => {
      if ((card.kind || "paper") !== editingStatuses) return card;
      const existing = cardCategories(card);
      const updated = existing.map(value => renamed.get(value.toLowerCase()) ?? value).filter(Boolean);
      return sameStrings(existing, updated) ? card : withCategories(card, updated);
    }));
    storeCategories(editingStatuses, next);
    selectFilter("All cards");
    setEditingStatuses(null);
  }
  function editCurrentTabs() {
    setValueDraft(groupValues);
    setEditingValues(groupBy as "keyword" | "project");
  }
  function saveEditedValues(){if(!editingValues)return;const before=groupValues;const next=valueDraft.map(value=>value.trim());change(cs=>{const updated=cs.map(card=>{if(editingValues==="keyword"){return {...card,keywords:Array.from(new Set(card.keywords.map(keyword=>{const i=before.indexOf(keyword);return i<0?keyword:(next[i]||"")}).filter(Boolean)))}}if(!projectPath.every((level,i)=>card.projects[i]===level))return card;const old=card.projects[projectPath.length];const i=before.indexOf(old);if(i<0)return card;const projects=[...card.projects];if(next[i])projects[projectPath.length]=next[i];else projects.splice(projectPath.length,1);return {...card,projects,title:card.kind==="project"&&card.projects.length===projectPath.length+1?(next[i]||card.title):card.title}});if(editingValues!=="project")return updated;const additions=next.slice(before.length).filter(Boolean).filter(name=>!before.includes(name)).map((name,i)=>({...blank("project"),id:Date.now()+i,title:name,projects:[...projectPath,name].slice(0,5)}));return [...additions,...updated]});setEditingValues(null)}
  function addCategoryFromCard(card:Card){setNewCategoryName("");setAddingCategoryFor(card.id)}
  function saveNewCategory() {
    const category = newCategoryName.trim();
    const card = openCardRef.current;
    if (!category || !card || card.id !== addingCategoryFor) return;
    const collection = card.kind || "paper";
    if (!isCategoryCollection(collection)) return;
    const categories = categoryLists[collection];
    const existing = categories.find(name => name.toLowerCase() === category.toLowerCase());
    if (!existing) storeCategories(collection, [...categories, category]);
    update(withCategories(card, [...cardCategories(card), existing || category]), true);
    setAddingCategoryFor(null);
    setNewCategoryName("");
  }
  function toggleCategory(category: string) {
    const card = openCardRef.current;
    if (!card) return;
    const current = cardCategories(card);
    const exists = current.some(value => value.toLowerCase() === category.toLowerCase());
    update(withCategories(card, exists ? current.filter(value => value.toLowerCase() !== category.toLowerCase()) : [...current, category]), true);
  }
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
    const cardId = openCardRef.current?.id;
    if (cardId === undefined) return;
    const results = await Promise.allSettled(Array.from(files).filter(file => file.type.startsWith("image/")).map(async (file): Promise<Figure> => {
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          value => value ? resolve(value) : reject(new Error("Could not encode figure")), "image/jpeg", .82));
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
        return { id: Date.now() + Math.random(), name: file.name, data };
      } finally {
        URL.revokeObjectURL(url);
      }
    }));
    const additions = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    if (results.some(result => result.status === "rejected")) alert("Some figures could not be read.");
    if (!additions.length) return;
    const current = openCardRef.current;
    if (current?.id === cardId) patchOpen({ images: [...(current.images || []), ...additions] }, true);
    else setCards(cards => cards.map(card => card.id === cardId ? { ...card, images: [...(card.images || []), ...additions] } : card));
  }
  useEffect(()=>{const paste=(event:ClipboardEvent)=>{if(!openCardRef.current)return;const images=Array.from(event.clipboardData?.files||[]).filter(file=>file.type.startsWith("image/"));if(!images.length)return;event.preventDefault();const transfer=new DataTransfer();images.forEach(file=>transfer.items.add(file));attachImages(transfer.files)};window.addEventListener("paste",paste);return()=>window.removeEventListener("paste",paste)},[]);
  function download(kind: "json"|"csv"|"md"|"doc", suppliedBody="") {
    let body = "", type = "text/plain";
    if(kind==="doc"){body=suppliedBody;type="application/msword"}
    if (kind === "json") { body = JSON.stringify({ version: 3, ...library }, null, 2); type = "application/json"; }
    if (kind === "csv") { const keys = Object.keys(cards[0]) as (keyof Card)[]; body = [keys.join(","), ...cards.map(c => keys.map(k => `"${String(Array.isArray(c[k]) ? (c[k] as string[]).join("; ") : c[k]).replaceAll('"','""')}"`).join(","))].join("\n"); type="text/csv"; }
    if (kind === "md") body = cards.map(c => `# ${c.title}\n\n**${c.authors} (${c.year})** — ${c.journal}\n\n## Key findings\n${c.findings}\n\n## Methods\n${c.methods}\n\n## Limitations\n${c.limitations}\n\n## My notes\n${c.notes}\n`).join("\n---\n\n");
    if(window.literatureBox){window.literatureBox.exportFile(kind,body);return} const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([body],{type})); a.download=`literature-box.${kind}`; a.click(); URL.revokeObjectURL(a.href);
  }
  async function confirmClearAll(){
    if(clearConfirmation!=="DELETE ALL")return;
    const body=JSON.stringify({ version: 3, ...library },null,2);
    if(window.literatureBox){const saved=await window.literatureBox.exportFile("json",body);if(saved===false)return}
    else{const a=document.createElement("a");const url=URL.createObjectURL(new Blob([body],{type:"application/json"}));a.href=url;a.download="literature-box-before-delete.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
    if(editorCommitTimer.current)clearTimeout(editorCommitTimer.current);editorCommitTimer.current=null;pendingCard.current=null;pendingRich.current={};discardStagedCards();draftStarted.current=0;setHasDraft(false);openCardRef.current=null;setReturnToCard(null);history.current.push(cards);future.current=[];setCards([]);setOpen(null);setPosition(0);setFilter("All cards");setProjectPath([]);setTopicOrder([]);setClearingAll(false);setClearConfirmation("");
  }
  function topicDocumentContent(){
    const papers=cards.filter(c=>(c.kind||"paper")==="paper").sort((a,b)=>(a.projects.join(" > ")||"Unfiled").localeCompare(b.projects.join(" > ")||"Unfiled")||a.title.localeCompare(b.title));
    let previous:string[]=[];let content="";
    papers.forEach(card=>{const path=card.projects.length?card.projects.slice(0,5):["Unfiled"];path.forEach((level,i)=>{if(previous[i]!==level){content+=`<h${i+1} class="project-heading level-${i+1}">${escapeHtml(level)}</h${i+1}>`}});previous=path;content+=`<article><h2 class="paper-title">${escapeHtml(card.title)}</h2><p class="citation">${escapeHtml(card.authors)}${card.year?` (${escapeHtml(card.year)})`:""}${card.journal?` — <i>${escapeHtml(card.journal)}</i>`:""}</p>${card.doi?`<p class="doi">DOI: ${escapeHtml(card.doi)}</p>`:""}${card.findings?`<div class="paper-section"><b>Key findings:</b> ${safeRichHtml(card.findings)}</div>`:""}${card.images?.length?`<div class="figures">${card.images.map(image=>`<figure><img src="${escapeHtml(image.data)}"/><figcaption>${escapeHtml(image.caption || image.name).replace(/\n/g, "<br>")}</figcaption></figure>`).join("")}</div>`:""}${card.methods?`<p class="paper-section"><b>Method:</b> ${escapeHtml(card.methods)}</p>`:""}${card.limitations?`<p class="paper-section"><b>Limitations:</b> ${escapeHtml(card.limitations)}</p>`:""}${card.notes?`<div class="paper-section"><b>My notes:</b> ${safeRichHtml(card.notes)}</div>`:""}</article>`});
    return content||"<h1>No paper cards</h1>";
  }
  const documentStyles=`body{font:11pt/1.55 Georgia,serif;color:#26211d;max-width:760px;margin:auto}h1{font-size:26pt;border-bottom:2px solid #6f442c;padding-bottom:8px;page-break-before:always}h1:first-child{page-break-before:auto}h2.project-heading{font-size:20pt;color:#60422f;border-bottom:1px solid #b9a58b}h3.project-heading{font-size:16pt;color:#72533d}h4.project-heading,h5.project-heading{font-size:13pt;color:#80644d}.paper-title{font-size:16pt;margin:0 0 5px;border:0;color:#251e19}.citation,.doi{margin:3px 0;color:#655c53}.doi{font-size:9pt}article{margin:20px 0 30px;padding:0 0 20px;border-bottom:1px solid #d8cdbc;page-break-inside:avoid}.paper-section{margin:9px 0}.paper-section>b{color:#5f4d41}.figures{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0}.figures figure{margin:0}.figures img{width:100%;max-height:260px;object-fit:contain}.figures figcaption{font-size:8pt;color:#756b61}`;
  function exportWord(){download("doc",`<!doctype html><html><head><meta charset="utf-8"><title>Literature Box — by topic</title><style>${documentStyles}</style></head><body>${topicDocumentContent()}</body></html>`)}
  function exportPdf(){
    const frame=document.createElement("iframe");frame.style.position="fixed";frame.style.right="0";frame.style.bottom="0";frame.style.width="0";frame.style.height="0";frame.style.border="0";document.body.appendChild(frame);const doc=frame.contentDocument;if(!doc)return;doc.open();doc.write(`<!doctype html><html><head><title>Literature Box — by topic</title><style>@page{margin:20mm}${documentStyles}@media print{body{max-width:none}}</style></head><body>${topicDocumentContent()}</body></html>`);doc.close();setTimeout(()=>{frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),1000)},250)}

  async function importJson(file: File) {
    try {
      const data = JSON.parse(await file.text());
      const imported: Card[] | undefined = Array.isArray(data) ? data : data?.cards;
      if (!Array.isArray(imported) || imported.some(card => !card || !Number.isFinite(card.id) || typeof card.title !== "string" || typeof card.authors !== "string")) {
        throw new Error("Invalid card backup");
      }
      const signature = (card: Card) => card.kind === "note"
        ? JSON.stringify(["note", card.id, card.title, card.notes])
        : JSON.stringify([card.kind || "paper", card.title.trim().toLowerCase(), authorIdentity(card.authors), card.year]);
      setCards(current => {
        const existing = new Map(current.map(card => [signature(card), card.id]));
        const usedIds = new Set(current.map(card => card.id));
        const remappedIds = new Map<number, number>();
        const additions: Card[] = [];
        let nextId = Date.now();
        imported.forEach((card, index) => {
          const key = signature(card);
          const duplicate = existing.get(key);
          if (duplicate !== undefined) { remappedIds.set(card.id, duplicate); return; }
          while (usedIds.has(nextId)) nextId++;
          const id = usedIds.has(card.id) ? nextId++ : card.id;
          usedIds.add(id);
          existing.set(key, id);
          remappedIds.set(card.id, id);
          additions.push(withCategories({
            ...card, id, createdAt: card.createdAt || (card.id > 1_000_000_000_000 ? card.id : Date.now() - (imported.length - index) * 1000),
          }, cardCategories(card)));
        });
        return [...additions.map(card => ({
          ...card,
          findings: remapInlineLinks(card.findings || "", remappedIds),
          notes: remapInlineLinks(card.notes || "", remappedIds),
          ...(card.relatedCardIds && { relatedCardIds: Array.from(new Set(card.relatedCardIds.map(id => remappedIds.get(id) ?? id))) }),
        })), ...current];
      });
      if (Array.isArray(data.statuses)) setStatuses(current => Array.from(new Set([...current, ...data.statuses])));
      if (data.collectionCategories) setCollectionCategories(current => {
        const merge = (collection: keyof CollectionCategories) => {
          const names = data.collectionCategories[collection];
          return Array.from(new Set([...current[collection], ...(Array.isArray(names) ? names.filter((name: unknown) => typeof name === "string") : [])]));
        };
        return { author: merge("author"), journal: merge("journal"), note: merge("note") };
      });
      if (Array.isArray(data.topicOrder)) setTopicOrder(current => Array.from(new Set([...current, ...data.topicOrder])));
    } catch {
      alert("That file is not a valid Literature Box JSON backup.");
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">L</span><div><h1>{displayName}</h1><p>{displayedCardCount} cards · stored on this device</p></div></div>
      <div className="top-actions">
        <label className="import-btn">↥ Import<input type="file" accept=".json" onChange={e => e.target.files?.[0] && importJson(e.target.files[0])}/></label>
        <details className="export-menu"><summary>↓ Export</summary><div><button onClick={exportPdf}>PDF by topic</button><button onClick={exportWord}>Word by topic</button><button onClick={()=>download("md")}>Markdown</button><button onClick={()=>download("csv")}>CSV</button><button onClick={()=>download("json")}>JSON backup</button></div></details>
        <button className="data-btn" onClick={()=>{setClearConfirmation("");setClearingAll(true)}}>Data</button>
        <button onClick={undo} disabled={!history.current.length}>↶ Undo</button><button onClick={redo} disabled={!future.current.length}>↷ Redo</button><button className="add-btn" title="Ctrl+N / ⌘N" onClick={addCard} disabled={!ready}>{kind === "note" ? "＋ Add note" : "＋ Add new card"}</button>
      </div>
    </header>

    <nav className="collections" aria-label="Card boxes">{(Object.keys(collectionLabels) as Collection[]).map(k => <button key={k} className={kind === k ? "active" : ""} onClick={() => { setKind(k); searchCards(""); selectFilter("All cards"); setSort(previous => k === "paper" || ["newest", "oldest", "author", "title"].includes(previous) ? previous : "title"); }}><span>{collectionLabels[k]}</span><em>{collectionCounts[k]}</em></button>)}</nav>

    <section className="controls">
      <label className="search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>searchCards(e.target.value)} placeholder="Search notes, authors, or keywords…"/>{query&&<button type="button" className="clear-search" aria-label="Clear search" onClick={()=>{searchCards("");searchRef.current?.focus()}}>×</button>}<kbd>⌘ K</kbd></label>
      <FacetMenu title="Keywords" values={allTags} count={keywordFacetCount} onSelect={searchCards}/>
      {kind==="paper"&&<FacetMenu title="Authors" values={allAuthors} count={authorFacetCount} onSelect={searchCards}/>}
      {kind==="paper"&&<button type="button" className={duplicatesOnly?"duplicate-filter active":"duplicate-filter"} aria-pressed={duplicatesOnly} onClick={()=>{setDuplicatesOnly(value=>!value);setPosition(0)}}>Duplicates <em>{duplicateCardCount}</em></button>}
      <label className="sort">Sort by <select value={sort} onChange={e=>{setSort(e.target.value);setPosition(0)}}>{kind==="paper"&&<><option value="project">Topic</option><option value="keyword">Keyword</option></>}<option value="newest">Newest cards first</option><option value="oldest">Oldest cards first</option><option value="author">Author</option><option value="title">Title</option></select></label>
      <span className={`save-state ${saveStatus}`} role="status">{statusText}{loadError && <button type="button" onClick={() => location.reload()}>Reload</button>}{saveStatus === "error" && <button type="button" onClick={() => void flushAndSave()}>Retry save</button>}</span>
    </section>

    {kind==="paper"&&<nav className="dividers organizer-tabs" aria-label="Choose organization">
      {([['all','All cards'],['project','Topics'],['status','Categories'],['keyword','Keywords'],['author','Authors']] as const).map(([value,label])=><button key={value} className={groupBy===value?"active":""} onClick={()=>{setGroupBy(value);selectFilter("All cards");setProjectPath([]);setIntroExpanded(false)}}><span>{label}</span>{value==="all"&&<em>{visible.length}</em>}</button>)}
    </nav>}
    {(kind !== "paper" || groupBy === "status") && <nav className="dividers value-tabs" aria-label="Card categories">
      {kind !== "paper" && <button className={filter === "All cards" ? "active" : ""} onClick={() => selectFilter("All cards")}><span>All cards</span><em>{matchingKindCards.length}</em></button>}
      <button className={filter==="Without category"?"active":""} onClick={()=>selectFilter("Without category")}><span>Without category</span><em>{facetCounts.statusesMap.get("")||0}</em></button>
      {categoryLists[kind].map(category => <button key={category} className={filter === categoryFilter(category) ? "active" : ""}
        onClick={() => selectFilter(categoryFilter(category))} onDragOver={e => e.preventDefault()} onDrop={e => {
          const id = Number(e.dataTransfer.getData("text/plain"));
          change(cards => cards.map(card => card.id === id && (card.kind || "paper") === kind
            ? withCategories(card, [...cardCategories(card), category]) : card));
          selectFilter(categoryFilter(category));
        }}><span>{category}</span><em>{facetCounts.statusesMap.get(category.toLowerCase()) || 0}</em></button>)}
      <button className="edit-statuses" onClick={() => editCategories(kind)}>＋ Edit categories</button>
    </nav>}
    <div className={kind==="paper"&&groupBy==="project"?"topic-layout":kind==="paper"&&(groupBy==="keyword"||groupBy==="author")?"value-navigation-layout":""}>
    {kind==="paper"&&groupBy==="project"&&<aside className="topic-navigation-panel"><TopicNavigation paths={existingTopicPaths} selected={projectPath} onSelect={selectProjectPath} onEdit={editCurrentTabs} onDropCard={(id,path)=>change(cs=>cs.map(card=>card.id===id?{...card,projects:path}:card))} onReorder={reorderTopic} onRename={renameTopic} customOrder={topicOrder} count={topicCount} total={matchingKindCards.length} unfiledCount={matchingKindCards.filter(card=>!card.projects.length).length} showUnfiled={filter==="Without topic"} onSelectUnfiled={()=>{setProjectPath([]);selectFilter("Without topic")}}/>{projectPath.length>0&&<div className="topic-intro-panel"><nav className="topic-breadcrumb" aria-label="Topic path"><button onClick={()=>selectProjectPath([])}>Topics</button>{projectPath.map((level,i)=><button key={`${level}-${i}`} className={i===projectPath.length-1?"active":""} onClick={()=>selectProjectPath(projectPath.slice(0,i+1))}>› {level}</button>)}</nav><div className="topic-intro-trail">{topicTrail.map((item,i)=>{const html=item.card?.findings||"";const current=i===topicTrail.length-1;return <section key={item.path.join("/")} className={current?"topic-intro-item current":"topic-intro-item"} role="button" tabIndex={0} onClick={()=>item.card&&openCard(item.card)} onKeyDown={e=>{if((e.key==="Enter"||e.key===" ")&&item.card)openCard(item.card)}}><small>{i===0?"Topic":`Level ${i+1}`}</small><h2>{item.level}</h2>{html?<RichPreview html={html} className={`topic-intro-content ${current&&introExpanded?"expanded":""}`} onOpenCard={openLinkedCard}/>:<p className="topic-intro-content">No introduction yet.</p>}<em>Edit introduction ↗</em></section>})}</div>{plain(selectedProjectCard?.findings||"").length>220&&<button className="intro-toggle" onClick={()=>setIntroExpanded(v=>!v)}>{introExpanded?"Show less":"Show more"}</button>}</div>}</aside>}

    {kind==="paper"&&(groupBy==="keyword"||groupBy==="author")&&<aside className="value-navigation-panel"><ValueNavigation key={groupBy} title={groupBy==="keyword"?"Keywords":"Authors"} values={groupValues} selected={filter} onSelect={selectFilter} count={groupCount} onEdit={groupBy==="keyword"?editCurrentTabs:undefined} onDropCard={groupBy==="keyword"?(id,value)=>{change(cs=>cs.map(card=>card.id===id?{...card,keywords:Array.from(new Set([...card.keywords,value]))}:card));selectFilter(value)}:undefined}/></aside>}

    <section className="deck-area">
      <div className="deck-heading"><span>{visible.length} {visible.length===1?"card":"cards"} in this stack</span><button type="button" className={previewExpanded?"global-preview-toggle active":"global-preview-toggle"} onClick={()=>setPreviewExpanded(value=>!value)}>{previewExpanded?"✓ Expanded cards":"Expand all cards"}</button><span>Use ← → or click to flip</span></div>
      {currentItem ? <div className="deck-wrap">
        <button className="flip prev" aria-label="Previous card" disabled={boundedPosition===0} onClick={()=>setPosition(Math.max(0,boundedPosition-1))}>←</button>
        <div className="deck-shadow shadow-three"/><div className="deck-shadow shadow-two"/><div className="deck-shadow shadow-one"/>
        <article ref={cardPreviewRef} className={`note-card deck-card ${kind}-card ${previewExpanded?"preview-expanded":""}`} key={currentItem.card.id} draggable onDragStart={e=>e.dataTransfer.setData("text/plain",String(currentItem.card.id))} onClick={()=>openCard(currentItem.card)}>
          <div className="card-number">{String(boundedPosition+1).padStart(2,"0")} / {String(deckItems.length).padStart(2,"0")}</div>{kind==="paper"?<span className={`status-dot ${cardCategories(currentItem.card)[0]?.toLowerCase().replace(" ","-")||"uncategorized"}`}>{cardCategories(currentItem.card).join(" · ")||"Uncategorized"}</span>:<span className="status-dot">{cardCategories(currentItem.card).join(" · ") || kind}</span>}{(duplicateTitleCounts.get(duplicateTitleKey(currentItem.card))||0)>1&&<span className="duplicate-mark" title="Another paper card has the same title">Duplicate title ×{duplicateTitleCounts.get(duplicateTitleKey(currentItem.card))}</span>}
          {(()=>{const current=currentItem.card;const matchedDetails=deferredQuery.trim()?[['Methods',current.methods],['Limitations',current.limitations],['My notes',plain(current.notes)]].filter(([,text])=>text.toLowerCase().includes(deferredQuery.trim().toLowerCase())).map(([label,text])=>[label,searchExcerpt(text,deferredQuery)]):[];return <>
          <h2><HighlightText text={current.title} term={deferredQuery}/></h2>{kind !== "note" && <><p className="citation"><HighlightText text={kind==="paper"?firstAuthor(current.authors):current.authors} term={deferredQuery}/>{current.year&&<> · <HighlightText text={current.year} term={deferredQuery}/></>}</p><p className="journal"><HighlightText text={current.journal} term={deferredQuery}/>{current.doi&&<> · <a href={`https://doi.org/${current.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"")}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>DOI</a></>}</p></>}{kind === "journal" && <JournalSummary card={current} term={deferredQuery}/>}<div className="rule"/>
          <RichPreview className="finding rich-preview" html={kind === "note" ? current.notes : current.findings} term={deferredQuery} onOpenCard={openLinkedCard} compact={!previewExpanded}/>{previewExpanded && kind !== "note" &&<div className="preview-details">{current.methods&&<p><b>Methods:</b> <HighlightText text={current.methods} term={deferredQuery}/></p>}{current.limitations&&<p><b>Limitations:</b> <HighlightText text={current.limitations} term={deferredQuery}/></p>}{plain(current.notes)&&<div className="preview-rich-row"><b>My notes:</b><RichPreview className="rich-preview compact" html={current.notes} term={deferredQuery} onOpenCard={openLinkedCard}/></div>}</div>}{kind !== "note" && !previewExpanded&&matchedDetails.length>0&&<div className="search-matches">{matchedDetails.map(([label,text])=><p key={label}><b>{label}</b><span><HighlightText text={text} term={deferredQuery}/></span></p>)}</div>}<div className="tags">{current.keywords.slice(0,previewExpanded?12:4).map(t=><button key={t} onClick={e=>{e.stopPropagation();searchCards(t)}}><HighlightText text={t} term={deferredQuery}/></button>)}</div>
          {!!current.images?.length&&<div className="card-thumbs">{current.images.slice(0,3).map((image,i)=><button type="button" key={image.id} aria-label={`Enlarge ${image.name}`} onClick={e=>{e.stopPropagation();showFigure(current.id, image.id)}} style={{transform:`rotate(${i%2?2:-2}deg)`}}><img src={image.data} alt={image.name}/></button>)}{current.images.length>3&&<em>+{current.images.length-3}</em>}</div>}
          <footer><span title={current.projects.join(" › ")}>{current.projects.join(" › ") || (kind==="paper"?"Unfiled":kind==="author"?"Author card":kind==="note"?"Note card":"Journal card")}</span><b>Click to read & edit ↗</b></footer></>})()}
        </article>
        <button className="flip next" aria-label="Next card" disabled={boundedPosition>=deckItems.length-1} onClick={()=>setPosition(Math.min(deckItems.length-1,boundedPosition+1))}>→</button>
      </div> : <div className="empty"><b>No cards found</b><span>Try another phrase or divider.</span></div>}
      <div className="deck-dots">{deckItems.slice(Math.max(0,boundedPosition-3),boundedPosition+4).map((item,index)=>{const itemPosition=Math.max(0,boundedPosition-3)+index;return <button key={item.card.id} className={itemPosition===boundedPosition?"active":""} onClick={()=>setPosition(itemPosition)} aria-label="Open page"/>})}</div>
    </section></div>

    {open && <div className="modal-backdrop editor-backdrop" onKeyDownCapture={postponeAutosave} onPointerDownCapture={postponeAutosave} onWheelCapture={postponeAutosave} onClick={e=>{if(e.target===e.currentTarget)closeCard()}}><section key={open.id} className={open.kind === "note" ? "card-modal note-modal" : "card-modal"} role="dialog" aria-modal="true" aria-label={open.title}>
      <div className="modal-top"><span className="catalog-label">{open.kind==="project"?"TOPIC":(open.kind||"paper").toUpperCase()} CARD{open.kind !== "note" && <> · {open.year || "UNDATED"}</>}</span><button aria-label="Close card" onClick={closeCard}>×</button></div>
      {(open.kind||"paper")==="paper"&&<CitationImporter onIdentify={fields=>patchOpen(Object.fromEntries(Object.entries(fields).filter(([,value])=>value)),true)}/>}
      {linkedBackId === open.id && <button type="button" className="linked-flip" onClick={flipLinkedToFront}>Flip to front</button>}
      <DraftInput aria-label="Card title" className="title-input" value={open.title} onCommit={(title, immediate) => patchOpen({ title }, immediate)}/>
      {open.kind!=="project"&&open.kind!=="note"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Authors":(open.kind==="author"?"Affiliation":"Publisher")}<DraftInput value={open.authors} placeholder={(open.kind||"paper")==="paper"?"Lastname, Firstname; or Firstname Lastname":""} onCommit={(authors, immediate) => patchOpen({ authors }, immediate)}/>{(open.kind||"paper")==="paper"&&<small className="field-help">Either name order works. Separate multiple authors with semicolons.</small>}</label><label className="year-field">{open.kind==="author"?"Years":"Year"}<DraftInput value={open.year} onCommit={(year, immediate) => patchOpen({ year }, immediate)}/></label></div>}
      {open.kind!=="project"&&open.kind!=="note"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Journal":open.kind==="author"?"Department / field":"Frequency / location"}<DraftInput value={open.journal} onCommit={(journal, immediate) => patchOpen({ journal }, immediate)}/></label>{(open.kind||"paper")==="paper"&&<label>DOI<div className="doi-field"><DraftInput value={open.doi} onCommit={(doi, immediate) => patchOpen({ doi }, immediate)}/>{open.doi&&<a href={`https://doi.org/${open.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"")}`} target="_blank" rel="noreferrer">Open ↗</a>}</div></label>}</div>}
      {open.kind==="journal"&&<div className="journal-metrics"><label>Quartile<DraftInput value={open.quartile||""} placeholder="e.g. Q1" onCommit={(quartile, immediate) => patchOpen({ quartile }, immediate)}/></label><label>Impact factor<DraftInput value={open.impactFactor||""} onCommit={(impactFactor, immediate) => patchOpen({ impactFactor }, immediate)}/></label><label>Acceptance rate<DraftInput value={open.acceptanceRate||""} placeholder="e.g. 12%" onCommit={(acceptanceRate, immediate) => patchOpen({ acceptanceRate }, immediate)}/></label><label>Median to first decision<DraftInput value={open.medianFirstDecision||""} placeholder="e.g. 21 days" onCommit={(medianFirstDecision, immediate) => patchOpen({ medianFirstDecision }, immediate)}/></label></div>}
      {open.kind!=="project"&&<TagField label="Keywords" values={open.keywords} suggestions={allKeywords} onChange={(keywords, immediate) => patchOpen({ keywords }, immediate)}/>}
      {isCategoryCollection(openCollection) && <div className="field-row">
        {openCollection === "paper" && <ProjectField values={open.projects} suggestions={existingTopicPaths} onChange={(projects, immediate) => patchOpen({ projects }, immediate)}/>}
        <div className="category-picker"><span className="category-picker-title">Categories</span><div className="category-options">
          {openCategories.map(category => {
            const active = cardCategories(open).some(value => value.toLowerCase() === category.toLowerCase());
            return <button type="button" key={category} className={active ? "active" : ""} aria-pressed={active} onClick={() => toggleCategory(category)}>{active ? "✓ " : "＋ "}{category}</button>;
          })}
          {!openCategories.length && <small>No categories yet.</small>}
        </div><button type="button" className="new-category-button" onClick={() => addCategoryFromCard(open)}>＋ New category</button></div>
      </div>}
      {open.kind !== "note" && <RichField label={(open.kind||"paper")==="paper"?"Key findings":open.kind==="author"?"Profile":open.kind==="project"?"Topic introduction":"Journal overview"} value={open.findings} onDraft={draftFindings} cards={linkableCards} onOpenCard={openLinkedCard}/>}
      {open.kind === "note" && <RichField label="Note" value={open.notes} onDraft={draftNotes} cards={linkableCards} onOpenCard={openLinkedCard} large/>}
      {open.kind === "note" && <section className="note-links" aria-label="Linked cards">
        <h3>Linked cards</h3>
        {noteLinks.length > 0 && <ul>{noteLinks.map(id => {
          const linked = linkedCardsById.get(id);
          return <li key={id}>
            <button type="button" onClick={() => openLinkedCard(id)} disabled={!linked}><small>{linked?.kind || "Unavailable"}</small> {linked?.title || "Missing card"} ↗</button>
            {open.relatedCardIds?.includes(id) && <button type="button" aria-label={`Remove link to ${linked?.title || "missing card"}`} onClick={() => patchOpen({ relatedCardIds: (openCardRef.current?.relatedCardIds || []).filter(item => item !== id) }, true)}>×</button>}
          </li>;
        })}</ul>}
        <details><summary>＋ Link cards</summary><CardLinkPicker cards={linkableCards} excluded={noteLinks} onPick={card =>
          patchOpen({ relatedCardIds: [...(openCardRef.current?.relatedCardIds || []), card.id] }, true)}/></details>
        <small>Use the Link button to place links directly in your text. Ctrl/⌘ + click to follow a link while editing.</small>
      </section>}
      <div className="attachments findings-images"><div className="attachment-head"><span>Images · paste anywhere with Ctrl/⌘ + V</span><label className="attach-button">＋ Attach images<input type="file" accept="image/*" multiple onChange={event => { if (event.target.files) void attachImages(event.target.files); event.target.value = ""; }}/></label></div>
        {open.images?.length ? <FigureGrid figures={open.images} onPreview={id => showFigure(open.id, id)} onMove={moveFigure}
          onRemove={id => patchOpen({ images: (openCardRef.current?.images || []).filter(item => item.id !== id) }, true)}
          renderCaption={(figure, index) => <DraftTextarea aria-label={`Caption for figure ${index + 1}`} value={figure.caption || ""}
            placeholder="Add a caption…" rows={2} onCommit={(caption, immediate) => captionFigure(figure.id, caption, immediate)}/>} />
          : <p className="attachment-empty">Add figures, diagrams, screenshots, or handwritten notes.</p>}
      </div>
      {open.kind!=="project"&&open.kind!=="note"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Methods":open.kind==="author"?"Approach / traditions":"Scope"}<DraftTextarea value={open.methods} onKeyDown={allowTab} onCommit={(methods, immediate) => patchOpen({ methods }, immediate)}/></label><label>{(open.kind||"paper")==="paper"?"Limitations":open.kind==="author"?"Cautions / critiques":"Submission notes"}<DraftTextarea value={open.limitations} onKeyDown={allowTab} onCommit={(limitations, immediate) => patchOpen({ limitations }, immediate)}/></label></div>}
      {open.kind !== "note" && <RichField label="My notes" value={open.notes} onDraft={draftNotes} cards={linkableCards} onOpenCard={openLinkedCard}/>}
      {open.kind!=="project"&&open.kind!=="note"&&<label>PDF or EndNote link<DraftInput value={open.link} placeholder="https://…" onCommit={(link, immediate) => patchOpen({ link }, immediate)}/></label>}
      <div className="modal-foot"><button className="delete" onClick={()=>{if(confirm("Remove this card?"))removeOpenCard()}}>Remove card</button><div className="editor-save-controls"><span role="status">{statusText}</span>{saveStatus === "error" && <button type="button" onClick={() => void flushAndSave()}>Retry save</button>}</div><button className="done" onClick={closeCard}>{returnToCard !== null ? "Back to original card" : "Done"}</button></div>
    </section></div>}
    {editingStatuses&&<div className="modal-backdrop"><section className="status-editor" role="dialog" aria-modal="true" aria-label="Edit categories"><div className="modal-top"><div><span className="catalog-label">{collectionLabels[editingStatuses].toUpperCase()} · CATEGORIES</span><h2>Edit categories</h2></div><button aria-label="Close" onClick={()=>setEditingStatuses(null)}>×</button></div><p>Add as many categories as you need. Their order becomes the tab order.</p><div className="status-fields">{statusDraft.map((status,i)=><div key={i}><span>{i+1}</span><input value={status} autoFocus={i===0} onChange={e=>setStatusDraft(ds=>ds.map((d,n)=>n===i?e.target.value:d))}/><button aria-label={`Remove ${status}`} onClick={()=>setStatusDraft(ds=>ds.map((value,n)=>n===i?"":value))}>×</button></div>)}</div><button className="add-status" onClick={()=>setStatusDraft(ds=>[...ds,`Category ${ds.length+1}`])}>＋ Add category</button><div className="modal-foot"><button onClick={()=>setEditingStatuses(null)}>Cancel</button><span>{statusDraft.length} categories</span><button className="done" onClick={saveCategories}>Save categories</button></div></section></div>}
    {editingValues&&<div className="modal-backdrop"><section className="status-editor" role="dialog" aria-modal="true"><div className="modal-top"><div><span className="catalog-label">{editingValues==="project"?"TOPIC LEVEL":"KEYWORDS"}</span><h2>Edit {editingValues==="project"?"topics":"keywords"}</h2></div><button aria-label="Close" onClick={()=>setEditingValues(null)}>×</button></div><p>{editingValues==="project"?(projectPath.length?`Manage subtopics under ${projectPath.at(-1)}.`:"Manage top-level topics."):"Rename an item below, or remove it from every card."}</p><div className="status-fields">{valueDraft.map((value,i)=><div key={i}><span>{i+1}</span><input value={value} autoFocus={i===0} placeholder={editingValues==="project"?"Topic name":"Keyword"} onChange={e=>setValueDraft(values=>values.map((item,n)=>n===i?e.target.value:item))}/><button aria-label={`Remove ${value}`} onClick={()=>setValueDraft(values=>values.map((item,n)=>n===i?"":item))}>×</button></div>)}</div>{editingValues==="project"&&projectPath.length<5&&<button className="add-status" onClick={()=>setValueDraft(values=>[...values,""])}>＋ Add topic here</button>}<div className="modal-foot"><button onClick={()=>setEditingValues(null)}>Cancel</button><span>{editingValues==="project"?"Maximum five levels":"Applies to all matching cards"}</span><button className="done" onClick={saveEditedValues}>Save changes</button></div></section></div>}
    {addingCategoryFor!==null&&<div className="modal-backdrop"><section className="status-editor compact-editor" role="dialog" aria-modal="true"><div className="modal-top"><div><span className="catalog-label">CARD CATEGORY</span><h2>Add a category</h2></div><button aria-label="Close" onClick={()=>setAddingCategoryFor(null)}>×</button></div><p>Enter a new name, or type an existing category to assign it.</p><input className="new-category-input" aria-label="Category name" autoFocus value={newCategoryName} list="category-names" onChange={e=>setNewCategoryName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveNewCategory()}}/><datalist id="category-names">{openCategories.map(status=><option key={status} value={status}/>)}</datalist><div className="modal-foot"><button onClick={()=>setAddingCategoryFor(null)}>Cancel</button><button className="done" disabled={!newCategoryName.trim()} onClick={saveNewCategory}>Add & assign</button></div></section></div>}
    {clearingAll&&<div className="modal-backdrop"><section className="status-editor danger-editor" role="dialog" aria-modal="true" aria-labelledby="delete-all-title"><div className="modal-top"><div><span className="catalog-label">DATA MANAGEMENT</span><h2 id="delete-all-title">Delete all cards?</h2></div><button aria-label="Close" onClick={()=>setClearingAll(false)}>×</button></div><p>A JSON backup will be created first. This removes every paper, author, journal, note, and topic card from this device.</p><label className="danger-confirm">Type <b>DELETE ALL</b> to confirm<input autoFocus value={clearConfirmation} onChange={e=>setClearConfirmation(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void confirmClearAll()}}/></label><div className="modal-foot"><button onClick={()=>setClearingAll(false)}>Cancel</button><span>{cards.length} cards</span><button className="delete-all-confirm" disabled={clearConfirmation!=="DELETE ALL"} onClick={()=>void confirmClearAll()}>Back up & delete all</button></div></section></div>}
    {linkedFront && <LinkedCardFront card={linkedFront} onOpenCard={openLinkedCard}
      onClose={() => setLinkedFront(null)} onFlip={flipLinkedToBack}/>}
    {figurePreview && galleryCard?.images?.some(image => image.id === figurePreview.imageId) &&
      <FigureLightbox figures={galleryCard.images} selected={figurePreview.imageId}
        onSelect={imageId => setFigurePreview({ cardId: figurePreview.cardId, imageId })} onClose={() => setFigurePreview(null)}/>}
  </main>;
}
