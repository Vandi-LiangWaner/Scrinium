import { Mark, Extension } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { cardHref, linkedCardId, safeLink, safeRichHtml, type LinkableCard } from "./rich-text";

const DoubleUnderline = Mark.create({
  name: "doubleUnderline",
  parseHTML: () => [
    { tag: "span.double-underline" },
    { style: "text-decoration", getAttrs: value => /underline/i.test(value) && /double/i.test(value) ? {} : false },
  ],
  renderHTML: () => ["span", { class: "double-underline" }, 0],
});

const Indent = Extension.create({
  name: "literatureIndent",
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.isActive("listItem")
        ? this.editor.commands.sinkListItem("listItem")
        : this.editor.commands.insertContent("\u00a0\u00a0\u00a0\u00a0"),
      "Shift-Tab": () => this.editor.commands.liftListItem("listItem"),
    };
  },
});

const extensions = [
  StarterKit.configure({
    link: { openOnClick: false, autolink: false, isAllowedUri: safeLink },
  }),
  DoubleUnderline,
  Indent,
];

const tools = [
  { name: "Bold", mark: "bold", icon: <b>B</b>, run: (e: Editor) => e.chain().focus().toggleBold().run() },
  { name: "Italic", mark: "italic", icon: <i>I</i>, run: (e: Editor) => e.chain().focus().toggleItalic().run() },
  { name: "Underline", mark: "underline", icon: <u>U</u>, run: (e: Editor) => e.chain().focus().toggleUnderline().run() },
  { name: "Double underline", mark: "doubleUnderline", icon: <span className="double-underline">U</span>, run: (e: Editor) => e.chain().focus().toggleMark("doubleUnderline").run() },
  { name: "Strikethrough", mark: "strike", icon: <s>S</s>, run: (e: Editor) => e.chain().focus().toggleStrike().run() },
  { name: "Heading", mark: "heading", icon: "Heading", run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { name: "Bulleted list", mark: "bulletList", icon: "• List", run: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { name: "Numbered list", mark: "orderedList", icon: "1. List", run: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { name: "Block quote", mark: "blockquote", icon: "Quote", run: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
];

export function CardLinkPicker({ cards, onPick, excluded = [] }: {
  cards: LinkableCard[];
  onPick: (card: LinkableCard) => void;
  excluded?: number[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const matches = cards.filter(card => !excluded.includes(card.id) &&
    `${card.title} ${card.kind} ${card.detail}`.toLocaleLowerCase().includes(needle));
  return <div className="card-link-picker">
    <input type="search" aria-label="Find a paper, author, or journal" placeholder="Find a paper, author, or journal…" value={query} onChange={e => setQuery(e.target.value)}/>
    <ul>{matches.slice(0, 12).map(card => <li key={card.id}>
      <button type="button" onClick={() => onPick(card)}><small>{card.kind}</small><span>{card.title}</span>{card.detail && <em>{card.detail}</em>}</button>
    </li>)}</ul>
    {!matches.length && <small>No matching cards.</small>}
    {matches.length > 12 && <small>Type to narrow the results.</small>}
  </div>;
}

type LinkDraft = { text: string; href: string; from: number; to: number; existing: boolean };

function FormatToolbar({ editor, label, cards, onOpenLink }: {
  editor: Editor;
  label: string;
  cards?: LinkableCard[];
  onOpenLink: (href: string) => void;
}) {
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      marks: tools.map(tool => editor.isActive(tool.mark)),
      link: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });
  function startLink() {
    const existing = editor.isActive("link");
    if (existing && editor.state.selection.empty) editor.commands.extendMarkRange("link");
    const { from, to } = editor.state.selection;
    setDraft({ text: editor.state.doc.textBetween(from, to, " "), from, to, existing, href: editor.getAttributes("link").href || "" });
  }
  function applyLink(href: string, fallback = href) {
    if (!draft || !safeLink(href)) return;
    const { from, to, text } = draft;
    const chain = editor.chain().focus().setTextSelection({ from, to });
    if (from === to || text !== editor.state.doc.textBetween(from, to, " ")) {
      chain.insertContent({ type: "text", text: text.trim() || fallback, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    setDraft(null);
  }
  return <>
    <div className="rich-tools" role="group" aria-label={`${label} formatting`}>
      {tools.map(({ name, icon, run }, i) => <button key={name} type="button" title={name} aria-label={name} aria-pressed={active?.marks[i] || false} onMouseDown={e => e.preventDefault()} onClick={() => run(editor)}>{icon}</button>)}
      <button type="button" aria-expanded={!!draft} aria-pressed={active?.link || false} onMouseDown={e => e.preventDefault()} onClick={() => draft ? setDraft(null) : startLink()}>Link</button>
      <button type="button" aria-label="Undo typing" title="Undo typing" disabled={!active?.canUndo} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().undo().run()}>↶</button>
      <button type="button" aria-label="Redo typing" title="Redo typing" disabled={!active?.canRedo} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().redo().run()}>↷</button>
    </div>
    {draft && <div className="inline-link-form" onKeyDown={e => {
      if (e.key === "Escape") { setDraft(null); editor.commands.focus(); }
    }}>
      <label>Text to display<input value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })}/></label>
      <label>Link address<input autoFocus placeholder="https://…" value={draft.href} onChange={e => setDraft({ ...draft, href: e.target.value })} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyLink(draft.href.trim()); } }}/></label>
      <div className="inline-link-actions">
        <button type="button" disabled={!safeLink(draft.href.trim())} onClick={() => applyLink(draft.href.trim())}>Apply link</button>
        {draft.existing && <button type="button" onClick={() => { editor.chain().focus().setTextSelection({ from: draft.from, to: draft.to }).unsetLink().run(); setDraft(null); }}>Remove link</button>}
        {draft.existing && safeLink(draft.href) && <button type="button" onClick={() => onOpenLink(draft.href)}>Open link</button>}
        <button type="button" onClick={() => { setDraft(null); editor.commands.focus(); }}>Cancel</button>
      </div>
      {cards && <CardLinkPicker cards={cards} onPick={card => applyLink(cardHref(card.id), card.title)}/>}
    </div>}
  </>;
}

export const RichField = memo(function RichField({ label, value, onDraft, cards, onOpenCard, large }: {
  label: string;
  value: string;
  onDraft: (read: () => string) => void;
  cards?: LinkableCard[];
  onOpenCard: (id: number) => void;
  large?: boolean;
}) {
  const id = useId();
  const lastValue = useRef(value);
  const content = useMemo(() => safeRichHtml(value), [value]);
  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "rich-editor", role: "textbox", "aria-labelledby": id, "aria-multiline": "true" },
      handlePaste: (_view, event) => {
        if (Array.from(event.clipboardData?.files || []).some(file => file.type.startsWith("image/"))) {
          event.preventDefault();
          return true; // The card-level paste handler adds the attachment.
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onDraft(() => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      lastValue.current = html;
      return html;
    }),
  });
  useEffect(() => {
    if (!editor || value === lastValue.current) return;
    editor.commands.setContent(content, { emitUpdate: false });
    lastValue.current = value;
  }, [editor, value, content]);
  const openLink = (href: string) => {
    const cardId = linkedCardId(href);
    if (cardId !== null) onOpenCard(cardId);
    else if (safeLink(href)) window.open(href, "_blank", "noopener,noreferrer");
  };
  return <div className={large ? "rich-label note-writing" : "rich-label"} onClick={event => {
    const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    openLink(href);
  }}>
    <span id={id} className="rich-title">{label}</span>
    {editor && <FormatToolbar editor={editor} label={label} cards={cards} onOpenLink={openLink}/>}
    <EditorContent editor={editor}/>
  </div>;
});
