
# User Interactive Authentication

User Interactive Authentication is based on the Matrix.org Client-Server specification: [User Interactive Authentication API](https://spec.matrix.org/v1.11/client-server-api/#user-interactive-authentication-api).

## Usage Instructions

To use this method in functions that require user interactive authentication, follow these steps:

1. Use the `uiauthenticate` method similarly to the `authenticate` method for  `/register` and `/login` endpoints
2. For other endpoints that use UI-Authentication and that are authenticated (such as `/add` for example), you first need to call the `clientServer.authenticate` method, followed by `validateUserWithUiAuthentication`. The second method checks that the user associated to the given access token is indeed who he claims to be, it serves as additional security.
2. Do **not** call the `jsonContent` method from the utils package after `uiauthenticate` or `validateUserWithUiAuthentication` as it is already included within the `uiauthenticate` method. Duplicate calls will cause errors.

## Allowed Flows

For endpoints other than `/register` and `/login` (POST), the allowed flows are generated automatically inside the `validateUserWithUiAuthentication` method. For the `/register` and`/login`endpoints, they are stored in a constant defined before the expressAppHandler. These flows must be updated before production to avoid security risks, such as inadvertently allowing the client to authenticate with "m.login.dummy", and could also be calculated using a function that reads the config to check for supported flows.

## Callback Usage

For non-`/register` endpoints, the `uiauthenticate` method calls the callback method with the `userId` as the second argument. This allows access to the `userId` in endpoints requiring UIAuth.

## Testing

- If the `userId` is required, ensure the relevant data is in the database to recognize the user. For example, for "m.login.email.identity", populate the "user_threepids" table with the necessary data (client_secret, session_id, and address).

### Session IDs
In order to get a valid session ID for tests, you first need to call your endpoint without an `auth`field, and get the session ID from the response body. This session ID will then be used in all other calls to THE SAME endpoint while authentication has not been completed. Once completed, you need to generate a new session ID for future API calls using the same procedure. If the intended behaviour is that once a session is validated, you can use it for all following calls, then you need to change the insert call in the table `ui_auth_sessions_credentials` to a new function that executes the query `INSERT ... ON CONFLICT ... DO NOTHING`.
---

If you have any questions or need further assistance, refer to the [Matrix.org Client-Server API specification](https://spec.matrix.org/v1.11/client-server-api/#user-interactive-authentication-api).
