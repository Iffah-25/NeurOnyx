import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);

  useEffect(() => {
    if (containerRef.current && !quillRef.current) {
      const quill = new Quill(containerRef.current, {
        theme: 'snow',
        placeholder: placeholder || 'Enter text...',
        modules: {
          toolbar: [
            ['bold', 'italic'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
          ],
        },
      });

      quill.on('text-change', () => {
        const html = containerRef.current?.querySelector('.ql-editor')?.innerHTML;
        if (html) {
          onChange(html === '<p><br></p>' ? '' : html);
        }
      });

      quillRef.current = quill;
    }
  }, []);

  useEffect(() => {
    if (quillRef.current) {
      const currentContent = quillRef.current.root.innerHTML;
      // Only update if the content is actually different to avoid cursor jumping
      if (value !== currentContent && (value || currentContent !== '<p><br></p>')) {
        // Save selection if possible (though updating innerHTML usually resets it)
        // For simple use cases, this check is usually enough to prevent loops
        quillRef.current.root.innerHTML = value || '';
      }
    }
  }, [value]);

  return (
    <div className={`quill-dark ${className || ''}`}>
      <div ref={containerRef} style={{ minHeight: '100px' }} />
    </div>
  );
}
