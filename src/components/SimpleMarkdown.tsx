import React, { useState } from 'react';
import { MousePointer2, Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface SimpleMarkdownProps {
  content: string;
  onDoubleClick: () => void;
}

const CodeBlock = ({ node, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);

  const childArray = React.Children.toArray(children);
  const codeChild = childArray.find((child: any) => child?.type === 'code' || child?.props?.node?.tagName === 'code') as any;
  const className = codeChild?.props?.className || '';
  const match = /language-(\w+)/.exec(className);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    // In react-markdown, the actual string content is typically in codeChild.props.children
    // If it is an array of strings, we join it.
    let textToCopy = '';
    if (codeChild?.props?.children) {
      if (Array.isArray(codeChild.props.children)) {
        textToCopy = codeChild.props.children.join('');
      } else {
        textToCopy = codeChild.props.children.toString();
      }
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group/code my-4">
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity">
        {match && (
           <span className="bg-main/90 text-[10px] px-2 py-1 uppercase tracking-wider text-muted rounded-md border border-border-color backdrop-blur-sm shadow-sm select-none">
             {match[1]}
           </span>
        )}
        <button
          onClick={handleCopy}
          className="bg-main/90 hover:bg-panel text-muted hover:text-primary p-1.5 rounded-md border border-border-color transition-colors shadow-sm cursor-pointer"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
      <pre 
        className="bg-main/80 p-4 rounded-lg overflow-x-auto border border-border-color text-accent/90 font-mono text-sm leading-relaxed" 
        {...props}
      >
        {children}
      </pre>
    </div>
  );
};

export const SimpleMarkdown = ({ content, onDoubleClick }: SimpleMarkdownProps) => {
  return (
    <div 
      onDoubleClick={onDoubleClick}
      className="max-w-none font-sans leading-relaxed cursor-text group relative min-h-full pb-32 text-primary/90"
    >
      <div className="absolute -top-6 right-0 opacity-0 group-hover:opacity-40 text-[9px] uppercase tracking-widest flex items-center gap-1 transition-opacity text-primary select-none">
        <MousePointer2 size={10} /> Double-click to edit
      </div>
      {!content ? (
        <p className="opacity-20 italic select-none">Double-click to start writing...</p>
      ) : (
        <div className="markdown-body custom-markdown">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 text-primary" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-6 mb-3 text-primary" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2 text-primary" {...props} />,
              p: ({node, ...props}) => <p className="mb-4" {...props} />,
              ul: ({node, className, ...props}) => <ul className={`ml-6 mb-4 opacity-90 ${className?.includes('contains-task-list') ? 'list-none ml-2' : 'list-disc'} ${className || ''}`} {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-4 opacity-90" {...props} />,
              li: ({node, className, ...props}) => <li className={`mb-1 left-align ${className || ''}`} {...props} />,
              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-accent/50 pl-4 my-4 italic opacity-80" {...props} />,
              strong: ({node, ...props}) => <strong className="text-primary font-bold" {...props} />,
              em: ({node, ...props}) => <em className="italic" {...props} />,
              pre: CodeBlock,
              code: ({node, className, children, ...props}: any) => {
                const isBlock = node?.position?.start?.line !== node?.position?.end?.line;
                const match = /language-(\w+)/.exec(className || '');
                if (isBlock || match) {
                  return <code className={className} {...props}>{children}</code>;
                }
                return (
                  <span className="bg-accent-mute text-accent px-1.5 py-0.5 rounded-sm font-medium" {...props}>
                    {children}
                  </span>
                )
              },
              table: ({node, ...props}) => (
                <div className="overflow-x-auto mb-6 border border-border-color rounded-lg">
                  <table className="w-full text-left border-collapse" {...props} />
                </div>
              ),
              thead: ({node, ...props}) => <thead className="bg-main text-primary border-b border-border-color" {...props} />,
              th: ({node, ...props}) => <th className="p-3 font-semibold text-sm uppercase tracking-wider" {...props} />,
              td: ({node, ...props}) => <td className="p-3 border-b border-border-color/50 text-primary/90" {...props} />,
              tr: ({node, ...props}) => <tr className="hover:bg-primary/5 transition-colors" {...props} />,
              hr: ({node, ...props}) => <hr className="my-8 border-border-color" {...props} />,
              a: ({node, ...props}) => <a className="text-accent hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
              input: ({node, ...props}) => {
                if (props.type === 'checkbox') {
                  return (
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 mr-3 align-middle appearance-none bg-panel/30 border-2 border-muted/70 hover:border-accent transition-colors rounded-[4px] checked:bg-accent checked:border-accent relative cursor-default disabled:opacity-100 shadow-sm
                                 after:content-[''] after:absolute after:hidden checked:after:block after:left-[4px] after:top-[1px] after:w-[5px] after:h-[9px] after:border-solid after:border-panel after:border-r-2 after:border-b-2 after:rotate-45"
                      {...props} 
                      disabled={true}
                    />
                  );
                }
                return <input {...props} />;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

