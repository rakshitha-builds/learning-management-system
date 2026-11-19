"use client";
import { useEffect, useRef, useState } from "react";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { ySyncPluginKey } from "y-prosemirror";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code, Code2, Heading1, Heading2, Heading3, Highlighter, ImageIcon, Italic,
  Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2, Upload,
} from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { uploadImage, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Session } from "./session";

const COLORS = ["#0f172a", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];

function TB({ onClick, active, disabled, label, children }: { onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled} title={label} aria-label={label} aria-pressed={active}
      className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40", active && "bg-brand-50 text-brand-700")}>
      {children}
    </button>
  );
}
const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-stone-200" />;

function Toolbar({ editor, onLink, onImage }: { editor: Editor; onLink: () => void; onImage: () => void }) {
  const c = () => editor.chain().focus();
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto px-3 py-1.5" role="toolbar" aria-label="Formatting">
      <TB label="Undo" onClick={() => c().undo().run()}><Undo2 className="h-4 w-4" /></TB>
      <TB label="Redo" onClick={() => c().redo().run()}><Redo2 className="h-4 w-4" /></TB>
      <Sep />
      <TB label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></TB>
      <TB label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></TB>
      <TB label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></TB>
      <Sep />
      <TB label="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></TB>
      <TB label="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></TB>
      <TB label="Underline (Ctrl+U)" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></TB>
      <TB label="Strikethrough" active={editor.isActive("strike")} onClick={() => c().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></TB>
      <TB label="Highlight" active={editor.isActive("highlight")} onClick={() => c().toggleHighlight().run()}><Highlighter className="h-4 w-4" /></TB>
      <TB label="Inline code" active={editor.isActive("code")} onClick={() => c().toggleCode().run()}><Code className="h-4 w-4" /></TB>
      <span className="ml-1 flex items-center gap-1">
        {COLORS.map((col) => (
          <button key={col} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (col === "#0f172a" ? c().unsetColor().run() : c().setColor(col).run())}
            title={`Text colour ${col}`} aria-label={`Text colour ${col}`} className={cn("h-4 w-4 shrink-0 rounded-full border border-white ring-1 ring-stone-300 transition hover:scale-125", editor.isActive("textStyle", { color: col }) && "ring-2 ring-ink-900")} style={{ background: col }} />
        ))}
      </span>
      <Sep />
      <TB label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></TB>
      <TB label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></TB>
      <TB label="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}><Quote className="h-4 w-4" /></TB>
      <TB label="Code block" active={editor.isActive("codeBlock")} onClick={() => c().toggleCodeBlock().run()}><Code2 className="h-4 w-4" /></TB>
      <TB label="Divider" onClick={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></TB>
      <Sep />
      <TB label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => c().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></TB>
      <TB label="Align centre" active={editor.isActive({ textAlign: "center" })} onClick={() => c().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></TB>
      <TB label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => c().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></TB>
      <Sep />
      <TB label="Link" active={editor.isActive("link")} onClick={onLink}><Link2 className="h-4 w-4" /></TB>
      <TB label="Image" onClick={onImage}><ImageIcon className="h-4 w-4" /></TB>
    </div>
  );
}

export interface RichEditorProps {
  session: Session;
  user: { id: string; name: string; color: string };
  editable: boolean;
  onEditor: (e: Editor | null) => void;
}

export default function RichEditor({ session, user, editable, onEditor }: RichEditorProps) {
  const toast = useToast();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imgOpen, setImgOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({ history: false, heading: { levels: [1, 2, 3] } }),
        Underline,
        Link.configure({ openOnClick: "whenNotEditable", autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
        Image,
        Highlight,
        TextStyle,
        Color,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({ placeholder: "Start writing, or press / for ideas… everything is saved automatically." }),
        Collaboration.configure({ document: session.ydoc }),
        CollaborationCursor.configure({ provider: session.provider, user: { id: user.id, name: user.name, color: user.color } }),
      ],
      editorProps: { attributes: { "aria-label": "Document editor", spellcheck: "true" } },
      onUpdate: ({ transaction }) => {
        // only local edits mark "typing" (remote changes arrive flagged as change origin)
        if (transaction.getMeta(ySyncPluginKey)?.isChangeOrigin) return;
        session.provider.awareness.setLocalStateField("typingAt", Date.now());
      },
    },
    [session]
  );

  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);
  useEffect(() => { onEditor(editor); return () => onEditor(null); }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  function openLink() {
    if (!editor) return;
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }
  function applyLink(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else {
      const href = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  }
  async function onFile(file?: File) {
    if (!file || !editor) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      setImgOpen(false);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Upload failed"); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  function applyImageUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!editor || !/^https?:\/\//i.test(imgUrl.trim())) { toast.error("Enter a valid image URL starting with http(s)://"); return; }
    editor.chain().focus().setImage({ src: imgUrl.trim() }).run();
    setImgUrl(""); setImgOpen(false);
  }

  if (!editor) return <div className="p-10 text-center text-sm text-ink-500">Loading editor…</div>;
  return (
    <>
      {editable && (
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <Toolbar editor={editor} onLink={openLink} onImage={() => setImgOpen(true)} />
        </div>
      )}
      <div className="editor-content mx-auto w-full max-w-3xl px-5 pb-10 pt-6 sm:px-10">
        <EditorContent editor={editor} />
      </div>

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Insert link">
        <form onSubmit={applyLink} className="space-y-4">
          <Input label="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" autoFocus />
          <p className="text-xs text-ink-500">Select some text first, then add a link. Leave empty to remove the link.</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>Cancel</Button><Button type="submit">Apply</Button></div>
        </form>
      </Modal>

      <Modal open={imgOpen} onClose={() => setImgOpen(false)} title="Insert image">
        <div className="space-y-5">
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="secondary" className="w-full" loading={uploading} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Upload from your computer</Button>
            <p className="mt-1.5 text-xs text-ink-500">PNG, JPEG, GIF or WebP up to 5 MB.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-500"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
          <form onSubmit={applyImageUrl} className="space-y-3">
            <Input label="Image URL" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://…/photo.jpg" />
            <div className="flex justify-end"><Button type="submit">Insert</Button></div>
          </form>
        </div>
      </Modal>
    </>
  );
}
