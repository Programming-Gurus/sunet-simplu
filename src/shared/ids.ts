// The form of an id in a project file and in the app settings.

const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}
