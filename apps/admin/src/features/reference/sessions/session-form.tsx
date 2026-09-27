import { Alert, Button, Col, DatePicker, Form, Input, Row, Space, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import { speakersResource, type DataError } from '../../../data/data-provider.js';
import type {
  CreateReferenceSessionInput,
  ReferenceEventDetailsFragment,
  ReferenceSessionDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { RelationSelect } from '../relation-select.js';
import { useFieldErrors } from '../use-field-errors.js';
import { dayjs, eventInstant, eventTime } from '../events/event-time.js';

type Values = Omit<CreateReferenceSessionInput, 'startsAt' | 'endsAt'> & {
  startsAt: Dayjs;
  endsAt: Dayjs;
};
const fields = ['title', 'summary', 'startsAt', 'endsAt', 'room', 'speakerIds'] as const;
export function SessionForm({
  storeId,
  event,
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
  onChange,
}: {
  storeId: string;
  event: ReferenceEventDetailsFragment;
  initialValues: ReferenceSessionDetailsFragment | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateReferenceSessionInput) => void;
  onCancel: () => void;
  onChange: () => void;
}) {
  const [form] = Form.useForm<Values>();
  useFieldErrors(form, error, fields);
  function validTime(_rule: unknown, value: Dayjs | null | undefined): Promise<void> {
    if (!value) return Promise.resolve();
    try {
      const time = eventInstant(value);
      if (
        Date.parse(time) < Date.parse(event.startsAt) ||
        Date.parse(time) > Date.parse(event.endsAt)
      )
        throw new Error('Choose a time within the event.');
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error('Choose a valid date and time.'),
      );
    }
  }
  return (
    <Form<Values>
      form={form}
      layout="vertical"
      requiredMark="optional"
      disabled={pending}
      initialValues={
        initialValues
          ? {
              ...initialValues,
              startsAt: eventTime(initialValues.startsAt),
              endsAt: eventTime(initialValues.endsAt),
            }
          : { startsAt: eventTime(event.startsAt), speakerIds: [] }
      }
      onValuesChange={onChange}
      onFinish={(values) => {
        if (!pending)
          onSubmit({
            title: values.title.trim(),
            summary: values.summary?.trim() || null,
            room: values.room?.trim() || null,
            startsAt: eventInstant(values.startsAt),
            endsAt: eventInstant(values.endsAt),
            speakerIds: values.speakerIds ?? [],
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
      <Typography.Title level={4}>Session details</Typography.Title>
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
        <Input autoFocus />
      </Form.Item>
      <Form.Item
        name="summary"
        label="Summary"
        rules={[{ max: 2000, message: 'Use at most 2000 characters.' }]}
      >
        <Input.TextArea rows={4} showCount maxLength={2000} />
      </Form.Item>
      <Typography.Title level={4}>Schedule & speakers</Typography.Title>
      <Typography.Paragraph type="secondary">
        All times are in Europe/Sofia. Event:{' '}
        {eventTime(event.startsAt).format('DD MMM YYYY, HH:mm')} –{' '}
        {eventTime(event.endsAt).format('DD MMM YYYY, HH:mm')}.
      </Typography.Paragraph>
      <Row gutter={24}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="startsAt"
            label="Starts at"
            rules={[{ required: true, message: 'Choose a start time.' }, { validator: validTime }]}
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
              { required: true, message: 'Choose an end time.' },
              { validator: validTime },
              {
                validator: (_rule: unknown, value: Dayjs | undefined) => {
                  const start: unknown = form.getFieldValue('startsAt');
                  return value && dayjs.isDayjs(start) && eventInstant(value) <= eventInstant(start)
                    ? Promise.reject(new Error('End must be after start.'))
                    : Promise.resolve();
                },
              },
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
            name="room"
            label="Room"
            rules={[{ max: 120, message: 'Use at most 120 characters.' }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="speakerIds"
            label="Speakers"
            extra="Search the store's speaker directory."
            rules={[{ type: 'array', max: 100, message: 'Choose at most 100 speakers.' }]}
          >
            <RelationSelect resource={speakersResource(storeId)} multiple />
          </Form.Item>
        </Col>
      </Row>
      <div className="venue-form-footer">
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={pending}
            aria-label="Save session"
            aria-busy={pending}
          >
            Save session
          </Button>
        </Space>
      </div>
    </Form>
  );
}
