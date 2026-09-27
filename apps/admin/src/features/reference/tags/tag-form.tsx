import { Alert, Button, Col, ColorPicker, Form, Input, Row, Space, Switch, Typography } from 'antd';
import type { DataError } from '../../../data/data-provider.js';
import type { CreateReferenceTagInput } from '../../../generated/graphql/operations.js';
import { useFieldErrors } from '../use-field-errors.js';

type Props = {
  initialValues?: CreateReferenceTagInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateReferenceTagInput) => void;
  onCancel: () => void;
  onChange: () => void;
};
const fieldNames = ['name', 'color', 'active'] as const;
export function TagForm({ initialValues, pending, error, onSubmit, onCancel, onChange }: Props) {
  const [form] = Form.useForm<CreateReferenceTagInput>();
  useFieldErrors(form, error, fieldNames);
  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark="optional"
      disabled={pending}
      initialValues={initialValues ?? { name: '', color: '#315ed0', active: true }}
      onValuesChange={onChange}
      scrollToFirstError={{ focus: true }}
      onFinish={(values: CreateReferenceTagInput) => {
        if (!pending)
          onSubmit({
            name: values.name.trim(),
            color: values.color,
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
      <Typography.Title level={4}>Tag details</Typography.Title>
      <Typography.Paragraph type="secondary">
        Use a short name and a distinct color for each event label.
      </Typography.Paragraph>
      <Row gutter={24}>
        <Col xs={24} sm={16}>
          <Form.Item
            name="name"
            label="Name"
            rules={[
              {
                required: true,
                whitespace: true,
                max: 100,
                message: 'Enter a name of up to 100 characters.',
              },
            ]}
          >
            <Input autoFocus autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            name="color"
            label="Color"
            getValueFromEvent={(_color: unknown, hex: string) => hex}
            rules={[
              { required: true },
              { pattern: /^#[0-9a-f]{6}$/i, message: 'Choose a solid color.' },
            ]}
          >
            <ColorPicker disabledAlpha format="hex" showText />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="active"
        label="Active"
        valuePropName="checked"
        extra="Inactive tags stay on existing events but cannot be newly assigned."
      >
        <Switch />
      </Form.Item>
      <div className="venue-form-footer">
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={pending} aria-label="Save tag">
            Save tag
          </Button>
        </Space>
      </div>
    </Form>
  );
}
