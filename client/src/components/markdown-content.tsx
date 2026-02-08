import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
  content: string;
  className?: string;
  compact?: boolean;
}

export function MarkdownContent({ content, className = "", compact = false }: MarkdownContentProps) {
  const stripped = (content || "").replace(/---+/g, "");

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 ${compact ? "prose-p:text-xs prose-headings:text-sm" : ""} ${className}`}>
      <ReactMarkdown>{stripped}</ReactMarkdown>
    </div>
  );
}

export function InlineMarkdown({ content, className = "" }: { content: string; className?: string }) {
  const cleaned = (content || "")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/---+/g, "")
    .trim();

  return <span className={className}>{cleaned}</span>;
}
