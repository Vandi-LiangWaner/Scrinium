"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Card = {
  kind?: "paper"|"author"|"journal";
  id: number; title: string; authors: string; year: string; journal: string; doi: string;
  topics: string[]; keywords: string[]; projects: string[]; status: string;
  findings: string; methods: string; limitations: string; notes: string; link: string;
  images?: {id:number; name:string; data:string}[];
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

const statuses = ["All cards", "To read", "Reading", "Read", "Annotated"];
const blank = (kind:"paper"|"author"|"journal"): Card => ({ id: Date.now(), kind, title: kind==="paper"?"Untitled paper":kind==="author"?"Unnamed author":"Untitled journal", authors: "", year: "", journal: "", doi: "", topics: [], keywords: [], projects: [], status: kind==="paper"?"To read":"", findings: "", methods: "", limitations: "", notes: "", link: "" });
const split = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
const plain = (s:string) => s.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ");
function RichField({label,value,onChange}:{label:string,value:string,onChange:(v:string)=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const editor=ref.current;if(editor&&document.activeElement!==editor&&editor.innerHTML!==value)editor.innerHTML=value},[value]);
  return <div className="rich-label"><span className="rich-title">{label}</span><span className="rich-tools">
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("bold")}}><b>B</b></button>
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("italic")}}><i>I</i></button>
    <button type="button" onMouseDown={e=>{e.preventDefault();document.execCommand("insertUnorderedList")}}>• List</button>
  </span><div ref={ref} className="rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label={label} aria-multiline="true" onInput={e=>onChange(e.currentTarget.innerHTML)}/></div>
}

export default function Home() {
  const [cards, setCards] = useState<Card[]>(seed);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All cards");
  const [open, setOpen] = useState<Card | null>(null);
  const [sort, setSort] = useState("year");
  const [saved, setSaved] = useState(true);
  const [position, setPosition] = useState(0);
  const [kind, setKind] = useState<"paper"|"author"|"journal">("paper");
  const history=useRef<Card[][]>([]);
  const searchRef=useRef<HTMLInputElement>(null);

  useEffect(() => { (async()=>{let stored:Card[]|null=null; if(window.literatureBox)stored=await window.literatureBox.loadCards() as Card[]|null; if(!stored){const v=localStorage.getItem("literature-box-cards");if(v)try{stored=JSON.parse(v)}catch{}} if(stored){const migrated=stored.map(c=>({...c,kind:c.kind||"paper" as const}));if(!migrated.some(c=>c.kind==="author"))migrated.push(seed.find(c=>c.kind==="author")!);if(!migrated.some(c=>c.kind==="journal"))migrated.push(seed.find(c=>c.kind==="journal")!);setCards(migrated)}setReady(true)})() }, []);
  useEffect(() => { if (!ready) return; setSaved(false); const t = setTimeout(async() => { if(window.literatureBox)await window.literatureBox.saveCards(cards);else localStorage.setItem("literature-box-cards", JSON.stringify(cards)); setSaved(true); }, 350); return () => clearTimeout(t); }, [cards, ready]);

  const visible = useMemo(() => cards.filter(c => {
    const hay = JSON.stringify(c).toLowerCase();
    return (c.kind||"paper")===kind && (kind!=="paper" || filter === "All cards" || c.status === filter) && hay.includes(query.toLowerCase());
  }).sort((a,b) => sort === "author" ? a.authors.localeCompare(b.authors) : sort === "title" ? a.title.localeCompare(b.title) : b.year.localeCompare(a.year)), [cards, query, filter, sort, kind]);
  useEffect(() => setPosition(0), [query, filter, sort, kind]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();searchRef.current?.focus()}else if(!open&&e.key==="ArrowRight")setPosition(p=>Math.min(visible.length-1,p+1));else if(!open&&e.key==="ArrowLeft")setPosition(p=>Math.max(0,p-1));else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[open,visible.length]);
  const current = visible[Math.min(position, Math.max(visible.length - 1, 0))];
  const kindCards=useMemo(()=>cards.filter(c=>(c.kind||"paper")===kind),[cards,kind]);
  const allTags=useMemo(()=>Array.from(new Set(kindCards.flatMap(c=>[...c.topics,...c.keywords]))).sort(),[kindCards]);
  const allAuthors=useMemo(()=>Array.from(new Set(cards.filter(c=>(c.kind||"paper")==="paper").map(c=>c.authors).filter(Boolean))).sort(),[cards]);

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
  function download(kind: "json"|"csv"|"md") {
    let body = "", type = "text/plain";
    if (kind === "json") { body = JSON.stringify(cards, null, 2); type = "application/json"; }
    if (kind === "csv") { const keys = Object.keys(cards[0]) as (keyof Card)[]; body = [keys.join(","), ...cards.map(c => keys.map(k => `"${String(Array.isArray(c[k]) ? (c[k] as string[]).join("; ") : c[k]).replaceAll('"','""')}"`).join(","))].join("\n"); type="text/csv"; }
    if (kind === "md") body = cards.map(c => `# ${c.title}\n\n**${c.authors} (${c.year})** — ${c.journal}\n\n## Key findings\n${c.findings}\n\n## Methods\n${c.methods}\n\n## Limitations\n${c.limitations}\n\n## My notes\n${c.notes}\n`).join("\n---\n\n");
    if(window.literatureBox){window.literatureBox.exportFile(kind,body);return} const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([body],{type})); a.download=`literature-box.${kind}`; a.click(); URL.revokeObjectURL(a.href);
  }

  function importJson(file: File) { const r = new FileReader(); r.onload=() => { try { const data=JSON.parse(String(r.result)); if (Array.isArray(data)) setCards(data); } catch { alert("That file is not valid JSON."); } }; r.readAsText(file); }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">L</span><div><h1>The Literature Box</h1><p>{cards.length} cards · stored on this device</p></div></div>
      <div className="top-actions">
        <label className="import-btn">↥ Import<input type="file" accept=".json" onChange={e => e.target.files?.[0] && importJson(e.target.files[0])}/></label>
        <details className="export-menu"><summary>↓ Export</summary><div><button onClick={()=>download("md")}>Markdown</button><button onClick={()=>download("csv")}>CSV</button><button onClick={()=>download("json")}>JSON backup</button></div></details>
        <button onClick={undo} disabled={!history.current.length}>↶ Undo</button><button className="add-btn" onClick={addCard}>＋ New {kind}</button>
      </div>
    </header>

    <nav className="collections" aria-label="Card boxes">{(["paper","author","journal"] as const).map(k=><button key={k} className={kind===k?"active":""} onClick={()=>{setKind(k);setQuery("");setFilter("All cards")}}><span>{k==="paper"?"Papers":k==="author"?"Authors":"Journals"}</span><em>{cards.filter(c=>(c.kind||"paper")===k).length}</em></button>)}</nav>

    <section className="controls">
      <label className="search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search notes, authors, or tags…"/><kbd>⌘ K</kbd></label>
      <details className="tag-search"><summary>Tags ▾</summary><div>{allTags.map(tag=><button key={tag} onClick={e=>{setQuery(tag);(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}}>{tag}<em>{cards.filter(c=>[...c.topics,...c.keywords].includes(tag)).length}</em></button>)}</div></details>
      {kind==="paper"&&<details className="tag-search author-search"><summary>Authors ▾</summary><div>{allAuthors.map(author=><button key={author} onClick={e=>{setQuery(author);(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}}>{author}<em>{cards.filter(c=>c.authors===author).length}</em></button>)}</div></details>}
      <label className="sort">Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="year">Year</option><option value="author">Author</option><option value="title">Title</option></select></label>
      <span className={`save-state ${saved ? "" : "saving"}`}>{saved ? "● Saved locally" : "○ Saving…"}</span>
    </section>

    {kind==="paper"&&<nav className="dividers" aria-label="Reading status">
      {statuses.map((s,i)=><button key={s} className={filter===s?"active":""} onClick={()=>setFilter(s)} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=Number(e.dataTransfer.getData("text/plain")); if(s!=="All cards")change(cs=>cs.map(c=>c.id===id?{...c,status:s}:c)); setFilter(s)}}><span>{s}</span><em>{s==="All cards"?kindCards.length:kindCards.filter(c=>c.status===s).length}</em></button>)}
    </nav>}

    <section className="deck-area">
      <div className="deck-heading"><span>{visible.length} {visible.length===1?"card":"cards"} in this stack</span><span>Use ← → to flip</span></div>
      {current ? <div className="deck-wrap">
        <button className="flip prev" aria-label="Previous card" disabled={position===0} onClick={()=>setPosition(p=>Math.max(0,p-1))}>←</button>
        <div className="deck-shadow shadow-three"/><div className="deck-shadow shadow-two"/><div className="deck-shadow shadow-one"/>
        <article className="note-card deck-card" key={current.id} draggable onDragStart={e=>e.dataTransfer.setData("text/plain",String(current.id))} onClick={()=>setOpen(current)}>
          <div className="card-number">{String(position+1).padStart(2,"0")} / {String(visible.length).padStart(2,"0")}</div>{kind==="paper"?<span className={`status-dot ${current.status.toLowerCase().replace(" ","-")}`}>{current.status}</span>:<span className="status-dot">{kind}</span>}
          <h2>{current.title}</h2><p className="citation">{current.authors}{current.year&&` · ${current.year}`}</p><p className="journal">{current.journal}</p><div className="rule"/>
          <p className="finding">{plain(current.findings)}</p><div className="tags">{[...current.topics,...current.keywords].slice(0,4).map(t=><button key={t} onClick={e=>{e.stopPropagation();setQuery(t)}}>{t}</button>)}</div>
          {current.images?.[0] && <img className="card-thumb" src={current.images[0].data} alt=""/>}
          <footer><span>{current.projects[0] || (kind==="paper"?"Unfiled":kind==="author"?"Author card":"Journal card")}</span><b>Click to read & edit ↗</b></footer>
        </article>
        <button className="flip next" aria-label="Next card" disabled={position>=visible.length-1} onClick={()=>setPosition(p=>Math.min(visible.length-1,p+1))}>→</button>
      </div> : <div className="empty"><b>No cards found</b><span>Try another phrase or divider.</span></div>}
      <div className="deck-dots">{visible.slice(Math.max(0,position-3),position+4).map(c=><button key={c.id} className={c.id===current?.id?"active":""} onClick={()=>setPosition(visible.indexOf(c))} aria-label={`Open ${c.title}`}/>)}</div>
    </section>

    {open && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(null)}}><section className="card-modal" role="dialog" aria-modal="true">
      <div className="modal-top"><span className="catalog-label">{(open.kind||"paper").toUpperCase()} CARD · {open.year || "UNDATED"}</span><button aria-label="Close card" onClick={()=>setOpen(null)}>×</button></div>
      <input className="title-input" value={open.title} onChange={e=>update({...open,title:e.target.value})}/>
      <div className="field-row"><label>{(open.kind||"paper")==="paper"?"Authors":(open.kind==="author"?"Affiliation":"Publisher")}<input value={open.authors} onChange={e=>update({...open,authors:e.target.value})}/></label><label className="year-field">{open.kind==="author"?"Years":"Year"}<input value={open.year} onChange={e=>update({...open,year:e.target.value})}/></label></div>
      <div className="field-row"><label>{(open.kind||"paper")==="paper"?"Journal":open.kind==="author"?"Department / field":"Frequency / location"}<input value={open.journal} onChange={e=>update({...open,journal:e.target.value})}/></label>{(open.kind||"paper")==="paper"&&<label>DOI<input value={open.doi} onChange={e=>update({...open,doi:e.target.value})}/></label>}</div>
      <div className="field-row"><label>Topics<input value={open.topics.join(", ")} onChange={e=>update({...open,topics:split(e.target.value)})}/></label><label>Keywords<input value={open.keywords.join(", ")} onChange={e=>update({...open,keywords:split(e.target.value)})}/></label></div>
      {(open.kind||"paper")==="paper"&&<div className="field-row"><label>Project<input value={open.projects.join(", ")} onChange={e=>update({...open,projects:split(e.target.value)})}/></label><label>Status<select value={open.status} onChange={e=>update({...open,status:e.target.value})}>{statuses.slice(1).map(s=><option key={s}>{s}</option>)}</select></label></div>}
      <RichField label={(open.kind||"paper")==="paper"?"Key findings":open.kind==="author"?"Profile":"Journal overview"} value={open.findings} onChange={v=>update({...open,findings:v})}/>
      <div className="field-row"><label>{(open.kind||"paper")==="paper"?"Methods":open.kind==="author"?"Approach / traditions":"Scope"}<textarea value={open.methods} onChange={e=>update({...open,methods:e.target.value})}/></label><label>{(open.kind||"paper")==="paper"?"Limitations":open.kind==="author"?"Cautions / critiques":"Submission notes"}<textarea value={open.limitations} onChange={e=>update({...open,limitations:e.target.value})}/></label></div>
      <RichField label="My notes" value={open.notes} onChange={v=>update({...open,notes:v})}/>
      <div className="attachments"><div className="attachment-head"><span>Images</span><label className="attach-button">＋ Attach images<input type="file" accept="image/*" multiple onChange={e=>e.target.files&&attachImages(e.target.files)}/></label></div>
        {open.images?.length ? <div className="image-grid">{open.images.map(image=><figure key={image.id}><img src={image.data} alt={image.name}/><figcaption title={image.name}>{image.name}</figcaption><button aria-label={`Remove ${image.name}`} onClick={()=>update({...open,images:open.images?.filter(i=>i.id!==image.id)})}>×</button></figure>)}</div> : <p className="attachment-empty">Add figures, diagrams, screenshots, or handwritten notes.</p>}
      </div>
      <label>PDF or EndNote link<input value={open.link} placeholder="https://…" onChange={e=>update({...open,link:e.target.value})}/></label>
      <div className="modal-foot"><button className="delete" onClick={()=>{if(confirm("Remove this card?")){setCards(cs=>cs.filter(c=>c.id!==open.id));setOpen(null)}}}>Remove card</button><span>Changes save automatically</span><button className="done" onClick={()=>setOpen(null)}>Done</button></div>
    </section></div>}
  </main>;
}
