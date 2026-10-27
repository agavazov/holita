import { encodeRuleRecord } from '@holita/edata-rules';
import type { DeviceConfigurationOperation } from '../../fleet/device-operations/device-configuration-types';
import { RuleDraftStore, draftRecord, type RuleDraft } from './rule-drafts';

const branchId = '20000000-0000-4000-8000-000000000001';
const baseline: DeviceConfigurationOperation = {
  id: '80000000-0000-4000-8000-000000000001',
  branchId,
  karmaCarId: '41',
  karmaDeviceId: 'opaque-device-41',
  kind: 'READ_CONFIGURATION',
  phase: 'READ_PARAMETERS',
  status: 'COMPLETE',
  requestedAt: '2026-10-20T10:00:00.000Z',
  dispatchedAt: null,
  completedAt: '2026-10-20T10:03:00.000Z',
  nextCheckAt: '2026-10-20T10:03:00.000Z',
  deadlineAt: '2026-10-20T10:15:00.000Z',
  errorCode: null,
  queueIds: [],
  observationCount: 1,
  coverageComplete: true,
  baselineOperationId: null,
  parameterBaselineOperationId: null,
  ruleId: null,
  ruleExpression: null,
  ruleTrueEventId: null,
  ruleFalseEventId: null,
  ruleDebounceMilliseconds: null,
  rulesConfiguration: null,
  parameterId: null,
  intervalSeconds: null,
  previousIntervalSeconds: null,
  catalogId: null,
  profileId: null,
  writeDispatchedAt: null,
  writeUncertain: false,
  configuration: {
    configurationId: '1001',
    parameters: [
      { parameterId: 65000, intervalSeconds: 30, definitionHex: 'FDE8' + 'AB'.repeat(18) + '001E' },
      { parameterId: 65001, intervalSeconds: 60, definitionHex: 'FDE9' + 'AB'.repeat(18) + '003C' },
    ],
  },
};

it('retires only a submitted revision confirmed by matching device readback and preserves later edits and local names across reload', () => {
  const tenant = crypto.randomUUID();
  const draft: RuleDraft = {
    id: 'draft-1',
    name: 'Reporting condition',
    ruleId: 7,
    expression: '[65000] > 10',
    trueEvent: 1001,
    falseEvent: 1002,
    debounce: 1000,
  };
  const definitionHex = encodeRuleRecord(draftRecord(draft));
  const submitted: DeviceConfigurationOperation = {
    ...baseline,
    id: 'write-1',
    kind: 'UPSERT_RULE',
    status: 'WAITING',
    configuration: null,
  };
  const confirmed: DeviceConfigurationOperation = {
    ...submitted,
    status: 'COMPLETE',
    rulesConfiguration: {
      configurationId: 'rules-1',
      rules: [
        {
          ruleId: 7,
          trueEventId: 1001,
          falseEventId: 1002,
          debounceMilliseconds: 1000,
          activateDashboard: false,
          definitionHex,
          expression: draft.expression,
          parameterIds: [65000],
        },
      ],
    },
  };
  const store = new RuleDraftStore();
  store.initialize(tenant, '41');
  store.save(draft);
  store.recordSubmission(draft, submitted, definitionHex);
  const unconfirmed = [
    { ...confirmed, branchId: 'another-branch' },
    { ...confirmed, karmaCarId: 'another-car' },
    { ...confirmed, karmaDeviceId: 'replacement' },
    { ...confirmed, status: 'UNKNOWN' as const },
    { ...confirmed, requestedAt: '2026-10-19T10:00:00.000Z' },
    { ...confirmed, rulesConfiguration: { configurationId: 'empty', rules: [] } },
  ];
  for (const snapshot of unconfirmed) {
    store.reconcile(snapshot);
    expect(store.rules()).toEqual([draft]);
  }
  const later = { ...draft, name: 'Later local name', expression: '[65000] > 20' };
  store.save(later);
  const reloaded = new RuleDraftStore();
  reloaded.initialize(tenant, '41');
  reloaded.reconcile(confirmed);
  expect(reloaded.rules()).toEqual([later]);
  expect(reloaded.confirmedName(confirmed, 7)).toBe(draft.name);
  reloaded.recordSubmission(
    later,
    { ...submitted, id: 'write-2' },
    encodeRuleRecord(draftRecord(later)),
  );
  reloaded.reconcile({
    ...confirmed,
    id: 'read-after-uncertainty',
    kind: 'READ_RULES',
    requestedAt: '2026-10-20T11:00:00.000Z',
    rulesConfiguration: {
      configurationId: 'rules-2',
      rules: [
        {
          ruleId: 7,
          trueEventId: 1001,
          falseEventId: 1002,
          debounceMilliseconds: 1000,
          activateDashboard: false,
          definitionHex: encodeRuleRecord(draftRecord(later)),
          expression: later.expression,
          parameterIds: [65000],
        },
      ],
    },
  });
  const final = new RuleDraftStore();
  final.initialize(tenant, '41');
  expect(final.rules()).toEqual([]);
  expect(final.confirmedName(confirmed, 7)).toBe(later.name);
  expect(final.confirmedName({ ...confirmed, karmaDeviceId: 'replacement' }, 7)).toBeUndefined();
  localStorage.removeItem(`holita.rules.v1:${tenant}:41`);
});
