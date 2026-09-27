import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button, Form, Input, Modal, Select, Space, Typography } from 'antd';
import {
  descriptionBytes,
  descriptionMaxBytes,
  isDescriptionLink,
  safeDescriptionHtml,
} from './description-html.js';

type Props = {
  value?: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
  'aria-describedby'?: string;
  ref?: Ref<{ focus: () => void }>;
};

export function DescriptionEditor({ value, onChange, disabled = false, id, ref, ...aria }: Props) {
  const { status } = Form.Item.useStatus();
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [initialContent] = useState(() => safeDescriptionHtml(value ?? ''));
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: false,
          isAllowedUri: isDescriptionLink,
          HTMLAttributes: { target: null, rel: null, class: null },
        },
      }),
    ],
    content: initialContent,
    editable: !disabled,
    editorProps: {
      attributes: {
        id: id ?? 'event-description',
        role: 'textbox',
        'aria-label': 'Description',
        'aria-multiline': 'true',
        'aria-describedby': aria['aria-describedby'] ?? '',
        'aria-invalid': String(status === 'error'),
        class: 'event-rich-content',
      },
      transformPastedHTML: safeDescriptionHtml,
    },
    onUpdate: ({ editor: current }) => {
      onChange?.(current.isEmpty ? null : current.getHTML());
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      link: current.isActive('link'),
      selection: !current.state.selection.empty,
      block: current.isActive('heading', { level: 2 })
        ? 'h2'
        : current.isActive('heading', { level: 3 })
          ? 'h3'
          : 'paragraph',
      undo: current.can().undo(),
      redo: current.can().redo(),
    }),
  });
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editor.commands.focus();
      },
    }),
    [editor],
  );
  useEffect(() => {
    editor.setEditable(!disabled, false);
  }, [editor, disabled]);
  useEffect(() => {
    const html = value ?? '';
    if (html !== (editor.isEmpty ? '' : editor.getHTML()))
      editor.commands.setContent(safeDescriptionHtml(html), { emitUpdate: false });
  }, [editor, value]);

  function applyLink() {
    if (disabled) return;
    const href = link.trim();
    if (!isDescriptionLink(href)) {
      setLinkError(true);
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinkOpen(false);
  }
  const bytes = descriptionBytes(value);
  const actions = [
    {
      label: 'Bold',
      text: <strong>B</strong>,
      active: state.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      text: <em>I</em>,
      active: state.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Bullet list',
      text: '• List',
      active: state.bullet,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      text: '1. List',
      active: state.ordered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];
  return (
    <div className={`description-editor${status === 'error' ? ' description-editor-error' : ''}`}>
      <Space wrap className="description-toolbar" role="group" aria-label="Description formatting">
        <Select
          aria-label="Text style"
          value={state.block}
          disabled={disabled}
          className="description-block-select"
          options={[
            { value: 'paragraph', label: 'Paragraph' },
            { value: 'h2', label: 'Heading 2' },
            { value: 'h3', label: 'Heading 3' },
          ]}
          onChange={(block) => {
            if (block === 'paragraph') editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .setHeading({ level: block === 'h2' ? 2 : 3 })
                .run();
          }}
        />
        {actions.map((action) => (
          <Button
            key={action.label}
            aria-label={action.label}
            title={action.label}
            aria-pressed={action.active}
            type={action.active ? 'primary' : 'text'}
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              action.run();
            }}
          >
            {action.text}
          </Button>
        ))}
        <Button
          type={state.link ? 'primary' : 'text'}
          disabled={disabled || (!state.selection && !state.link)}
          onClick={() => {
            const href: unknown = editor.getAttributes('link').href;
            setLink(typeof href === 'string' ? href : '');
            setLinkError(false);
            setLinkOpen(true);
          }}
        >
          Link
        </Button>
        <Button
          type="text"
          disabled={disabled || !state.link}
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
          }}
        >
          Remove link
        </Button>
        <Button
          type="text"
          disabled={disabled || !state.undo}
          onClick={() => {
            editor.chain().focus().undo().run();
          }}
        >
          Undo
        </Button>
        <Button
          type="text"
          disabled={disabled || !state.redo}
          onClick={() => {
            editor.chain().focus().redo().run();
          }}
        >
          Redo
        </Button>
      </Space>
      <EditorContent editor={editor} />
      <div className="description-footer">
        <Typography.Text type="secondary">Select text to add a link.</Typography.Text>
        <Typography.Text type={bytes > descriptionMaxBytes ? 'danger' : 'secondary'}>
          {(bytes / 1024).toFixed(1)} / 100 KiB
        </Typography.Text>
      </div>
      <Modal
        title="Edit link"
        open={linkOpen}
        okText="Apply link"
        onOk={applyLink}
        okButtonProps={{ disabled }}
        onCancel={() => {
          setLinkOpen(false);
        }}
      >
        <label htmlFor="description-link">Web address</label>
        <Input
          id="description-link"
          value={link}
          placeholder="https://example.com"
          disabled={disabled}
          status={linkError ? 'error' : ''}
          onChange={(event) => {
            setLink(event.target.value);
            setLinkError(false);
          }}
          onPressEnter={(event) => {
            event.preventDefault();
            applyLink();
          }}
        />
        <Typography.Paragraph
          type={linkError ? 'danger' : 'secondary'}
          role={linkError ? 'alert' : undefined}
        >
          Use an absolute http or https URL without embedded credentials.
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
