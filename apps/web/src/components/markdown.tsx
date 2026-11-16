import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

/** Statement preview: Markdown with LaTeX, as the exports will show it. Raw HTML is not rendered. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-statement text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{children}</ReactMarkdown>
    </div>
  );
}
