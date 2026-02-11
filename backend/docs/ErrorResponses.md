# Error responses (ProblemDetails)

All error responses are returned as `application/problem+json` and include `traceId` plus `correlationId` when available.

## 400 - Validation error
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Validation failed",
  "status": 400,
  "detail": "Validation failed.",
  "errors": {
    "email": [
      "'email' is required."
    ]
  },
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
  "correlationId": "b3a2dbd7-4a4e-4b0e-9b41-1cd9c4c2f7c1"
}
```

## 404 - Not found
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Resource not found",
  "status": 404,
  "detail": "Resource was not found.",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
  "correlationId": "b3a2dbd7-4a4e-4b0e-9b41-1cd9c4c2f7c1"
}
```

## 409 - Conflict
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "Conflict",
  "status": 409,
  "detail": "A conflict occurred.",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
  "correlationId": "b3a2dbd7-4a4e-4b0e-9b41-1cd9c4c2f7c1"
}
```

## 500 - Internal server error
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
  "title": "Unexpected error",
  "status": 500,
  "detail": "An unexpected error occurred.",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
  "correlationId": "b3a2dbd7-4a4e-4b0e-9b41-1cd9c4c2f7c1"
}
```
