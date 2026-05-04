import React from 'react';
import type { Message } from '../types';
import { MessageMetadata } from './MessageMetadata';

// Importar librerías estáticamente (asumen que están instaladas vía Dockerfile)
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface FormattedMessageProps {
  message: Message;
}

export function FormattedMessage({ message }: FormattedMessageProps) {
  const hasMetadata = message.metadata && Object.keys(message.metadata).length > 0;

  // Si las librerías no están instaladas, mostrar texto plano
  if (!ReactMarkdown) {
    return (
      <div className="formatted-message">
        <div className="message-content">
          {message.content}
        </div>
        {hasMetadata && <MessageMetadata metadata={message.metadata} />}
      </div>
    );
  }

  return (
    <div className="formatted-message">
      <div className="message-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {hasMetadata && <MessageMetadata metadata={message.metadata} />}
    </div>
  );
}
