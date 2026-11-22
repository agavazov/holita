import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  formatNumber,
  innerInputPt,
  injectDrawerHost,
  interpolate,
  lockWhileSaving,
  requireOneOf,
  searchApplies,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { AutoComplete } from 'primeng/autocomplete';
import { ButtonDirective } from 'primeng/button';
import { ArrowDownIcon } from 'primeng/icons/arrowdown';
import { ArrowUpIcon } from 'primeng/icons/arrowup';
import { TrashIcon } from 'primeng/icons/trash';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import type {
  NavigationDestinationType,
  NavigationMenuItemInput,
  NavigationPlacement,
  OperatorNavigationMenuQuery,
} from '../generated/navigation-operations';
import { NavigationApi } from './navigation-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pickerLimit = 20;
const linkFields = ['LabelBg', 'LabelEn', 'DestinationId', 'Url'] as const;
type LinkField = (typeof linkFields)[number];
type Menu = NonNullable<OperatorNavigationMenuQuery['navigationMenu']>;
type RecordDestination = Extract<NavigationDestinationType, 'CATEGORY' | 'COLLECTION' | 'PAGE'>;
type DestinationChoice = { id: string; label: string; visible: boolean; slug?: string };
type LinkForm = ReturnType<typeof linkForm>;
const emptyChoices: DestinationChoice[] = [];

function recordDestination(type: NavigationDestinationType): type is RecordDestination {
  return type === 'CATEGORY' || type === 'COLLECTION' || type === 'PAGE';
}

function validUrl(value: string): boolean {
  const url = value.trim();
  if (!/^https?:\/\//iu.test(url) || /\p{Cc}/u.test(url) || Array.from(url).length > 2048) {
    return false;
  }
  return URL.canParse(url) && !!new URL(url).hostname;
}

function linkForm(item?: Menu['items'][number], choice?: DestinationChoice) {
  const destinationType = new FormControl<NavigationDestinationType>(
    item?.destinationType ?? 'CATEGORY',
    { nonNullable: true },
  );
  const destination = new FormControl<DestinationChoice | string | null>(choice ?? null);
  const url = new FormControl(item?.url ?? '', { nonNullable: true });
  return new FormGroup(
    {
      labelBg: new FormControl(item?.labelBg ?? '', {
        nonNullable: true,
        validators: [textValidator(200)],
      }),
      labelEn: new FormControl(item?.labelEn ?? '', {
        nonNullable: true,
        validators: [textValidator(200)],
      }),
      destinationType,
      destination,
      url,
    },
    [
      requireOneOf('labelBg', 'labelEn'),
      () => {
        if (recordDestination(destinationType.value) && typeof destination.value !== 'object') {
          return { destination: true };
        }
        if (recordDestination(destinationType.value) && !destination.value) {
          return { destination: true };
        }
        return destinationType.value === 'URL' && !validUrl(url.value) ? { url: true } : null;
      },
    ],
  );
}

@Component({
  selector: 'holita-navigation-editor',
  imports: [
    ArrowDownIcon,
    ArrowUpIcon,
    AutoComplete,
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    TrashIcon,
  ],
  templateUrl: './navigation-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationEditor {
  private readonly api = inject(NavigationApi);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private readonly routeData = drawerRouteData(this.route);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly id = computed(() => this.params().get(this.routeData.recordParam ?? 'recordId'));
  private readonly scope = computed(() =>
    this.session.hasRole('OPERATOR') ? this.api.scope() : null,
  );
  private readonly record = resource({
    params: () => {
      const scope = this.scope();
      const id = this.id();
      return scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  private readonly menus = resource({
    params: () => (this.editing ? undefined : (this.scope() ?? undefined)),
    loader: ({ params }) => this.api.list(params),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.scope()) {
      return 'error';
    }
    if (this.editing && !uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading() || this.menus.isLoading()) {
      return 'loading';
    }
    if (this.record.error() || this.menus.error()) {
      return 'error';
    }
    return !this.editing || (this.record.hasValue() && this.record.value()) ? 'ready' : 'not-found';
  });
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly placementOptions = computed(() => {
    const choices: { value: NavigationPlacement; label: string }[] = [
      { value: 'HEADER', label: this.text().navigationHeader },
      { value: 'FOOTER', label: this.text().navigationFooter },
    ];
    const used = this.menus.hasValue() ? this.menus.value() : [];
    return choices.filter(({ value }) => !used.some(({ placement }) => placement === value));
  });
  protected readonly placementLabel = computed(() => {
    const menu = this.record.hasValue() ? this.record.value() : null;
    if (!menu) {
      return null;
    }
    return menu.placement === 'HEADER'
      ? this.text().navigationHeader
      : this.text().navigationFooter;
  });
  protected readonly destinationOptions = computed(() => {
    const text = this.text();
    return [
      { value: 'CATEGORY', label: text.category },
      { value: 'COLLECTION', label: text.navigationCollection },
      { value: 'PAGE', label: text.navigationPage },
      { value: 'BLOG', label: text.navigationBlog },
      { value: 'URL', label: text.navigationUrl },
    ];
  });
  protected readonly labelFields = computed(
    () =>
      [
        {
          field: 'labelBg',
          error: 'LabelBg',
          id: 'label-bg',
          label: this.text().navigationLabelBg,
        },
        {
          field: 'labelEn',
          error: 'LabelEn',
          id: 'label-en',
          label: this.text().navigationLabelEn,
        },
      ] as const,
  );
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly errors = signal<Partial<Record<string, string>>>({});
  protected readonly links = new FormArray<LinkForm>([]);
  protected readonly form = new FormGroup({
    placement: new FormControl<NavigationPlacement | null>(null, (control) =>
      Validators.required(control),
    ),
    links: this.links,
  });
  private readonly picker = signal<{
    row: LinkForm;
    type: RecordDestination;
    search: string;
  } | null>(null);
  private readonly choiceResults = resource({
    params: () => {
      const scope = this.scope();
      const picker = this.picker();
      return scope && picker && searchApplies(picker.search)
        ? { scope, type: picker.type, search: picker.search }
        : undefined;
    },
    loader: ({ params }) =>
      this.api.choices(params.scope, {
        type: params.type,
        search: params.search,
        limit: pickerLimit,
      }),
  });
  private readonly choices = computed(() => {
    const data = this.choiceResults.hasValue() ? this.choiceResults.value() : null;
    return (
      data?.items.map(({ id, name, titleBg, titleEn, visible, slug }) => ({
        id,
        label: name ?? this.pageTitle(titleBg, titleEn) ?? slug,
        visible,
        slug,
      })) ?? []
    );
  });
  protected readonly moreChoices = computed(
    () => this.choiceResults.hasValue() && this.choiceResults.value().total > pickerLimit,
  );
  protected readonly recordDestination = recordDestination;
  protected readonly pickerPt = innerInputPt;

  constructor() {
    effect(() => {
      this.scope();
      const menu = this.record.hasValue() ? this.record.value() : null;
      const placement = menu?.placement ?? this.placementOptions()[0]?.value ?? null;
      this.links.clear({ emitEvent: false });
      this.links.push(
        (menu?.items ?? []).map((item) => linkForm(item, this.savedDestination(item))),
        { emitEvent: false },
      );
      this.form.controls.placement.reset(placement, { emitEvent: false });
      this.form.markAsPristine();
      this.form.markAsUntouched();
      this.errors.set({});
      this.saveError.set(false);
      this.picker.set(null);
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        this.focusError();
      },
    );
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected retry(): void {
    if (this.editing) {
      this.record.reload();
    } else {
      this.menus.reload();
    }
  }

  protected indexedLabel(template: string, index: number): string {
    return interpolate(template, { number: formatNumber(index + 1, this.language.value()) });
  }

  protected labelError(row: LinkForm, index: number, field: 'labelBg' | 'labelEn'): string | null {
    const control = row.controls[field];
    const serverField = field === 'labelBg' ? 'LabelBg' : 'LabelEn';
    return (
      this.errors()[this.linkPath(index, serverField)] ??
      (control.touched ? validationMessage(control.errors, this.language.value()) : null)
    );
  }

  protected destinationError(row: LinkForm, index: number): string | null {
    return (
      this.errors()[this.linkPath(index, 'DestinationId')] ??
      (row.controls.destination.touched && row.errors?.['destination']
        ? this.text().navigationInvalidDestination
        : null)
    );
  }

  protected urlError(row: LinkForm, index: number): string | null {
    return (
      this.errors()[this.linkPath(index, 'Url')] ??
      (row.controls.url.touched && row.errors?.['url'] ? this.text().navigationInvalidUrl : null)
    );
  }

  protected hiddenHint(row: LinkForm): string | null {
    const choice = row.controls.destination.value;
    return choice && typeof choice !== 'string' && !choice.visible
      ? this.text().navigationTargetHidden
      : null;
  }

  protected clearError(path: string): void {
    this.errors.update((errors) => ({ ...errors, [path]: undefined }));
  }

  protected clearLabelErrors(index: number): void {
    this.clearError(this.linkPath(index, 'LabelBg'));
    this.clearError(this.linkPath(index, 'LabelEn'));
  }

  protected changeDestination(row: LinkForm, index: number): void {
    row.controls.destination.reset();
    row.controls.url.reset();
    this.clearError(this.linkPath(index, 'DestinationId'));
    this.clearError(this.linkPath(index, 'Url'));
    if (this.picker()?.row === row) {
      this.picker.set(null);
    }
  }

  protected search(row: LinkForm, search: string): void {
    const type = row.controls.destinationType.value;
    if (recordDestination(type)) {
      this.picker.set({ row, type, search });
    }
  }

  protected suggestions(row: LinkForm): DestinationChoice[] {
    return this.picker()?.row === row ? this.choices() : emptyChoices;
  }

  protected searchError(row: LinkForm): string | null {
    const picker = this.picker();
    if (picker?.row !== row) {
      return null;
    }
    if (!searchApplies(picker.search)) {
      return this.shared().searchTooManyWords;
    }
    return this.choiceResults.error() ? this.text().navigationDestinationsUnavailable : null;
  }

  protected pickerMessage(row: LinkForm): string {
    return (
      this.searchError(row) ??
      (this.choiceResults.isLoading()
        ? this.shared().loading
        : this.text().navigationNoDestinations)
    );
  }

  protected searchFailed(row: LinkForm): boolean {
    return this.picker()?.row === row && !!this.choiceResults.error();
  }

  protected retrySearch(): void {
    this.choiceResults.reload();
  }

  protected addLink(): void {
    this.links.push(linkForm());
    this.linksChanged(this.links.length - 1);
  }

  protected moveLink(index: number, direction: -1 | 1): void {
    const next = index + direction;
    if (next < 0 || next >= this.links.length) {
      return;
    }
    const row = this.links.at(index);
    this.links.removeAt(index, { emitEvent: false });
    this.links.insert(next, row);
    this.linksChanged(next);
  }

  protected removeLink(index: number): void {
    this.links.removeAt(index);
    this.linksChanged(Math.min(index, this.links.length - 1));
  }

  protected linkPath(index: number, field: LinkField): string {
    return `items${String(index)}${field}`;
  }

  protected async save(): Promise<void> {
    const scope = this.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(false);
    const { placement, links } = this.form.getRawValue();
    if (!placement || this.form.invalid) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    const items: NavigationMenuItemInput[] = links.map(
      ({ labelBg, labelEn, destinationType, destination, url }) => ({
        labelBg: labelBg.trim() || null,
        labelEn: labelEn.trim() || null,
        destinationType,
        destinationId:
          recordDestination(destinationType) && destination && typeof destination !== 'string'
            ? destination.id
            : null,
        url: destinationType === 'URL' ? url.trim() : null,
      }),
    );
    this.saving.set(true);
    try {
      const id = await this.api.save(scope, { placement, items }, this.id());
      if (this.destroyRef.destroyed || this.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().navigationSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.scope() !== scope) {
        return;
      }
      const fields = [
        'placement',
        ...links.flatMap((_, index) => linkFields.map((field) => this.linkPath(index, field))),
      ];
      const errors = fieldErrors(error, fields, scope.language, (code, path) => {
        if (path === 'placement' && code === 'DUPLICATE_VALUE') {
          return this.text().navigationDuplicatePlacement;
        }
        if (code === 'INVALID_DESTINATION') {
          return this.text().navigationInvalidDestination;
        }
        return code === 'INVALID_URL' ? this.text().navigationInvalidUrl : undefined;
      });
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private pageTitle(bg: string | null, en: string | null): string | null {
    return this.language.value() === 'bg' ? (bg ?? en) : (en ?? bg);
  }

  private savedDestination(item: Menu['items'][number]): DestinationChoice | undefined {
    if (!item.destinationId) {
      return undefined;
    }
    return {
      id: item.destinationId,
      label:
        this.pageTitle(item.destinationTitleBg, item.destinationTitleEn) ??
        item.destinationName ??
        item.destinationId,
      visible: item.destinationVisible === true,
    };
  }

  private linksChanged(next: number): void {
    this.links.markAsDirty();
    this.errors.update(({ placement }) => ({ placement }));
    this.picker.set(null);
    afterNextRender(
      () => {
        const target =
          next < 0 ? 'navigation-add-link' : `navigation-link-${String(next)}-label-bg`;
        this.formElement()?.nativeElement.ownerDocument.getElementById(target)?.focus();
      },
      { injector: this.injector },
    );
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    const order = [
      'placement',
      ...this.links.controls.flatMap((_, index) =>
        ['label-bg', 'label-en', 'destination', 'url'].map(
          (field) => `link-${String(index)}-${field}`,
        ),
      ),
    ];
    if (!form || !focusFirstInvalid(form, order, 'navigation-')) {
      this.drawer().focusTitle();
    }
  }
}
