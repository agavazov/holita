import { Alert, Button, Form, Input, Select, Space } from 'antd';

import type { DataError } from '../../data/data-provider.js';
import type { CreateProductInput } from '../../generated/graphql/operations.js';

type ProductFormProps = {
  initialValues?: CreateProductInput | undefined;
  pending: boolean;
  error: DataError | null;
  onSubmit: (values: CreateProductInput) => void;
  onCancel: () => void;
};

function supportedCharacters(_rule: unknown, value: string | undefined): Promise<void> {
  return value?.includes('\u0000')
    ? Promise.reject(new Error('Remove unsupported characters.'))
    : Promise.resolve();
}

export function ProductForm({
  initialValues,
  pending,
  error,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  return (
    <Form<CreateProductInput>
      layout="vertical"
      initialValues={initialValues ?? { name: '', sku: '', status: 'DRAFT' }}
      disabled={pending}
      onFinish={(values) => {
        if (!pending)
          onSubmit({
            name: values.name.trim(),
            sku: values.sku.trim(),
            status: values.status ?? 'DRAFT',
          });
      }}
      requiredMark="optional"
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
      <Form.Item
        name="name"
        label="Name"
        rules={[
          { required: true, whitespace: true, message: 'Enter a product name.' },
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
        name="sku"
        label="SKU"
        extra="Case-sensitive. Must be unique within this store."
        rules={[
          { required: true, whitespace: true, message: 'Enter a SKU.' },
          { validator: supportedCharacters },
          {
            max: 100,
            transform: (value: string) => value.trim(),
            message: 'Use at most 100 characters.',
          },
        ]}
      >
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="status" label="Status" rules={[{ required: true }]}>
        <Select
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'ACTIVE', label: 'Active' },
          ]}
        />
      </Form.Item>
      <Space>
        <Button
          type="primary"
          htmlType="submit"
          aria-label="Save product"
          aria-busy={pending}
          loading={pending}
        >
          Save product
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </Space>
    </Form>
  );
}
