import { useCallback, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { tagsResource, venuesResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceEventInput,
  ReferenceEventDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { DescriptionEditor } from './description-editor.js';
import { descriptionBytes, descriptionMaxBytes } from './description-html.js';
import { RelationSelect } from '../relation-select.js';
import { useFieldErrors } from '../use-field-errors.js';
import { dayjs, eventTime, eventInstant } from './event-time.js';
import { eventFormats, eventStatuses } from './event-list-state.js';

type Values = Omit<
  CreateReferenceEventInput,
  'startsAt' | 'endsAt' | 'registrationOpensOn' | 'registrationClosesOn'
> & {
  startsAt: Dayjs;
  endsAt: Dayjs;
  registrationOpensOn?: Dayjs | null;
  registrationClosesOn?: Dayjs | null;
};
type Props = {
  storeId: string;
  initialValues?: ReferenceEventDetailsFragment | undefined;
  pending: boolean;
  gallery?: ReactNode;
  saveDisabled?: boolean;
  error: DataError | null;
  tab: string;
  onTabChange: (tab: string) => void;
  onSubmit: (values: CreateReferenceEventInput) => void;
  onCancel: () => void;
  onChange: () => void;
};
const scheduleFields = [
  'startsAt',
  'endsAt',
  'registrationOpensOn',
  'registrationClosesOn',
  'venueId',
  'meetingUrl',
  'tagIds',
];
function validTime(_rule: unknown, value: Dayjs | null | undefined): Promise<void> {
  if (!value) return Promise.resolve();
  try {
    eventInstant(value);
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(
      error instanceof Error ? error : new Error('Choose a valid date and time.'),
    );
  }
}
const fieldNames = [
  'title',
  'code',
  'status',
  'format',
  'capacity',
  'budget',
  'featured',
  'startsAt',
  'endsAt',
  'registrationOpensOn',
  'registrationClosesOn',
  'venueId',
  'meetingUrl',
  'tagIds',
  'summary',
  'descriptionHtml',
] as const;
export function EventForm({
  storeId,
  initialValues,
  pending,
  gallery,
  saveDisabled = false,
  error,
  tab,
  onTabChange,
  onSubmit,
  onCancel,
  onChange,
}: Props) {
  const [form] = Form.useForm<Values>();
  const format: unknown = Form.useWatch('format', form);
  const openField = useCallback(
    (name: string) => {
      onTabChange(
        scheduleFields.includes(name)
          ? 'schedule'
          : ['summary', 'descriptionHtml'].includes(name)
            ? 'content'
            : 'general',
      );
    },
    [onTabChange],
  );
  useFieldErrors(form, error, fieldNames, openField);
  const initial = initialValues
    ? {
        ...initialValues,
        startsAt: eventTime(initialValues.startsAt),
        endsAt: eventTime(initialValues.endsAt),
        registrationOpensOn: initialValues.registrationOpensOn
          ? dayjs(initialValues.registrationOpensOn)
          : null,
        registrationClosesOn: initialValues.registrationClosesOn
          ? dayjs(initialValues.registrationClosesOn)
          : null,
      }
    : { status: 'DRAFT', format: 'IN_PERSON', featured: false, tagIds: [] };
  return (
    <Form<Values>
      form={form}
      aria-label="Event form"
      layout="vertical"
      requiredMark="optional"
      disabled={pending}
      initialValues={initial}
      onValuesChange={onChange}
      onFinishFailed={({ errorFields }) => {
        const name = errorFields[0]?.name[0];
        if (typeof name === 'string') {
          openField(name);
          requestAnimationFrame(() => {
            form.scrollToField(name, { focus: true });
          });
        }
      }}
      onFinish={(values) => {
        if (pending || saveDisabled) return;
        onSubmit({
          title: values.title.trim(),
          code: values.code.trim(),
          status: values.status ?? 'DRAFT',
          format: values.format,
          capacity: values.capacity ?? null,
          budget: values.budget ?? null,
          featured: values.featured ?? false,
          startsAt: eventInstant(values.startsAt),
          endsAt: eventInstant(values.endsAt),
          registrationOpensOn: values.registrationOpensOn?.format('YYYY-MM-DD') ?? null,
          registrationClosesOn: values.registrationClosesOn?.format('YYYY-MM-DD') ?? null,
          venueId: values.format === 'ONLINE' ? null : (values.venueId ?? null),
          meetingUrl: values.format === 'IN_PERSON' ? null : values.meetingUrl?.trim() || null,
          tagIds: values.tagIds ?? [],
          summary: values.summary?.trim() || null,
          descriptionHtml: values.descriptionHtml || null,
        });
      }}
    >
      {error && (
        <Alert
          className="form-error"
          type="error"
          showIcon
          message={error.message}
          description={error.requestId ? `Request ID: ${error.requestId}` : undefined}
        />
      )}
      <section hidden={tab !== 'general'} aria-label="General">
        <Typography.Title level={4}>Event essentials</Typography.Title>
        <Typography.Paragraph type="secondary">
          Give your event a clear identity and choose how people will attend.
        </Typography.Paragraph>
        <Row gutter={24}>
          <Col xs={24} md={16}>
            <Form.Item
              name="title"
              label="Title"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  max: 200,
                  message: 'Enter a title of up to 200 characters.',
                },
              ]}
            >
              <Input autoFocus autoComplete="off" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="code"
              label="Code"
              extra="Unique in this store. Fixed after creation."
              rules={[
                {
                  required: true,
                  whitespace: true,
                  max: 100,
                  message: 'Enter a code of up to 100 characters.',
                },
              ]}
            >
              <Input readOnly={Boolean(initialValues)} autoComplete="off" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select options={eventStatuses} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="format" label="Format" rules={[{ required: true }]}>
              <Select options={eventFormats} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="capacity"
              label="Capacity"
              rules={[
                {
                  type: 'integer',
                  min: 1,
                  max: 2147483647,
                  message: 'Enter a positive whole number.',
                },
              ]}
            >
              <InputNumber className="full-width" min={1} max={2147483647} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="budget"
              label="Budget (EUR)"
              rules={[
                {
                  pattern: /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/,
                  message: 'Use 0–9999999999.99, with at most two decimals.',
                },
              ]}
            >
              <InputNumber<string>
                className="full-width"
                stringMode
                min="0"
                max="9999999999.99"
                step="0.01"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="featured" label="Featured" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </section>
      <section hidden={tab !== 'schedule'} aria-label="Schedule and location">
        <Typography.Title level={4}>Schedule & location</Typography.Title>
        <Typography.Paragraph type="secondary">
          All event times are in Europe/Sofia. Registration dates are calendar dates.
        </Typography.Paragraph>
        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="startsAt"
              label="Starts at"
              rules={[
                { required: true, message: 'Choose the start date and time.' },
                { validator: validTime },
              ]}
            >
              <DatePicker
                className="full-width"
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                needConfirm={false}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="endsAt"
              label="Ends at"
              dependencies={['startsAt']}
              rules={[
                { required: true, message: 'Choose the end date and time.' },
                { validator: validTime },
                () => ({
                  validator(_rule: unknown, value: Dayjs | null | undefined) {
                    const start: unknown = form.getFieldValue('startsAt');
                    return value &&
                      dayjs.isDayjs(start) &&
                      eventInstant(value) <= eventInstant(start)
                      ? Promise.reject(new Error('End must be after start.'))
                      : Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker
                className="full-width"
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                needConfirm={false}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="registrationOpensOn"
              label="Registration opens"
              dependencies={['registrationClosesOn']}
              rules={[
                () => ({
                  validator(_rule: unknown, value: Dayjs | null | undefined) {
                    return !value && form.getFieldValue('registrationClosesOn')
                      ? Promise.reject(new Error('Provide both registration dates.'))
                      : Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker className="full-width" format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="registrationClosesOn"
              label="Registration closes"
              dependencies={['registrationOpensOn', 'startsAt']}
              rules={[
                () => ({
                  validator(_rule: unknown, value: Dayjs | null | undefined) {
                    const open: unknown = form.getFieldValue('registrationOpensOn');
                    const start: unknown = form.getFieldValue('startsAt');
                    if (!value && open)
                      return Promise.reject(new Error('Provide both registration dates.'));
                    if (
                      value &&
                      dayjs.isDayjs(open) &&
                      value.format('YYYY-MM-DD') < open.format('YYYY-MM-DD')
                    )
                      return Promise.reject(new Error('Close on or after opening.'));
                    if (
                      value &&
                      dayjs.isDayjs(start) &&
                      value.format('YYYY-MM-DD') > start.format('YYYY-MM-DD')
                    )
                      return Promise.reject(new Error('Close by the event start date.'));
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker className="full-width" format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
        </Row>
        {(format ?? initial.format) !== 'ONLINE' && (
          <Form.Item
            name="venueId"
            label="Venue"
            rules={[{ required: true, message: 'Choose a venue.' }]}
          >
            <RelationSelect resource={venuesResource(storeId)} disabled={pending} />
          </Form.Item>
        )}
        {(format ?? initial.format) !== 'IN_PERSON' && (
          <Form.Item
            name="meetingUrl"
            label="Meeting URL"
            rules={[
              { required: true, whitespace: true, message: 'Enter a meeting URL.' },
              { type: 'url', message: 'Enter an http or https URL.' },
              {
                pattern: /^https?:\/\//i,
                max: 2000,
                message: 'Enter an http or https URL of up to 2000 characters.',
              },
            ]}
          >
            <Input placeholder="https://" />
          </Form.Item>
        )}
        <Form.Item name="tagIds" label="Tags">
          <RelationSelect resource={tagsResource(storeId)} multiple disabled={pending} />
        </Form.Item>
      </section>
      <section hidden={tab !== 'content'} aria-label="Content">
        <Typography.Title level={4}>Event content</Typography.Title>
        <Typography.Paragraph type="secondary">
          A short introduction that helps people understand the event.
        </Typography.Paragraph>
        <Form.Item
          name="summary"
          label="Summary"
          rules={[{ max: 500, message: 'Use at most 500 characters.' }]}
        >
          <Input.TextArea rows={5} showCount maxLength={500} />
        </Form.Item>
        <Form.Item
          name="descriptionHtml"
          label="Description"
          extra="Add headings, emphasis, lists and web links. Formatting is saved with the event."
          rules={[
            {
              validator: (_rule, value: string | null | undefined) =>
                descriptionBytes(value) <= descriptionMaxBytes
                  ? Promise.resolve()
                  : Promise.reject(new Error('Keep the description within 100 KiB.')),
            },
          ]}
        >
          <DescriptionEditor disabled={pending} />
        </Form.Item>
        {gallery}
      </section>
      {saveDisabled && (
        <Typography.Paragraph type="secondary">
          Finish or cancel your gallery changes before saving the event.
        </Typography.Paragraph>
      )}
      <div className="venue-form-footer">
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="primary"
            htmlType="submit"
            disabled={saveDisabled}
            loading={pending}
            aria-label="Save event"
            aria-busy={pending}
          >
            Save event
          </Button>
        </Space>
      </div>
    </Form>
  );
}
