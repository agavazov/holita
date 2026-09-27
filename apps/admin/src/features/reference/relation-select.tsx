import { useList } from '@refinedev/core';
import { Alert, Button, Pagination, Select, Space, Spin } from 'antd';
import { useEffect, useState } from 'react';
import type { DataError } from '../../data/data-provider.js';

type LookupRow = { id: string; name: string; active: boolean };
type Props = {
  resource: string;
  value?: string | string[] | null;
  onChange?: (value: string | string[] | undefined) => void;
  multiple?: boolean;
  id?: string;
  disabled?: boolean;
  activeOnly?: boolean;
};
export function RelationSelect({
  resource,
  value,
  onChange,
  multiple,
  id,
  disabled,
  activeOnly = true,
}: Props) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);
  const choices = useList<LookupRow, DataError>({
    resource,
    pagination: { currentPage: page, pageSize: 20, mode: 'server' },
    filters: [
      { field: 'search', operator: 'contains', value: query },
      ...(activeOnly ? [{ field: 'active', operator: 'eq' as const, value: true }] : []),
    ],
    errorNotification: false,
  });
  const selectedIds = value ? (Array.isArray(value) ? value : [value]) : [];
  const selected = useList<LookupRow, DataError>({
    resource,
    pagination: { currentPage: 1, pageSize: 100, mode: 'server' },
    filters: [{ field: 'ids', operator: 'in', value: selectedIds }],
    queryOptions: { enabled: selectedIds.length > 0 },
    errorNotification: false,
  });
  const options = new Map(
    [...choices.result.data, ...(selectedIds.length ? selected.result.data : [])].map((row) => [
      row.id,
      {
        value: row.id,
        label: row.active ? row.name : `${row.name} (inactive)`,
        disabled: activeOnly && !row.active && !selectedIds.includes(row.id),
      },
    ]),
  );
  const failure = choices.query.error ?? (selectedIds.length ? selected.query.error : null);
  return (
    <Select<string | string[]>
      {...(id ? { id } : {})}
      className="full-width"
      disabled={disabled ?? false}
      value={value ?? null}
      onChange={(next) => onChange?.(next)}
      {...(multiple ? { mode: 'multiple' } : {})}
      showSearch
      filterOption={false}
      searchValue={search}
      onSearch={setSearch}
      allowClear
      placeholder="Search by name"
      options={[...options.values()]}
      loading={choices.query.isFetching}
      notFoundContent={choices.query.isFetching ? <Spin size="small" /> : 'No matching records'}
      popupRender={(menu) => (
        <>
          {failure && (
            <Alert
              type="error"
              message={failure.message}
              action={
                <Button
                  size="small"
                  onClick={() => {
                    void choices.query.refetch();
                    if (selectedIds.length) void selected.query.refetch();
                  }}
                >
                  Retry
                </Button>
              }
            />
          )}
          {menu}
          <Space
            className="relation-pagination"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
          >
            <Pagination
              simple
              size="small"
              current={page}
              pageSize={20}
              total={choices.result.total ?? 0}
              onChange={setPage}
              showSizeChanger={false}
            />
          </Space>
        </>
      )}
    />
  );
}
