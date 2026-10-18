import type { Translation } from 'primeng/api';
import { messages, type Language } from '../i18n/messages';

/**
 * PrimeNG texts for one language: date picker names and format, option overlay messages and the
 * aria labels. `aria` carries PrimeNG's own labels that the catalogs do not replace.
 */
export function primeNgTranslation(language: Language, aria: Translation['aria']): Translation {
  const text = messages[language];
  return {
    ...text.primeng,
    firstDayOfWeek: 1,
    dateFormat: 'dd.mm.yy',
    selectionMessage: text.selectedItemsMessage,
    emptySelectionMessage: text.emptySelectionMessage,
    aria: {
      ...aria,
      previous: text.previousSection,
      next: text.nextSection,
      firstPageLabel: text.firstPageLabel,
      prevPageLabel: text.prevPageLabel,
      nextPageLabel: text.nextPageLabel,
      lastPageLabel: text.lastPageLabel,
      pageLabel: text.pageLabel,
      rowsPerPageLabel: text.rowsPerPageLabel,
    },
  };
}
