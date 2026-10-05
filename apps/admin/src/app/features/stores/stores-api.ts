import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { AdminStoresDocument } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';

@Injectable({ providedIn: 'root' })
export class StoresApi {
  private readonly apollo = inject(Apollo);

  watch(language: Language) {
    return this.apollo.watchQuery({ query: AdminStoresDocument, context: { language } });
  }
}
