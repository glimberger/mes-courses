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
