import { GraphQLError } from 'graphql';

const header = ['name', 'sku', 'price'];
const rowLimit = 100;
const byteLimit = 256 * 1024;

export interface CatalogueCsvRow {
  rowNumber: number;
  columns: string[];
}

function inputError(path: 'csv' | 'fileName', code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function invalidCsv() {
  return inputError('csv', 'INVALID_CSV', 'The file is not valid CSV');
}

export function catalogueFileName(value: string): string {
  const fileName = value.trim();
  if (!fileName || Array.from(fileName).length > 255 || fileName.includes('\u0000')) {
    throw inputError(
      'fileName',
      'INVALID_FILE_NAME',
      'The file name must contain 1 to 255 characters',
    );
  }
  return fileName;
}

export function parseCatalogueCsv(csv: string): CatalogueCsvRow[] {
  if (Buffer.byteLength(csv, 'utf8') > byteLimit) {
    throw inputError('csv', 'FILE_TOO_LARGE', 'Choose a CSV file no larger than 256 KiB');
  }
  if (csv.includes('\u0000')) {
    throw invalidCsv();
  }

  const source = csv.replace(/^\uFEFF/u, '');
  const records: CatalogueCsvRow[] = [];
  let line = 1;
  let rowNumber = 1;
  let columns: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  const finishRow = () => {
    const value = field.trim();
    if (rowNumber === 1 || columns.length || value || closedQuote) {
      columns.push(value);
      records.push({ rowNumber, columns });
    }
    if (records.length > rowLimit + 1) {
      throw inputError('csv', 'TOO_MANY_ROWS', 'The CSV can contain up to 100 data rows');
    }
    columns = [];
    field = '';
    closedQuote = false;
    rowNumber = ++line;
  };

  for (let offset = 0; offset < source.length; offset++) {
    const character = source.charAt(offset);
    const next = source.charAt(offset + 1);
    if (quoted) {
      if (character === '"') {
        if (next === '"') {
          field += '"';
          offset++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
        if (character === '\n') {
          line++;
        }
      }
    } else if (character === ',') {
      columns.push(field.trim());
      field = '';
      closedQuote = false;
    } else if (character === '\n' || (character === '\r' && next === '\n')) {
      if (character === '\r') {
        offset++;
      }
      finishRow();
    } else if (closedQuote || character === '\r') {
      throw invalidCsv();
    } else if (character === '"') {
      if (field !== '') {
        throw invalidCsv();
      }
      quoted = true;
    } else {
      field += character;
    }
  }
  if (quoted) {
    throw invalidCsv();
  }
  if (columns.length || field || closedQuote) {
    finishRow();
  }

  const [first, ...rows] = records;
  if (
    !first ||
    first.columns.length !== header.length ||
    header.some((name, i) => first.columns[i] !== name)
  ) {
    throw inputError('csv', 'INVALID_HEADER', 'Use the CSV header name,sku,price');
  }
  if (!rows.length) {
    throw inputError('csv', 'EMPTY_FILE', 'Add at least one data row to the CSV');
  }
  return rows;
}
