import { Alert, Button, Col, Form, Input, InputNumber, Row, Space, Switch, Typography } from 'antd';
import { useCallback } from 'react';
import { useFieldErrors } from '../use-field-errors.js';
import type { DataError } from '../../../data/data-provider.js';
import type { CreateReferenceVenueInput } from '../../../generated/graphql/operations.js';

type VenueFormProps = {
  initialValues?: CreateReferenceVenueInput | undefined;
  pending: boolean;
  error: DataError | null;
  tab: string;
  onTabChange: (tab: string) => void;
  onSubmit: (values: CreateReferenceVenueInput) => void;
  onCancel: () => void;
  onChange?: () => void;
};

function supportedCharacters(_rule: unknown, value: string | undefined): Promise<void> {
  return value?.includes('\u0000')
    ? Promise.reject(new Error('Remove unsupported characters.'))
    : Promise.resolve();
}

const fieldNames = [
  'name',
  'description',
  'city',
  'countryCode',
  'address',
  'capacity',
  'active',
] as const;
export function VenueForm({
  initialValues,
  pending,
  error,
  tab,
  onTabChange,
  onSubmit,
  onCancel,
  onChange,
}: VenueFormProps) {
  const [form] = Form.useForm<CreateReferenceVenueInput>();
  const openField = useCallback(
    (name: string) => {
      onTabChange(['city', 'countryCode', 'address'].includes(name) ? 'location' : 'general');
    },
    [onTabChange],
  );
  useFieldErrors(form, error, fieldNames, openField);
  return (
    <Form<CreateReferenceVenueInput>
      form={form}
      onValuesChange={onChange}
      layout="vertical"
      initialValues={initialValues ?? { name: '', city: '', countryCode: 'BG', active: true }}
      disabled={pending}
      requiredMark="optional"
      onFinishFailed={({ errorFields }) => {
        const field = errorFields[0]?.name[0];
        onTabChange(
          field === 'city' || field === 'countryCode' || field === 'address'
            ? 'location'
            : 'general',
        );
      }}
      onFinish={(values) => {
        if (!pending)
          onSubmit({
            name: values.name.trim(),
            city: values.city.trim(),
            countryCode: values.countryCode.trim().toUpperCase(),
            description: values.description?.trim() || null,
            address: values.address?.trim() || null,
            capacity: values.capacity ?? null,
            active: values.active ?? true,
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
        <Typography.Title level={4}>General</Typography.Title>
        <Typography.Paragraph type="secondary">
          A name, a short description and the venue's capacity.
        </Typography.Paragraph>
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, whitespace: true, message: 'Enter a venue name.' },
            { validator: supportedCharacters },
            {
              max: 200,
              transform: (value: string) => value.trim(),
              message: 'Use at most 200 characters.',
            },
          ]}
        >
          <Input autoFocus autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description"
          rules={[
            {
              max: 2000,
              transform: (value: string | undefined) => value?.trim(),
              message: 'Use at most 2000 characters.',
            },
            { validator: supportedCharacters },
          ]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>
        <Row gutter={24}>
          <Col xs={24} sm={12}>
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
          <Col xs={24} sm={12}>
            <Form.Item
              name="active"
              label="Active"
              valuePropName="checked"
              extra="Keep inactive venues for reference."
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </section>
      <section hidden={tab !== 'location'} aria-label="Location">
        <Typography.Title level={4}>Location</Typography.Title>
        <Typography.Paragraph type="secondary">
          Where people will find this venue.
        </Typography.Paragraph>
        <Row gutter={24}>
          <Col xs={24} sm={16}>
            <Form.Item
              name="city"
              label="City"
              rules={[
                { required: true, whitespace: true, message: 'Enter a city.' },
                { validator: supportedCharacters },
                {
                  max: 120,
                  transform: (value: string) => value.trim(),
                  message: 'Use at most 120 characters.',
                },
              ]}
            >
              <Input autoComplete="address-level2" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="countryCode"
              label="Country code"
              extra="Two letters, e.g. BG."
              rules={[
                { required: true, message: 'Enter a country code.' },
                {
                  pattern: /^[a-z]{2}$/i,
                  transform: (value: string) => value.trim(),
                  message: 'Use a two-letter country code.',
                },
              ]}
            >
              <Input autoComplete="country" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="address"
          label="Address"
          rules={[
            {
              max: 300,
              transform: (value: string | undefined) => value?.trim(),
              message: 'Use at most 300 characters.',
            },
            { validator: supportedCharacters },
          ]}
        >
          <Input autoComplete="street-address" />
        </Form.Item>
      </section>
      <div className="venue-form-footer">
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="primary"
            htmlType="submit"
            aria-label="Save venue"
            aria-busy={pending}
            loading={pending}
          >
            Save venue
          </Button>
        </Space>
      </div>
    </Form>
  );
}
