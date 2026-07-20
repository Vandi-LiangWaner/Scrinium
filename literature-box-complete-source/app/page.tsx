"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Card = {
  kind?: "paper"|"author"|"journal"|"topic";
  id: number; title: string; authors: string; year: string; journal: string; doi: string;
  topics: string[]; keywords: string[]; projects: string[]; status: string;
  findings: string; methods: string; limitations: string; notes: string; link: string;
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
const blank = (kind:"paper"|"author"|"journal"|"topic"): Card => ({ id: Date.now(), kind, title: kind==="paper"?"Untitled paper":kind==="author"?"Unnamed author":kind==="journal"?"Untitled journal":"Untitled topic", authors: "", year: "", journal: "", doi: "", topics: [], keywords: [], projects: [], status: kind==="paper"?"To read":"", findings: "", methods: "", limitations: "", notes: "", link: "", subtopics:[] });
const split = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
const plain = (s:string) => s.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ");
const authorParts=(value:string)=>value.split(/\s*;\s*/).filter(Boolean);
const authorIdentity=(value:string)=>authorParts(value).map(name=>{if(name.includes(",")){const [last,...rest]=name.split(",");return `${rest.join(" ").trim()} ${last.trim()}`.trim().toLowerCase()}const words=name.trim().split(/\s+/);return `${words.slice(0,-1).join(" ")} ${words.at(-1)||""}`.trim().toLowerCase()}).join(" ");
const authorSortKey=(value:string)=>{const first=authorParts(value)[0]||"";if(first.includes(","))return first.toLowerCase();const words=first.trim().split(/\s+/);return `${words.at(-1)||""}, ${words.slice(0,-1).join(" ")}`.toLowerCase()};
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

function CitationImporter({onIdentify}:{onIdentify:(fields:Partial<Card>)=>void}){
  const [citation,setCitation]=useState("");
  const identify=(value:string)=>{setCitation(value);if(value.trim())onIdentify(parseCitation(value))};
  return <label className="citation-importer">Paste text citation<textarea value={citation} placeholder="Paste an APA, Harvard, or similar bibliography entry…" onChange={e=>identify(e.target.value)}/><small className="field-help">Title, authors, year, journal, and DOI are identified automatically. Check the fields below before closing.</small></label>;
}
function RichField({label,value,onChange}:{label:string,value:string,onChange:(v:string)=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const editor=ref.current;if(editor&&document.activeElement!==editor&&editor.innerHTML!==value)editor.innerHTML=value},[value]);
  return <div className="rich-label"><span className="rich-title">{label}</span><span className="rich-tools">
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("bold")}}><b>B</b></button>
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("italic")}}><i>I</i></button>
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("insertUnorderedList")}}>• List</button>
  </span><div ref={ref} className="rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label={label} aria-multiline="true" onInput={e=>onChange(e.currentTarget.innerHTML)}/></div>
}

function TagField({label,values,onChange,suggestions=[]}:{label:string;values:string[];onChange:(values:string[])=>void;suggestions?:string[]}) {
  const [text,setText]=useState(values.join(", "));
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==input.current)setText(values.join(", "))},[values]);
  const commit=()=>{const parsed=split(text);setText(parsed.join(", "));onChange(parsed)};
  return <label>{label}<input ref={input} value={text} placeholder="Separate tags with commas" onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();input.current?.blur()}}}/>{suggestions.some(s=>!values.includes(s))&&<span className="tag-suggestions">{suggestions.filter(s=>!values.includes(s)).slice(0,10).map(s=><button type="button" key={s} onMouseDown={e=>e.preventDefault()} onClick={()=>{const next=[...values,s];setText(next.join(", "));onChange(next)}}>＋ {s}</button>)}</span>}</label>;
}

function ProjectField({values,onChange}:{values:string[];onChange:(values:string[])=>void}) {
  const [text,setText]=useState(values.join(" > "));
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==input.current)setText(values.join(" > "))},[values]);
  const commit=()=>{const levels=text.split(">").map(x=>x.trim()).filter(Boolean).slice(0,5);setText(levels.join(" > "));onChange(levels)};
  return <label>Project hierarchy<input ref={input} value={text} placeholder="Project > Section > Subsection (5 levels max)" onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();input.current?.blur()}}}/><small className="field-help">Separate levels with &gt;</small></label>;
}

export default function Home() {
  const [cards, setCards] = useState<Card[]>(seed);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All cards");
  const [open, setOpen] = useState<Card | null>(null);
  const [sort, setSort] = useState("topic");
  const [saved, setSaved] = useState(true);
  const [position, setPosition] = useState(0);
  const [kind, setKind] = useState<"paper"|"author"|"journal"|"topic">("paper");
  const [statuses,setStatuses]=useState(defaultStatuses);
  const [editingStatuses,setEditingStatuses]=useState(false);
  const [statusDraft,setStatusDraft]=useState(defaultStatuses);
  const history=useRef<Card[][]>([]);
  const searchRef=useRef<HTMLInputElement>(null);

  useEffect(() => { (async()=>{let raw:unknown=null;if(window.literatureBox)raw=await window.literatureBox.loadCards();if(!raw){const v=localStorage.getItem("literature-box-cards");if(v)try{raw=JSON.parse(v)}catch{}}const stored=Array.isArray(raw)?raw:(raw as {cards?:Card[]})?.cards;const savedStatuses=!Array.isArray(raw)&&(raw as {statuses?:string[]})?.statuses;if(savedStatuses?.length)setStatuses(savedStatuses.slice(0,5));if(stored){const migrated:Card[]=stored.map((c:Card)=>({...c,kind:c.kind||"paper",subtopics:c.subtopics||[]}));if(!migrated.some(c=>c.kind==="author"))migrated.push(seed.find(c=>c.kind==="author")!);if(!migrated.some(c=>c.kind==="journal"))migrated.push(seed.find(c=>c.kind==="journal")!);const topicNames=Array.from(new Set(migrated.filter(c=>(c.kind||"paper")==="paper").flatMap(c=>c.topics)));topicNames.forEach((title,i)=>{if(!migrated.some(c=>c.kind==="topic"&&c.title===title))migrated.push({...blank("topic"),id:3000+i,title})});setCards(migrated)}setReady(true)})() }, []);
  useEffect(() => { if (!ready) return; setSaved(false); const t = setTimeout(async() => { const state={cards,statuses};if(window.literatureBox)await window.literatureBox.saveCards(state);else localStorage.setItem("literature-box-cards", JSON.stringify(state)); setSaved(true); }, 350); return () => clearTimeout(t); }, [cards,statuses,ready]);

  const visible = useMemo(() => cards.filter(c => {
    const hay = `${JSON.stringify(c)} ${authorIdentity(c.authors)}`.toLowerCase();
    return (c.kind||"paper")===kind && (kind!=="paper" || filter === "All cards" || c.status === filter) && hay.includes(query.toLowerCase());
  }).sort((a,b) => sort === "topic" ? (a.topics[0]||a.title).localeCompare(b.topics[0]||b.title)||b.year.localeCompare(a.year) : sort === "author" ? authorSortKey(a.authors).localeCompare(authorSortKey(b.authors)) : sort === "title" ? a.title.localeCompare(b.title) : b.year.localeCompare(a.year)), [cards, query, filter, sort, kind]);
  useEffect(() => setPosition(0), [query, filter, sort, kind]);
  const topicCards=useMemo(()=>cards.filter(c=>c.kind==="topic"),[cards]);
  const deckItems=useMemo(()=>{if(kind!=="paper"||sort!=="topic")return visible.map(card=>({type:"card" as const,card}));const items:({type:"card";card:Card}|{type:"topic";topic:Card})[]=[];let last="";visible.forEach(card=>{const name=card.topics[0]||"Unfiled";if(name!==last){const topic=topicCards.find(t=>t.title===name)||{...blank("topic"),title:name};items.push({type:"topic",topic});last=name}items.push({type:"card",card})});return items},[visible,kind,sort,topicCards]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();searchRef.current?.focus()}else if(!open&&e.key==="ArrowRight")setPosition(p=>Math.min(deckItems.length-1,p+1));else if(!open&&e.key==="ArrowLeft")setPosition(p=>Math.max(0,p-1));else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[open,deckItems.length]);
  const currentItem=deckItems[Math.min(position,Math.max(deckItems.length-1,0))];
  const current=currentItem?.type==="card"?currentItem.card:null;
  const kindCards=useMemo(()=>cards.filter(c=>(c.kind||"paper")===kind),[cards,kind]);
  const allTags=useMemo(()=>Array.from(new Set(kindCards.flatMap(c=>[...c.topics,...(c.subtopics||[]),...c.keywords]))).sort(),[kindCards]);
  const allKeywords=useMemo(()=>Array.from(new Set(cards.flatMap(c=>c.keywords))).sort(),[cards]);
  const allSubtopics=useMemo(()=>Array.from(new Set(cards.flatMap(c=>c.subtopics||[]))).sort(),[cards]);
  const allAuthors=useMemo(()=>Array.from(new Set(cards.filter(c=>(c.kind||"paper")==="paper").flatMap(c=>authorParts(c.authors)))).sort((a,b)=>authorSortKey(a).localeCompare(authorSortKey(b))),[cards]);

  function change(fn:(cs:Card[])=>Card[]) { setCards(cs=>{history.current.push(cs); if(history.current.length>80)history.current.shift(); return fn(cs)}); }
  function update(card: Card) { setOpen(card); change(cs => cs.map(c => c.id === card.id ? card : c)); }
  function undo(){const previous=history.current.pop();if(previous){setCards(previous);if(open)setOpen(previous.find(c=>c.id===open.id)||null)}}
  function addCard() { const c = blank(kind); setCards(cs => [c, ...cs]); setOpen(c); }
  async function attachImages(files: FileList) {
    const additions=await Promise.all(Array.from(files).filter(f=>f.type.startsWith("image/")).map(file=>new Promise<{id:number;name:string;data:string}>((resolve,reject)=>{
      const reader=new FileReader(); reader.onerror=reject; reader.onload=()=>{const img=new Image(); img.onerror=reject; img.onload=()=>{const max=1600, scale=Math.min(1,max/Math.max(img.width,img.height)); const canvas=document.createElement("canvas"); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale); canvas.getContext("2d")?.drawImage(img,0,0,canvas.width,canvas.height); resolve({id:Date.now()+Math.random(),name:file.name,data:canvas.toDataURL("image/jpeg",.82)})}; img.src=String(reader.result)}; reader.readAsDataURL(file)
    })));
    if(open&&additions.length) update({...open,images:[...(open.images||[]),...additions]});
  }
  useEffect(()=>{if(!open)return;const paste=(event:ClipboardEvent)=>{const images=Array.from(event.clipboardData?.files||[]).filter(file=>file.type.startsWith("image/"));if(!images.length)return;event.preventDefault();const transfer=new DataTransfer();images.forEach(file=>transfer.items.add(file));attachImages(transfer.files)};window.addEventListener("paste",paste);return()=>window.removeEventListener("paste",paste)},[open]);
  function download(kind: "json"|"csv"|"md") {
    let body = "", type = "text/plain";
    if (kind === "json") { body = JSON.stringify({version:2,statuses,cards}, null, 2); type = "application/json"; }
    if (kind === "csv") { const keys = Object.keys(cards[0]) as (keyof Card)[]; body = [keys.join(","), ...cards.map(c => keys.map(k => `"${String(Array.isArray(c[k]) ? (c[k] as string[]).join("; ") : c[k]).replaceAll('"','""')}"`).join(","))].join("\n"); type="text/csv"; }
    if (kind === "md") body = cards.map(c => `# ${c.title}\n\n**${c.authors} (${c.year})** — ${c.journal}\n\n## Key findings\n${c.findings}\n\n## Methods\n${c.methods}\n\n## Limitations\n${c.limitations}\n\n## My notes\n${c.notes}\n`).join("\n---\n\n");
    if(window.literatureBox){window.literatureBox.exportFile(kind,body);return} const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([body],{type})); a.download=`literature-box.${kind}`; a.click(); URL.revokeObjectURL(a.href);
  }

  function importJson(file: File) { const r = new FileReader(); r.onload=() => { try { const data=JSON.parse(String(r.result)); if(Array.isArray(data))setCards(data);else if(Array.isArray(data.cards)){setCards(data.cards);if(Array.isArray(data.statuses))setStatuses(data.statuses.slice(0,5))} } catch { alert("That file is not valid JSON."); } }; r.readAsText(file); }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">L</span><div><h1>The Literature Box</h1><p>{cards.length} cards · stored on this device</p></div></div>
      <div className="top-actions">
        <label className="import-btn">↥ Import<input type="file" accept=".json" onChange={e => e.target.files?.[0] && importJson(e.target.files[0])}/></label>
        <details className="export-menu"><summary>↓ Export</summary><div><button onClick={()=>download("md")}>Markdown</button><button onClick={()=>download("csv")}>CSV</button><button onClick={()=>download("json")}>JSON backup</button></div></details>
        <button onClick={undo} disabled={!history.current.length}>↶ Undo</button><button className="add-btn" onClick={addCard}>＋ Add new card</button>
      </div>
    </header>

    <nav className="collections" aria-label="Card boxes">{(["paper","topic","author","journal"] as const).map(k=><button key={k} className={kind===k?"active":""} onClick={()=>{setKind(k);setQuery("");setFilter("All cards");setSort(k==="paper"?"topic":"title")}}><span>{k==="paper"?"Papers":k==="topic"?"Topics":k==="author"?"Authors":"Journals"}</span><em>{cards.filter(c=>(c.kind||"paper")===k).length}</em></button>)}</nav>

    <section className="controls">
      <label className="search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search notes, authors, or tags…"/><kbd>⌘ K</kbd></label>
      <details className="tag-search"><summary>Tags ▾</summary><div>{allTags.map(tag=><button key={tag} onClick={e=>{setQuery(tag);(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}}>{tag}<em>{cards.filter(c=>[...c.topics,...c.keywords].includes(tag)).length}</em></button>)}</div></details>
      {kind==="paper"&&<details className="tag-search author-search"><summary>Authors ▾</summary><div>{allAuthors.map(author=><button key={author} onClick={e=>{setQuery(author);(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}}>{author}<em>{cards.filter(c=>authorParts(c.authors).includes(author)).length}</em></button>)}</div></details>}
      <label className="sort">Sort by <select value={sort} onChange={e=>setSort(e.target.value)}>{kind==="paper"&&<option value="topic">Topic</option>}<option value="year">Year</option><option value="author">Author</option><option value="title">Title</option></select></label>
      <span className={`save-state ${saved ? "" : "saving"}`}>{saved ? "● Saved locally" : "○ Saving…"}</span>
    </section>

    {kind==="paper"&&<nav className="dividers" aria-label="Reading status">
      {["All cards",...statuses].map(s=><button key={s} className={filter===s?"active":""} onClick={()=>setFilter(s)} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=Number(e.dataTransfer.getData("text/plain")); if(s!=="All cards")change(cs=>cs.map(c=>c.id===id?{...c,status:s}:c)); setFilter(s)}}><span>{s}</span><em>{s==="All cards"?kindCards.length:kindCards.filter(c=>c.status===s).length}</em></button>)}
      <button className="edit-statuses" onClick={()=>{setStatusDraft(statuses);setEditingStatuses(true)}}>＋ Edit</button>
    </nav>}

    <section className="deck-area">
      <div className="deck-heading"><span>{visible.length} {visible.length===1?"card":"cards"} in this stack</span><span>Use ← → or scroll to flip</span></div>
      {currentItem ? <div className="deck-wrap" onWheel={e=>{if(Math.abs(e.deltaY)>10)setPosition(p=>e.deltaY>0?Math.min(deckItems.length-1,p+1):Math.max(0,p-1))}}>
        <button className="flip prev" aria-label="Previous card" disabled={position===0} onClick={()=>setPosition(p=>Math.max(0,p-1))}>←</button>
        <div className="deck-shadow shadow-three"/><div className="deck-shadow shadow-two"/><div className="deck-shadow shadow-one"/>
        {currentItem.type==="topic"?<article className="note-card deck-card topic-divider" onClick={()=>currentItem.topic.id&&setOpen(currentItem.topic)}><div className="topic-kicker">TOPIC</div><h2>{currentItem.topic.title}</h2><div className="rule"/><p className="topic-intro">{plain(currentItem.topic.findings)||"No introduction yet. Open this topic card to add one."}</p><div className="tags">{(currentItem.topic.subtopics||[]).map(t=><button key={t}>{t}</button>)}</div><footer><span>{(currentItem.topic.subtopics||[]).length} subtopics</span><b>Open topic ↗</b></footer></article>:<article className="note-card deck-card" key={currentItem.card.id} draggable onDragStart={e=>e.dataTransfer.setData("text/plain",String(currentItem.card.id))} onClick={()=>setOpen(currentItem.card)}>
          <div className="card-number">{String(position+1).padStart(2,"0")} / {String(deckItems.length).padStart(2,"0")}</div>{kind==="paper"?<span className={`status-dot ${currentItem.card.status.toLowerCase().replace(" ","-")}`}>{currentItem.card.status}</span>:<span className="status-dot">{kind}</span>}
          {(()=>{const current=currentItem.card;return <>
          <h2>{current.title}</h2><p className="citation">{current.authors}{current.year&&` · ${current.year}`}</p><p className="journal">{current.journal}</p><div className="rule"/>
          <p className="finding">{plain(current.findings)}</p><div className="tags">{[...current.topics,...(current.subtopics||[]),...current.keywords].slice(0,4).map(t=><button key={t} onClick={e=>{e.stopPropagation();setQuery(t)}}>{t}</button>)}</div>
          {!!current.images?.length&&<div className="card-thumbs">{current.images.slice(0,3).map((image,i)=><img key={image.id} src={image.data} alt={image.name} style={{transform:`rotate(${i%2?2:-2}deg)`}}/>)}{current.images.length>3&&<em>+{current.images.length-3}</em>}</div>}
          <footer><span>{current.projects[0] || (kind==="paper"?"Unfiled":kind==="author"?"Author card":kind==="topic"?"Topic card":"Journal card")}</span><b>Click to read & edit ↗</b></footer></>})()}
        </article>}
        <button className="flip next" aria-label="Next card" disabled={position>=deckItems.length-1} onClick={()=>setPosition(p=>Math.min(deckItems.length-1,p+1))}>→</button>
      </div> : <div className="empty"><b>No cards found</b><span>Try another phrase or divider.</span></div>}
      <div className="deck-dots">{deckItems.slice(Math.max(0,position-3),position+4).map((item,i)=><button key={`${item.type}-${item.type==="card"?item.card.id:item.topic.title}`} className={deckItems.indexOf(item)===position?"active":""} onClick={()=>setPosition(deckItems.indexOf(item))} aria-label="Open page"/>)}</div>
    </section>

    {open && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(null)}}><section className="card-modal" role="dialog" aria-modal="true">
      <div className="modal-top"><span className="catalog-label">{(open.kind||"paper").toUpperCase()} CARD · {open.year || "UNDATED"}</span><button aria-label="Close card" onClick={()=>setOpen(null)}>×</button></div>
      {(open.kind||"paper")==="paper"&&<CitationImporter onIdentify={fields=>update({...open,...Object.fromEntries(Object.entries(fields).filter(([,value])=>value))})}/>}
      <input className="title-input" value={open.title} onChange={e=>update({...open,title:e.target.value})}/>
      {open.kind!=="topic"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Authors":(open.kind==="author"?"Affiliation":"Publisher")}<input value={open.authors} placeholder={(open.kind||"paper")==="paper"?"Lastname, Firstname; or Firstname Lastname":""} onChange={e=>update({...open,authors:e.target.value})}/>{(open.kind||"paper")==="paper"&&<small className="field-help">Either name order works. Separate multiple authors with semicolons.</small>}</label><label className="year-field">{open.kind==="author"?"Years":"Year"}<input value={open.year} onChange={e=>update({...open,year:e.target.value})}/></label></div>}
      {open.kind!=="topic"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Journal":open.kind==="author"?"Department / field":"Frequency / location"}<input value={open.journal} onChange={e=>update({...open,journal:e.target.value})}/></label>{(open.kind||"paper")==="paper"&&<label>DOI<input value={open.doi} onChange={e=>update({...open,doi:e.target.value})}/></label>}</div>}
      {open.kind==="topic"?<TagField label="Subtopics" values={open.subtopics||[]} suggestions={allSubtopics} onChange={subtopics=>update({...open,subtopics})}/>:<div className="field-row">{(open.kind||"paper")==="paper"?<label>Topic<select value={open.topics[0]||""} onChange={e=>update({...open,topics:e.target.value?[e.target.value]:[]})}><option value="">Unfiled</option>{topicCards.map(t=><option key={t.id} value={t.title}>{t.title}</option>)}</select></label>:<TagField label="Topics" values={open.topics} suggestions={topicCards.map(t=>t.title)} onChange={topics=>update({...open,topics})}/>}<TagField label={(open.kind||"paper")==="paper"?"Subtopics":"Keywords"} values={(open.kind||"paper")==="paper"?(open.subtopics||[]):open.keywords} suggestions={(open.kind||"paper")==="paper"?(topicCards.find(t=>t.title===open.topics[0])?.subtopics||allSubtopics):allKeywords} onChange={values=>(open.kind||"paper")==="paper"?update({...open,subtopics:values}):update({...open,keywords:values})}/></div>}
      {(open.kind||"paper")==="paper"&&<TagField label="Keywords" values={open.keywords} suggestions={allKeywords} onChange={keywords=>update({...open,keywords})}/>} 
      {(open.kind||"paper")==="paper"&&<div className="field-row"><ProjectField values={open.projects} onChange={projects=>update({...open,projects})}/><label>Status<select value={open.status} onChange={e=>update({...open,status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label></div>}
      <RichField label={(open.kind||"paper")==="paper"?"Key findings":open.kind==="author"?"Profile":open.kind==="topic"?"Topic introduction":"Journal overview"} value={open.findings} onChange={v=>update({...open,findings:v})}/>
      {open.kind!=="topic"&&<div className="field-row"><label>{(open.kind||"paper")==="paper"?"Methods":open.kind==="author"?"Approach / traditions":"Scope"}<textarea value={open.methods} onChange={e=>update({...open,methods:e.target.value})}/></label><label>{(open.kind||"paper")==="paper"?"Limitations":open.kind==="author"?"Cautions / critiques":"Submission notes"}<textarea value={open.limitations} onChange={e=>update({...open,limitations:e.target.value})}/></label></div>}
      <RichField label="My notes" value={open.notes} onChange={v=>update({...open,notes:v})}/>
      <div className="attachments"><div className="attachment-head"><span>Images · paste anywhere with Ctrl/⌘ + V</span><label className="attach-button">＋ Attach images<input type="file" accept="image/*" multiple onChange={e=>e.target.files&&attachImages(e.target.files)}/></label></div>
        {open.images?.length ? <div className="image-grid">{open.images.map(image=><figure key={image.id}><img src={image.data} alt={image.name}/><figcaption title={image.name}>{image.name}</figcaption><button aria-label={`Remove ${image.name}`} onClick={()=>update({...open,images:open.images?.filter(i=>i.id!==image.id)})}>×</button></figure>)}</div> : <p className="attachment-empty">Add figures, diagrams, screenshots, or handwritten notes.</p>}
      </div>
      {open.kind!=="topic"&&<label>PDF or EndNote link<input value={open.link} placeholder="https://…" onChange={e=>update({...open,link:e.target.value})}/></label>}
      <div className="modal-foot"><button className="delete" onClick={()=>{if(confirm("Remove this card?")){setCards(cs=>cs.filter(c=>c.id!==open.id));setOpen(null)}}}>Remove card</button><span>Changes save automatically</span><button className="done" onClick={()=>setOpen(null)}>Done</button></div>
    </section></div>}
    {editingStatuses&&<div className="modal-backdrop"><section className="status-editor" role="dialog" aria-modal="true"><div className="modal-top"><div><span className="catalog-label">READING WORKFLOW</span><h2>Edit statuses</h2></div><button aria-label="Close" onClick={()=>setEditingStatuses(false)}>×</button></div><p>Choose up to five stages. Their order becomes the divider order.</p><div className="status-fields">{statusDraft.map((status,i)=><div key={i}><span>{i+1}</span><input value={status} autoFocus={i===0} onChange={e=>setStatusDraft(ds=>ds.map((d,n)=>n===i?e.target.value:d))}/><button aria-label={`Remove ${status}`} onClick={()=>setStatusDraft(ds=>ds.filter((_,n)=>n!==i))}>×</button></div>)}</div>{statusDraft.length<5&&<button className="add-status" onClick={()=>setStatusDraft(ds=>[...ds,`Stage ${ds.length+1}`])}>＋ Add status</button>}<div className="modal-foot"><button onClick={()=>setEditingStatuses(false)}>Cancel</button><span>Maximum five</span><button className="done" onClick={()=>{const next=Array.from(new Set(statusDraft.map(s=>s.trim()).filter(Boolean))).slice(0,5);setCards(cs=>cs.map(c=>{const index=statuses.indexOf(c.status);return index>=0&&next[index]?{...c,status:next[index]}:c}));setStatuses(next.length?next:defaultStatuses);setFilter("All cards");setEditingStatuses(false)}}>Save statuses</button></div></section></div>}
  </main>;
}
