# @twake/matrix-identity-server

This folder contains all necessary components for managing keys within the `@twake/matrix-identity-server` project. The keys are primarily used for signing JSON objects as per the [Matrix Identity Service API](https://spec.matrix.org/v1.6/identity-service-api/) specifications.

## Overview

The Key Management system is designed to securely store, retrieve, and handle cryptographic keys used throughout the identity server. It ensures that keys are managed according to best practices for security and efficiency.

## Structure

Keys are stored in the table of the MatrixIdentityServer.db database :
    - Long term keys (current and previous) are stored in the 'longTermKeypairs' table
    - Ephemeral keys are stored in the 'shortTermKeypairs' table

Each set of key is composed of a keyId, the publicKey and its private one.

## Getting Started

To get started with the Key Management system :

1. **Generate Keys**: Ephemeral keys are generated (created) using the methods of the MatrixIdentityServer.db class which itself used the @twake/crypto fonctionnalities
Updating long term key pairs is also done by MatrixIdentityServer.db

2. **Storage**: One created, keys are automatically stored in the MatrixIdentityServer.db database to ensure no key is lost


## Security Practices

- Regularly rotate keys to mitigate the risk of key compromise.
- Follow the [Matrix Identity Service API](https://spec.matrix.org/v1.6/identity-service-api/) guidelines for key usage and handling.


## License

This Key Management system is part of the `@twake/matrix-identity-server` project and is subject to the same license terms.

For more information on contributing or licensing, please refer to the main project documentation.