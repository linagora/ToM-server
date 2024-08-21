# User Interactive Authentication

User Interactive Authentication is based on the Matrix.org Client-Server specification: [User Interactive Authentication API](https://spec.matrix.org/v1.11/client-server-api/#user-interactive-authentication-api).

## Usage Instructions

To use this method in functions that require user interactive authentication, follow these steps:

1. Use the `uiauthenticate` method similarly to the `authenticate` method for `/register`
2. For other endpoints that use UI-Authentication and that are authenticated (such as `/add` for example), you first need to call the `clientServer.authenticate` method, followed by `validateUserWithUiAuthentication`. The second method checks that the user associated to the given access token is indeed who he claims to be, it serves as additional security.
3. Since we insert the request body in the `clientdict` column of the `ui_auth_sessions` table, we need to verify its content. For that we check type validity and that the strings are not too long (don't exceed 512 characters) before calling the `uiauthenticate` or the `validateUserWithUIAuth` methods.

## Allowed Flows

For endpoints other than `/register`, the allowed flows are generated automatically inside the `validateUserWithUiAuthentication` method. If you call `uiauthenticate` (cf account/password/index.ts) then you need to specifiy the allowed flows as argument to the function.
 For the `/register` endpoint, they are generated using the config with a function defined in utils/userInteractiveAuthentication.

## Callback Usage

For non-`/register` endpoints, the `uiauthenticate` method calls the callback method with the `userId` as the second argument. This allows access to the `userId` in endpoints requiring UIAuth. 

## Auth key 

As things are now, an endpoint that uses UI Authentication requires the client to send the data in the call that will validate authentication. For example, in account/password/index.ts, it is expected that the client sends a password on the call to the endpoint that corresponds to the last stage of the flow it has chosen. Meaning if the client sends a password in a previous request, it should resend it in further requests to ensure the server receives the data, and shouldn't assume sending it only once suffices. This behaviour might be undesirable and could be changed by storing relevant data and then deleting them when we're done with them (since we already store `clientdict` in the `ui_auth_sessions` table we could exploit this for example).

## Testing

- If the `userId` is required, ensure the relevant data is in the database to recognize the user. For example, for "m.login.email.identity", populate the "user_threepids" table with the necessary data (client_secret, session_id, and address).

### Session IDs

## In order to get a valid session ID for tests, you first need to call your endpoint without an `auth`field, and get the session ID from the response body. This session ID will then be used in all other calls to THE SAME endpoint while authentication has not been completed. Once completed, you need to generate a new session ID for future API calls using the same procedure. If the intended behaviour is that once a session is validated, you can use it for all following calls, then you need to change the insert call in the table `ui_auth_sessions_credentials` to a new function that executes the query `INSERT ... ON CONFLICT ... DO NOTHING`.

If you have any questions or need further assistance, refer to the [Matrix.org Client-Server API specification](https://spec.matrix.org/v1.11/client-server-api/#user-interactive-authentication-api).
