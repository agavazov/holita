import { Alert, Button, Col, Form, Input, Row, Space, Switch, Typography } from 'antd';
import type { DataError } from '../../../data/data-provider.js';
import type { CreateReferenceSpeakerInput } from '../../../generated/graphql/operations.js';
import { useFieldErrors } from '../use-field-errors.js';

type Props = {
  initialValues?: CreateReferenceSpeakerInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateReferenceSpeakerInput) => void;
  onCancel: () => void;
  onChange: () => void;
};
const fieldNames = ['name', 'email', 'shortBio', 'active'] as const;
export function SpeakerForm({
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
  onChange,
}: Props) {
  const [form] = Form.useForm<CreateReferenceSpeakerInput>();
  useFieldErrors(form, error, fieldNames);
  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark="optional"
      disabled={pending}
      initialValues={initialValues ?? { name: '', active: true }}
      onValuesChange={onChange}
      scrollToFirstError={{ focus: true }}
      onFinish={(values: CreateReferenceSpeakerInput) => {
        if (!pending)
          onSubmit({
            name: values.name.trim(),
            email: values.email?.trim() || null,
            shortBio: values.shortBio?.trim() || null,
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
      <Typography.Title level={4}>Speaker details</Typography.Title>
      <Typography.Paragraph type="secondary">
        Keep a reusable directory of people for your event program.
      </Typography.Paragraph>
      <Row gutter={24}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="name"
            label="Name"
            rules={[
              {
                required: true,
                whitespace: true,
                max: 200,
                message: 'Enter a name of up to 200 characters.',
              },
            ]}
          >
            <Input autoFocus autoComplete="name" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', max: 254, message: 'Enter a valid email address.' }]}
          >
            <Input autoComplete="email" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="shortBio"
        label="Short biography"
        rules={[{ max: 2000, message: 'Use at most 2000 characters.' }]}
      >
        <Input.TextArea rows={5} showCount maxLength={2000} />
      </Form.Item>
      <Form.Item
        name="active"
        label="Active"
        valuePropName="checked"
        extra="Inactive speakers remain in your directory."
      >
        <Switch />
      </Form.Item>
      <div className="venue-form-footer">
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={pending} aria-label="Save speaker">
            Save speaker
          </Button>
        </Space>
      </div>
    </Form>
  );
}
