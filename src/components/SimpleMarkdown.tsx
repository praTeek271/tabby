import React from 'react';
import { MousePointer2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SimpleMarkdownProps {
  content: string;
  onDoubleClick: () => void;
}

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
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 text-primary" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-6 mb-3 text-primary" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2 text-primary" {...props} />,
              p: ({node, ...props}) => <p className="mb-4" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-4 opacity-90" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-4 opacity-90" {...props} />,
              li: ({node, ...props}) => <li className="mb-1" {...props} />,
              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-accent/50 pl-4 my-4 italic opacity-80" {...props} />,
              strong: ({node, ...props}) => <strong className="text-primary font-bold" {...props} />,
              em: ({node, ...props}) => <em className="italic" {...props} />,
              pre: ({node, children, ...props}: any) => {
                // To get the language string from the child code element, if any
                const childArray = React.Children.toArray(children);
                const codeChild = childArray.find((child: any) => child?.type === 'code' || child?.props?.node?.tagName === 'code') as any;
                const className = codeChild?.props?.className || '';
                const match = /language-(\w+)/.exec(className);
                
                return (
                  <div className="relative group/code my-4">
                    {match && (
                      <div className="absolute top-0 right-0 bg-main text-xs px-2 py-1 uppercase tracking-wider text-muted rounded-bl-md z-10 border-b border-l border-border-color">
                        {match[1]}
                      </div>
                    )}
                    <pre className="bg-main/80 p-4 rounded-lg overflow-x-auto border border-border-color text-accent/90 font-mono text-sm leading-relaxed" {...props}>
                      {children}
                    </pre>
                  </div>
                );
              },
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
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

