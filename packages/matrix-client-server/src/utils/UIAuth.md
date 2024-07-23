
# User Interactive Authentication

User Interactive Authentication is based on the Matrix.org Client-Server specification: [User Interactive Authentication API](https://spec.matrix.org/v1.11/client-server-api/#user-interactive-authentication-api).

## Usage Instructions

To use this method in functions that require user interactive authentication, follow these steps:

1. Use the `uiauthenticate` method similarly to the `authenticate` method.
2. Do **not** call the `jsonContent` method from the utils package after `uiauthenticate` as it is already included within the `uiauthenticate` method. Duplicate calls will cause errors.

## Allowed Flows

For endpoints other than `/register`, the allowed flows are stored in the `allowedFlows` constant. For the `/register` endpoint, they are stored in `registerAllowedFlows`. These flows must be updated before production to avoid security risks, such as inadvertently allowing the client to authenticate with "m.login.dummy".

## Callback Usage

For non-`/register` endpoints, the `uiauthenticate` method calls the callback method with the `userId` as the second argument. This allows access to the `userId` in endpoints requiring UIAuth.

## Testing

- If your endpoint does not require the `userId`, you can bypass authentication using "m.login.dummy".
- If the `userId` is required, ensure the relevant data is in the database to recognize the user. For example, for "m.login.email.identity", populate the "user_threepids" table with the necessary data (client_secret, session_id, and address).

### Example for Successive Calls

When authenticating in two successive calls, use different values for the `session` field of the auth object if you use the same authentication type.

#### Test 1
```json
{
  "auth": {
    "type": "m.login.email.identity",
    "session": "session1",
    "threepid_creds": {
      // ...
    }
  }
}
```

#### Test 2
Use either:
```json
{
  "auth": {
    "type": "m.login.email.identity",
    "session": "session2",
    "threepid_creds": {
      // ...
    }
  }
}
```
or:
```json
{
  "auth": {
    "type": "m.login.msisdn",
    "session": "session1",
    "threepid_creds": {
      // ...
    }
  }
}
```

If `test2` uses `session1`, authentication will fail. (Note: The specification is unclear on this point, so this behavior is subject to change).

---

If you have any questions or need further assistance, refer to the [Matrix.org Client-Server API specification](https://spec.matrix.org/v1.11/client-server-api/#user-interactive-authentication-api).
