/**
 * Safe error extraction utilities to normalize API error responses.
 * Prevents React 19 runtime exception:
 * 'Objects are not valid as a React child (found: object with keys {code, message})'
 */

export function extractErrorMessage(
  err: unknown,
  fallback = "An unexpected error occurred. Please try again."
): string {
  if (!err) return fallback;

  // 1. If error is already a string
  if (typeof err === "string") {
    return err.trim().length > 0 ? err : fallback;
  }

  const anyErr = err as any;

  // 2. If Axios error with response data
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr;
  const detail = data?.detail !== undefined ? data.detail : data;

  // 3. String detail
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }

  // 4. Object detail
  if (detail && typeof detail === "object") {
    // If detail.message is a non-empty string
    if (typeof detail.message === "string" && detail.message.trim().length > 0) {
      return detail.message;
    }

    // If detail.field_errors exists, join first few field errors
    if (detail.field_errors && typeof detail.field_errors === "object") {
      const fieldMsgs = Object.values(detail.field_errors).filter(
        (v) => typeof v === "string" && (v as string).trim().length > 0
      );
      if (fieldMsgs.length > 0) {
        return (fieldMsgs as string[]).join(", ");
      }
    }

    // If detail is an array (FastAPI 422 pydantic validation errors)
    if (Array.isArray(detail)) {
      const items = detail
        .map((d: any) => {
          if (typeof d === "string") return d;
          if (typeof d?.msg === "string") return d.msg;
          if (typeof d?.message === "string") return d.message;
          return null;
        })
        .filter(Boolean);
      if (items.length > 0) {
        return items.join(", ");
      }
    }

    // If detail.code is present
    if (typeof detail.code === "string" && detail.code.trim().length > 0) {
      return detail.code;
    }
  }

  // 5. Check data.message
  if (typeof data?.message === "string" && data.message.trim().length > 0) {
    return data.message;
  }

  // 6. Check err.message (Standard JS Error)
  if (typeof anyErr?.message === "string" && anyErr.message.trim().length > 0) {
    if (
      anyErr.message !== "Request failed with status code 400" &&
      anyErr.message !== "Request failed with status code 401" &&
      anyErr.message !== "Request failed with status code 422" &&
      anyErr.message !== "Request failed with status code 500"
    ) {
      return anyErr.message;
    }
  }

  return fallback;
}

export function extractFieldErrors(err: unknown): Record<string, string> {
  const anyErr = err as any;
  const data = anyErr?.response?.data ?? anyErr?.data;
  if (!data) return {};

  if (data.field_errors && typeof data.field_errors === "object") {
    return data.field_errors;
  }
  if (data.detail && typeof data.detail === "object" && data.detail.field_errors) {
    return data.detail.field_errors;
  }
  if (Array.isArray(data.detail)) {
    const fieldErrs: Record<string, string> = {};
    for (const item of data.detail) {
      if (Array.isArray(item?.loc) && item?.msg) {
        const field = item.loc[item.loc.length - 1];
        if (field && typeof field === "string") {
          fieldErrs[field] = item.msg;
        }
      }
    }
    return fieldErrs;
  }
  return {};
}
