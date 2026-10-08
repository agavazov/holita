import {
  type AfterViewInit,
  Component,
  DestroyRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { messages, type Language } from '../../../i18n/messages';
import { descriptionBytes, isDescriptionLink, safeDescriptionHtml } from './description-html';

@Component({
  selector: 'holita-description-editor',
  imports: [FormsModule, ButtonDirective, Dialog, InputText],
  templateUrl: './description-editor.html',
  styleUrl: './description-editor.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DescriptionEditor), multi: true },
  ],
})
export class DescriptionEditor implements AfterViewInit, ControlValueAccessor {
  readonly language = input.required<Language>();
  readonly invalid = input(false);
  readonly text = computed(() => messages[this.language()]);
  readonly disabled = signal(false);
  readonly value = signal('');
  readonly bytes = computed(
    () => `${(descriptionBytes(this.value()) / 1024).toFixed(1)} / 100 KiB`,
  );
  readonly linkOpen = signal(false);
  readonly link = signal('');
  readonly linkError = signal(false);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkInput');
  private editor: Editor | undefined;
  private readonly revision = signal(0);
  private readonly mounted = signal(false);
  private change: (value: string) => void = () => {};
  private touched: () => void = () => {};
  private readonly destroyRef = inject(DestroyRef);
  readonly state = computed(() => {
    this.revision();
    const editor = this.editor;
    return {
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      bullet: editor?.isActive('bulletList') ?? false,
      ordered: editor?.isActive('orderedList') ?? false,
      link: editor?.isActive('link') ?? false,
      selection: editor ? !editor.state.selection.empty : false,
      undo: editor?.can().undo() ?? false,
      redo: editor?.can().redo() ?? false,
    };
  });
  constructor() {
    effect(() => {
      this.mounted();
      this.editor?.setOptions({
        editorProps: {
          transformPastedHTML: safeDescriptionHtml,
          attributes: {
            id: 'event-descriptionHtml',
            role: 'textbox',
            'aria-label': this.text().eventDescription,
            'aria-multiline': 'true',
            'aria-invalid': String(this.invalid()),
            'aria-describedby': 'event-descriptionHtml-error',
            class: 'event-rich-content',
          },
        },
      });
    });
    this.destroyRef.onDestroy(() => this.editor?.destroy());
  }
  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.surface().nativeElement,
      content: safeDescriptionHtml(this.value()),
      editable: !this.disabled(),
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
      editorProps: { transformPastedHTML: safeDescriptionHtml },
      onUpdate: ({ editor }) => {
        const html = editor.isEmpty ? '' : editor.getHTML();
        this.value.set(html);
        this.change(html);
      },
      onBlur: () => {
        this.touched();
      },
      onTransaction: () => {
        this.revision.update((value) => value + 1);
      },
    });
    this.mounted.set(true);
    this.revision.update((value) => value + 1);
  }
  writeValue(value: unknown): void {
    const html = typeof value === 'string' ? value : '';
    this.value.set(html);
    this.editor?.commands.setContent(safeDescriptionHtml(html), { emitUpdate: false });
  }
  registerOnChange(change: (value: string) => void): void {
    this.change = change;
  }
  registerOnTouched(touched: () => void): void {
    this.touched = touched;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    this.editor?.setEditable(!disabled, false);
    if (disabled) this.linkOpen.set(false);
  }
  focus(): void {
    this.editor?.commands.focus();
  }
  format(
    action:
      | 'paragraph'
      | 'h2'
      | 'h3'
      | 'bold'
      | 'italic'
      | 'bullet'
      | 'ordered'
      | 'unlink'
      | 'undo'
      | 'redo',
  ): void {
    if (this.disabled() || !this.editor) return;
    const chain = this.editor.chain().focus();
    switch (action) {
      case 'paragraph':
        chain.setParagraph().run();
        break;
      case 'h2':
        chain.setHeading({ level: 2 }).run();
        break;
      case 'h3':
        chain.setHeading({ level: 3 }).run();
        break;
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'bullet':
        chain.toggleBulletList().run();
        break;
      case 'ordered':
        chain.toggleOrderedList().run();
        break;
      case 'unlink':
        chain.extendMarkRange('link').unsetLink().run();
        break;
      case 'undo':
        chain.undo().run();
        break;
      case 'redo':
        chain.redo().run();
        break;
    }
  }
  showLink(): void {
    if (this.disabled()) return;
    const href: unknown = this.editor?.getAttributes('link')['href'];
    this.link.set(typeof href === 'string' ? href : '');
    this.linkError.set(false);
    this.linkOpen.set(true);
  }
  focusLink(): void {
    this.linkInput()?.nativeElement.focus();
  }
  editLink(value: unknown): void {
    if (typeof value === 'string') {
      this.link.set(value);
      this.linkError.set(false);
    }
  }
  applyLink(): void {
    if (this.disabled()) return;
    const href = this.link().trim();
    if (!isDescriptionLink(href)) {
      this.linkError.set(true);
      return;
    }
    this.editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
    this.linkOpen.set(false);
  }
}
