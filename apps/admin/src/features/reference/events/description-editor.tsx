import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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
  error?: boolean;
  id?: string;
  'aria-describedby'?: string;
  ref?: Ref<{ focus: () => void }>;
};

export function DescriptionEditor({
  value,
  onChange,
  disabled = false,
  error = false,
  id,
  ref,
  ...aria
}: Props) {
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
        'aria-invalid': String(error),
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
    <Box
      sx={{
        border: 1,
        borderColor: error ? 'error.main' : 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        '&:focus-within': { borderColor: error ? 'error.main' : 'primary.main' },
        '& .tiptap': { minHeight: 260, p: { xs: 2, md: 3 }, outline: 'none' },
        '& .tiptap[contenteditable="false"]': { color: 'text.disabled' },
      }}
    >
      <Stack
        direction="row"
        sx={{
          flexWrap: 'wrap',
          gap: 0.5,
          p: 1,
          bgcolor: 'background.elevation1',
          borderBottom: 1,
          borderColor: 'divider',
        }}
        role="group"
        aria-label="Description formatting"
      >
        <TextField
          select
          size="small"
          value={state.block}
          disabled={disabled}
          sx={{ minWidth: 130 }}
          slotProps={{ select: { inputProps: { 'aria-label': 'Text style' } } }}
          onChange={(event) => {
            const block = event.target.value;
            if (block === 'paragraph') editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .setHeading({ level: block === 'h2' ? 2 : 3 })
                .run();
          }}
        >
          <MenuItem value="paragraph">Paragraph</MenuItem>
          <MenuItem value="h2">Heading 2</MenuItem>
          <MenuItem value="h3">Heading 3</MenuItem>
        </TextField>
        {actions.map((action) => (
          <Button
            key={action.label}
            aria-label={action.label}
            title={action.label}
            aria-pressed={action.active}
            variant={action.active ? 'soft' : 'text'}
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
          variant={state.link ? 'soft' : 'text'}
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
          variant="text"
          disabled={disabled || !state.link}
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
          }}
        >
          Remove link
        </Button>
        <Button
          variant="text"
          disabled={disabled || !state.undo}
          onClick={() => {
            editor.chain().focus().undo().run();
          }}
        >
          Undo
        </Button>
        <Button
          variant="text"
          disabled={disabled || !state.redo}
          onClick={() => {
            editor.chain().focus().redo().run();
          }}
        >
          Redo
        </Button>
      </Stack>
      <EditorContent editor={editor} />
      <Stack
        direction="row"
        sx={{
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Select text to add a link.
        </Typography>
        <Typography
          variant="caption"
          color={bytes > descriptionMaxBytes ? 'error' : 'text.secondary'}
        >
          {(bytes / 1024).toFixed(1)} / 100 KiB
        </Typography>
      </Stack>
      <Dialog
        open={linkOpen}
        onClose={() => {
          setLinkOpen(false);
        }}
        aria-labelledby="description-link-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="description-link-title">Edit link</DialogTitle>
        <DialogContent>
          <TextField
            id="description-link"
            label="Web address"
            fullWidth
            autoFocus
            value={link}
            placeholder="https://example.com"
            disabled={disabled}
            error={linkError}
            helperText="Use an absolute http or https URL without embedded credentials."
            onChange={(event) => {
              setLink(event.target.value);
              setLinkError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            color="neutral"
            onClick={() => {
              setLinkOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" disabled={disabled} onClick={applyLink}>
            Apply link
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
