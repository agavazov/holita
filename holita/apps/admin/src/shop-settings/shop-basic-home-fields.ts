import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { type FormControl, ReactiveFormsModule } from '@angular/forms';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import { FormField, validationMessage } from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import type { OperatorShopSettingsFieldsFragment } from '../generated/shop-settings-operations';
import {
  benefitIcons,
  benefitTextFields,
  homeFieldPath,
  homeTextFields,
  tileTextFields,
  type HomeImageDraft,
  type ShopBasicHomeForm,
} from './shop-basic-home-form';

@Component({
  selector: 'holita-shop-basic-home-fields',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    NgTemplateOutlet,
    ReactiveFormsModule,
    Select,
    ToggleSwitch,
  ],
  templateUrl: './shop-basic-home-fields.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopBasicHomeFields {
  private readonly language = inject(OperatorLanguage).value;
  readonly home = input.required<ShopBasicHomeForm>();
  readonly saved = input.required<OperatorShopSettingsFieldsFragment['basicHome']>();
  readonly errors = input.required<Partial<Record<string, string>>>();
  readonly readOnly = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly editField = output<string>();

  protected readonly t = computed(() => operatorStrings[this.language()]);
  protected readonly path = homeFieldPath;
  protected readonly homeFields = homeTextFields;
  protected readonly tileFields = tileTextFields;
  protected readonly benefitFields = benefitTextFields;
  protected readonly options = computed(() => {
    const { homeIconReturns, homeIconCalendar, homeIconGiftCard, homeIconPlanet } = this.t();
    const labels = [homeIconReturns, homeIconCalendar, homeIconGiftCard, homeIconPlanet];
    return benefitIcons.map((value, index) => ({ value, label: labels[index] }));
  });
  protected readonly labels = computed(() => {
    const t = this.t();
    return {
      announcementBg: t.homeAnnouncement + ' (BG)',
      announcementEn: t.homeAnnouncement + ' (EN)',
      welcomeBg: t.homeWelcome + ' (BG)',
      welcomeEn: t.homeWelcome + ' (EN)',
      heroActionBg: t.homeActionLabel + ' (BG)',
      heroActionEn: t.homeActionLabel + ' (EN)',
      heroHref: t.homeLink,
      titleBg: t.homeTitle + ' (BG)',
      titleEn: t.homeTitle + ' (EN)',
      eyebrowBg: t.homeEyebrow + ' (BG)',
      eyebrowEn: t.homeEyebrow + ' (EN)',
      imageAltBg: t.productImageAlt + ' (BG)',
      imageAltEn: t.productImageAlt + ' (EN)',
      href: t.homeLink,
      descriptionBg: t.homeDescription + ' (BG)',
      descriptionEn: t.homeDescription + ' (EN)',
    };
  });

  protected fieldError(control: FormControl<string>, path: string) {
    return (
      this.errors()[path] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected chooseImage(
    control: FormControl<HomeImageDraft>,
    path: string,
    input: HTMLInputElement,
  ) {
    const file = input.files?.item(0);
    input.value = '';
    if (file) {
      this.changeImage(control, path, file);
    }
  }

  protected changeImage(control: FormControl<HomeImageDraft>, path: string, value: HomeImageDraft) {
    control.setValue(value);
    control.markAsDirty();
    this.editField.emit(path);
    this.editField.emit('basicHomeImages');
  }
}
