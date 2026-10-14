import { MAX_CHANGES_PER_REQUEST } from '@mes-courses/sync-core';

/** JSON schemas of the request bodies (contracts/sync-api.md, auth-api.md). */
/** `PATCH /v1/devices/:id`; the use case enforces 1–60 characters after trimming. */
export const renameDeviceBodySchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: { name: { type: 'string', maxLength: 200 } },
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

/** The bound is generous: `normalizeEmail` decides what a valid address is (254 characters). */
export const inviteBodySchema = {
  type: 'object',
  required: ['email'],
  additionalProperties: false,
  properties: { email: { type: 'string', maxLength: 512 } },
} as const;

export const passwordResetBodySchema = inviteBodySchema;

/** Every password field is capped at 512 UTF-16 units (contracts/auth-api.md). */
const passwordSchema = { type: 'string', maxLength: 512 } as const;
const emailSchema = { type: 'string', maxLength: 512 } as const;
// The use case enforces 1–60 characters after trimming; this only bounds the payload.
const deviceNameSchema = { type: 'string', maxLength: 200 } as const;

export const signInBodySchema = {
  type: 'object',
  required: ['email', 'password', 'deviceName'],
  additionalProperties: false,
  properties: {
    email: emailSchema,
    password: passwordSchema,
    deviceName: deviceNameSchema,
  },
} as const;

export const choosePasswordBodySchema = {
  type: 'object',
  required: ['email', 'temporaryPassword', 'newPassword', 'deviceName'],
  additionalProperties: false,
  properties: {
    email: emailSchema,
    temporaryPassword: passwordSchema,
    newPassword: passwordSchema,
    deviceName: deviceNameSchema,
  },
} as const;
