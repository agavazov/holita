import { Button, DatePicker, Form, InputNumber, Select, Space } from 'antd';
import { tagsResource, venuesResource } from '../../../data/data-provider.js';
import { RelationSelect } from '../relation-select.js';
import { dayjs } from './event-time.js';
import type { Dayjs } from 'dayjs';
import { eventFormats, type EventListState } from './event-list-state.js';

type Fields = Partial<Pick<EventListState, 'formats' | 'venueIds' | 'tagIds'>> & {
  featured?: boolean;
  dates?: [Dayjs | null, Dayjs | null];
  capacityMin?: number | null;
  capacityMax?: number | null;
};
export function EventFilters({
  storeId,
  state,
  onApply,
}: {
  storeId: string;
  state: EventListState;
  onApply: (patch: Partial<EventListState>) => void;
}) {
  const [form] = Form.useForm<Fields>();
  return (
    <Form<Fields>
      form={form}
      layout="vertical"
      className="event-filters"
      initialValues={{
        formats: state.formats,
        venueIds: state.venueIds,
        tagIds: state.tagIds,
        featured: state.featured,
        capacityMin: state.capacityMin,
        capacityMax: state.capacityMax,
        dates: [state.from ? dayjs(state.from) : null, state.to ? dayjs(state.to) : null],
      }}
      onFinish={(values) => {
        onApply({
          formats: values.formats ?? [],
          venueIds: values.venueIds ?? [],
          tagIds: values.tagIds ?? [],
          featured: values.featured,
          capacityMin: values.capacityMin ?? undefined,
          capacityMax: values.capacityMax ?? undefined,
          from: values.dates?.[0]?.format('YYYY-MM-DD') ?? '',
          to: values.dates?.[1]?.format('YYYY-MM-DD') ?? '',
        });
      }}
    >
      <div className="event-filter-grid">
        <Form.Item name="formats" label="Format">
          <Select mode="multiple" allowClear options={eventFormats} placeholder="All formats" />
        </Form.Item>
        <Form.Item name="venueIds" label="Venue">
          <RelationSelect resource={venuesResource(storeId)} multiple activeOnly={false} />
        </Form.Item>
        <Form.Item name="tagIds" label="Tag">
          <RelationSelect resource={tagsResource(storeId)} multiple activeOnly={false} />
        </Form.Item>
        <Form.Item name="featured" label="Featured">
          <Select
            allowClear
            placeholder="All events"
            options={[
              { value: true, label: 'Featured' },
              { value: false, label: 'Not featured' },
            ]}
          />
        </Form.Item>
        <Form.Item name="dates" label="Start date (Sofia)">
          <DatePicker.RangePicker
            className="full-width"
            format="YYYY-MM-DD"
            allowEmpty={[true, true]}
          />
        </Form.Item>
        <div>
          <div className="event-filter-label">Capacity</div>
          <Space align="start">
            <Form.Item
              name="capacityMin"
              rules={[
                {
                  type: 'integer',
                  min: 1,
                  max: 2147483647,
                  message: 'Use a positive whole number.',
                },
              ]}
            >
              <InputNumber
                aria-label="Minimum capacity"
                placeholder="Minimum"
                min={1}
                max={2147483647}
              />
            </Form.Item>
            <span>–</span>
            <Form.Item
              name="capacityMax"
              dependencies={['capacityMin']}
              rules={[
                {
                  type: 'integer',
                  min: 1,
                  max: 2147483647,
                  message: 'Use a positive whole number.',
                },
                {
                  validator: (_, value: number | null | undefined) =>
                    value != null &&
                    form.getFieldValue('capacityMin') != null &&
                    value < form.getFieldValue('capacityMin')
                      ? Promise.reject(new Error('Maximum must be at least the minimum.'))
                      : Promise.resolve(),
                },
              ]}
            >
              <InputNumber
                aria-label="Maximum capacity"
                placeholder="Maximum"
                min={1}
                max={2147483647}
              />
            </Form.Item>
          </Space>
        </div>
      </div>
      <Button htmlType="submit" type="primary">
        Apply filters
      </Button>
    </Form>
  );
}
