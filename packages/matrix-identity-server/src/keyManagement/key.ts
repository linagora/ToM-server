import { generateKeyPair as generateEd25519KeyPair, randomBytes } from 'crypto';

// Function to generate KeyId
function generateKeyId(algorithm: string, identifier: string): string {
  return `${algorithm}:${identifier}`;
}

// Function to generate key pair and KeyId
const generateKeyPair = async () : Promise<{ publicKey: string, privateKey: string, keyId: string }> => {
  return await new Promise((resolve, reject) => {
    // Generate an Ed25519 key pair
    generateEd25519KeyPair('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    }, (err, publicKey, privateKey) => {
      if (err != null) {
        reject(err)
        return
      }

      // Generate a unique identifier for the KeyId
      const identifier = randomBytes(8).toString('hex');
      const algorithm = 'ed25519';
      const keyId = generateKeyId(algorithm, identifier);

      resolve({ publicKey, privateKey, keyId });
    });
  });
}

// Usage example
generateKeyPair().then(({ publicKey, privateKey, keyId }) => {
  console.log('Public Key:', publicKey);
  console.log('Private Key:', privateKey);
  console.log('KeyId:', keyId);
}).catch(err => {
  console.error('Error generating key pair:', err);
});
