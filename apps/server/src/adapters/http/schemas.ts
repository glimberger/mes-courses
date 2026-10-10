import { MAX_CHANGES_PER_REQUEST } from '@mes-courses/sync-core';

/** JSON schemas of the request bodies (contracts/sync-api.md). */
export const claimBodySchema = {
  type: 'object',
  required: ['code', 'deviceName'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1, maxLength: 32 },
    // The use case enforces 1–60 characters after trimming; this only bounds the payload.
    deviceName: { type: 'string', maxLength: 200 },
  },
} as const;

/** `POST /v1/pairing-codes` takes no input; a body, if sent, is ignored. */
export const pairingCodesBodySchema = {
  type: ['object', 'null'],
} as const;

const hlcSchema = {
  type: 'object',
  required: ['wallMs', 'counter', 'deviceId'],
  additionalProperties: false,
  properties: {
    wallMs: { type: 'integer', minimum: 0 },
    counter: { type: 'integer', minimum: 0 },
    deviceId: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

const idSchema = { type: 'string', minLength: 1, maxLength: 200 } as const;
const nameSchema = { type: 'string', minLength: 1, maxLength: 200 } as const;

const changeSchema = (kind: string, fields: object) =>
  ({
    type: 'object',
    required: ['changeId', 'hlc', 'kind', 'id', 'fields'],
    additionalProperties: false,
    properties: {
      changeId: idSchema,
      hlc: hlcSchema,
      kind: { const: kind },
      id: idSchema,
      fields,
    },
  }) as const;

const fieldsSchema = (properties: object) =>
  ({ type: 'object', additionalProperties: false, properties }) as const;

/** `POST /v1/sync` (contracts/sync-api.md): up to 500 changes, each typed by its kind. */
export const syncBodySchema = {
  type: 'object',
  required: ['lastSeq', 'hlc', 'changes'],
  additionalProperties: false,
  properties: {
    lastSeq: { type: 'integer', minimum: 0 },
    hlc: hlcSchema,
    changes: {
      type: 'array',
      maxItems: MAX_CHANGES_PER_REQUEST,
      items: {
        oneOf: [
          changeSchema(
            'category',
            fieldsSchema({
              name: nameSchema,
              position: { type: 'integer', minimum: 0 },
            }),
          ),
          changeSchema(
            'article',
            fieldsSchema({
              name: nameSchema,
              categoryId: idSchema,
              deleted: { const: true },
            }),
          ),
          changeSchema('list', fieldsSchema({ name: nameSchema })),
          changeSchema(
            'listItem',
            fieldsSchema({
              listId: idSchema,
              articleId: idSchema,
              present: { type: 'boolean' },
              inCart: { type: 'boolean' },
              quantity: {
                oneOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    required: ['amount', 'unit'],
                    additionalProperties: false,
                    properties: {
                      amount: { type: 'number' },
                      unit: { type: ['string', 'null'], maxLength: 50 },
                    },
                  },
                ],
              },
            }),
          ),
        ],
      },
    },
  },
} as const;
