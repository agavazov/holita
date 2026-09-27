import { useEffect } from 'react';
import type { FormInstance } from 'antd';
import type { DataError } from '../../data/data-provider.js';

type FieldName<T> = Parameters<FormInstance<T>['setFields']>[0][number]['name'];

export function useFieldErrors<T>(
  form: FormInstance<T>,
  error: DataError | null,
  names: readonly FieldName<T>[],
  openField?: (name: string) => void,
) {
  useEffect(() => {
    if (!error?.fieldErrors.length) return;
    const fields = error.fieldErrors.flatMap((field) => {
      const name = names.find((name) => name === field.path);
      return name === undefined ? [] : [{ name, errors: [field.message] }];
    });
    const first = fields[0];
    if (!first) return;
    form.setFields(fields);
    openField?.(String(first.name));
    const frame = requestAnimationFrame(() => {
      form.scrollToField(first.name, { focus: true });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [form, error, names, openField]);
}
