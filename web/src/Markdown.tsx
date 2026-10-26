import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        skipHtml={false}
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ alt }) => (
            <span>
              [Linked image{alt ? `: ${alt}` : ""} — open the original message
              in Discord]
            </span>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
