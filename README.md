# @bsv/payment-express-middleware

Accept **BSV micropayments** in your Express.js API by seamlessly integrating **402 Payment Required** flows with [BRC-103](https://github.com/bitcoin-sv/BRCs/blob/master/peer-to-peer/0103.md) and [BRC-104](https://github.com/bitcoin-sv/BRCs/blob/master/peer-to-peer/0104.md) mutual authentication. This middleware builds upon the **[Auth middleware](https://github.com/bitcoin-sv/auth-express-middleware)**—thus letting you identify and authenticate the payer before receiving BSV to monetize your services.

- **Monetize your APIs** via BSV micropayments.  
- Automatically handle `402 Payment Required` logic by providing the amount owed, plus a derivation prefix for the payer to build the transaction.  
- Integrates seamlessly **after** the BRC-103 Auth middleware to ensure the user’s identity is established.  
- Extensible **pricing** logic via a user-defined function.

## Table of Contents

1. [Background](#background)  
2. [Features](#features)  
3. [Installation](#installation)  
4. [Pre-requisites](#pre-requisites)  
5. [Quick Start](#quick-start)  
6. [Detailed Usage](#detailed-usage)  
   - [Creating the Payment Middleware](#creating-the-payment-middleware)  
   - [Installing the Payment Middleware in Express](#installing-the-payment-middleware-in-express)  
   - [Custom Pricing Logic](#custom-pricing-logic)  
   - [Detailed Flow](#detailed-flow)  
7. [API Reference](#api-reference)  
8. [Example Payment Flows](#example-payment-flows)  
   - [0 Satoshis (Free Request)](#0-satoshis-free-request)  
   - [Paid Request](#paid-request)  
9. [Security Considerations](#security-considerations)  
10. [Resources & References](#resources--references)  
11. [License](#license)

---

## Background

The [BRC-103 authentication framework](https://github.com/bitcoin-sv/BRCs/blob/master/peer-to-peer/0103.md) and its [BRC-104 HTTP transport extension](https://github.com/bitcoin-sv/BRCs/blob/master/peer-to-peer/0104.md) provide **mutual authentication** and **selective field disclosure**. Building on top of these, we can now **monetize** interactions by requiring micropayments for certain requests. By layering a **Payment Middleware** after the Auth middleware, your service can signal “402 Payment Required” to the client, prompting them to respond with a BSV transaction that **pays** for that request.

---

## Features

- **Simple 402 Payment Flows**: Easily return a `402` status if payment is required.  
- **Configurable Pricing**: Provide a `calculateRequestPrice` function to dynamically determine how many satoshis are owed for each request.  
- **Nonce-Based**: Uses a derivation prefix to ensure the final payment is bound to your session, preventing replay attacks.  
- **Auth Integration**: Leverages the user’s **identity key** from the preceding [Auth middleware](https://github.com/bitcoin-sv/auth-express-middleware) to track who is paying.  
- **Automatic Transaction Handling**: On the server side, calls your `wallet` instance’s `internalizeAction()` to process the transaction.

---

## Installation

```bash
npm i @bsv/payment-express-middleware
```

**Note**: You must also have `@bsv/auth-express-middleware` installed and set up **before** using this payment middleware.

---

## Pre-requisites

1. **BRC-103 / BRC-104–based Auth Middleware**  
   You must install and configure [`@bsv/auth-express-middleware`](https://npmjs.com/package/@bsv/auth-express-middleware) first. This ensures every request has a valid `req.auth.identityKey`.

2. **BSV Wallet**  
   A wallet capable of receiving, verifying, and broadcasting transactions. This middleware leverages the standard, bRC-100 `wallet.internalizeAction()` to handle submitting the payment transaction.  
   - This can be your own custom wallet logic that implements these interfaces.  
   - The wallet should also be able to verify that the `derivationPrefix` and `derivationSuffix` properly correspond to keys in the output script, as per BRC-29.
   - If you use the wallet implementation from `@bsv/sdk`, these details are handled automatically.

3. **Client with 402 Support**  
   On the client side, you need a user agent (e.g., [AuthFetch from `@bsv/sdk`](https://www.npmjs.com/package/@bsv/sdk), or a custom approach) that automatically responds to `402` challenges by constructing a BSV transaction to make the payment.

---

## Quick Start

Below is the minimal example integrating the payment middleware with the Auth middleware:

```ts
import express from 'express'
import bodyParser from 'body-parser'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import { Wallet } from '@your/bsv-wallet'

// 1. Create a BSV wallet that can manage transactions
const wallet = new Wallet({ /* config */ })

// 2. Create the Auth middleware (BRC-103/104)
const authMiddleware = createAuthMiddleware({ wallet })

// 3. Create the Payment middleware
const paymentMiddleware = createPaymentMiddleware({ 
  wallet,
  calculateRequestPrice: async (req) => {
    // e.g., 50 satoshis per request
    return 50
  }
})

const app = express()
app.use(bodyParser.json())

// 4. Place Auth middleware first, then Payment middleware
app.use(authMiddleware)
app.use(paymentMiddleware)

// 5. Define your routes as normal
app.post('/somePaidEndpoint', (req, res) => {
  // If we got here, the request is authenticated and the payment (if required) was accepted.
  res.json({ message: 'Payment received, request authorized', amount: req.payment.satoshisPaid })
})

app.listen(3000, () => {
  console.log('Payment-enabled server is listening on port 3000')
})
```

In this setup:
- `Auth middleware` ensures `req.auth` is set.  
- `Payment middleware` checks if payment is required (based on `calculateRequestPrice`). If yes, the client must supply a valid `x-bsv-payment` header with a BSV transaction referencing the **specified derivation prefix**. Otherwise, the middleware returns a `402 Payment Required` response, prompting the client to pay.

---

## Detailed Usage

### Creating the Payment Middleware

```ts
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'

const paymentMiddleware = createPaymentMiddleware({
  wallet: myWallet,
  calculateRequestPrice: (req) => {
    // Your logic to return satoshis required for this request
    return 100  // e.g. 100 satoshis
  }
})
```

**Options**:

- **`wallet`** (required): A wallet object that can process and broadcast BSV transactions. Must expose an `internalizeAction` method.  
- **`calculateRequestPrice`** (optional): A function `(req) => number | Promise<number>` that returns how many satoshis the request should cost. Defaults to `100`.

### Installing the Payment Middleware in Express

1. **Order**: Must run **after** the Auth middleware.  
2. **Usage**:
   ```ts
   app.use(authMiddleware)       // from @bsv/auth-express-middleware
   app.use(paymentMiddleware)    // from @bsv/payment-express-middleware
   ```

3. **Effects**:  
   - On each request, it first checks `req.auth.identityKey`. If undefined, returns an error (the Payment middleware requires you to be authenticated).  
   - Determines the price. If `0`, no payment is required—proceeds immediately.  
   - Otherwise, checks the `x-bsv-payment` header from the client.  
   - If the header is missing or invalid, responds with `402 Payment Required` along with the `x-bsv-payment-satoshis-required` and a **nonce** in `x-bsv-payment-derivation-prefix`.  
   - If the header is present, tries to finalize the transaction via `wallet.internalizeAction()`.  
   - On success, sets `req.payment` with the transaction details and calls `next()`.

### Custom Pricing Logic

You can define any logic for calculating the cost of each request, such as:

- A flat fee for all requests (`return 100`)  
- Per-endpoint pricing  
- Different costs based on request size or complexity  
- Free requests (return `0`) for certain routes or conditions  

```ts
const paymentMiddleware = createPaymentMiddleware({
  wallet,
  calculateRequestPrice: async (req) => {
    if (req.path === '/premium') return 500  // cost 500 satoshis
    return 0 // free for everything else
  }
})
```

### Detailed Flow

1. **Authenticated** request arrives.  
2. Payment middleware calls `calculateRequestPrice(req)`.  
3. If `price = 0`, continue.  
4. Else check `x-bsv-payment` header:  
   - If missing → respond with `402 Payment Required` + nonce (derivation prefix).  
   - If present → parse JSON, verify the nonce, call `wallet.internalizeAction()`.  
     - If successful, sets `req.payment.satoshisPaid = price`.  
     - Continue to your route handler.

---

## API Reference

### `createPaymentMiddleware(options: PaymentMiddlewareOptions)`

Returns an Express middleware function that:

1. Checks for `req.auth.identityKey`.  
2. Calculates the request’s price.  
3. Enforces payment via `x-bsv-payment` if `price > 0`.  
4. On success, attaches `req.payment = { satoshisPaid, accepted, tx }`.

**`PaymentMiddlewareOptions`**:

| Property                | Type                                 | Required | Description                                                                                                                                           |
|-------------------------|--------------------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `calculateRequestPrice` | `(req: Request) => number \| Promise<number>` | No       | Determines how many satoshis are needed to serve the request. Defaults to `100`.                                                                     |
| `wallet`               | `Wallet`                              | Yes      | A wallet instance with a `internalizeAction()` function to finalize the BSV transaction.                                                             |

#### `PaymentMiddleware`

Once invoked:

- If `price = 0`, sets `req.payment = { satoshisPaid: 0 }` and calls `next()`.  
- If `price > 0`, requires the `x-bsv-payment` header containing a valid BSV transaction (plus a derivation prefix & suffix).  
- If successful, sets `req.payment = { satoshisPaid: <price>, accepted: true, tx: <transactionData> }`.

---

## Example Payment Flows

### 0 Satoshis (Free Request)

```ts
const paymentMiddleware = createPaymentMiddleware({
  wallet,
  calculateRequestPrice: () => 0
})

app.use(authMiddleware)
app.use(paymentMiddleware)
// => All requests are free, effectively ignoring payment logic, but the pipeline remains consistent.
```

### Paid Request

```ts
const paymentMiddleware = createPaymentMiddleware({
  wallet,
  calculateRequestPrice: async (req) => {
    // Example: cost is 100 satoshis unless "POST" method, which costs 200
    return req.method === 'POST' ? 200 : 100
  }
})
```

When the client tries to call a route, the server may respond with:
```json
{
  "status": "error",
  "code": "ERR_PAYMENT_REQUIRED",
  "satoshisRequired": 200,
  "description": "A BSV payment is required to complete this request."
}
```
along with the header:
```
x-bsv-payment-satoshis-required: 200
x-bsv-payment-derivation-prefix: <random-nonce-base64>
```
The client then constructs a BSV transaction paying the appropriate amount to the server’s wallet, referencing the derivation prefix in the transaction metadata. Once complete, the client re-sends the request including:
```
"x-bsv-payment": JSON.stringify({
  derivationPrefix: <same-derivation-prefix>,
  derivationSuffix: <some-other-data>,
  transaction: <serialized-tx> 
})
```
If accepted, the request proceeds.

---

## Security Considerations

1. **Run *after* Auth**  
   This middleware relies on `req.auth.identityKey` from the preceding BRC-103 authentication. If you skip Auth, the identity is unknown, which can break the payment system.

2. **Nonce Handling**  
   Uses a `derivationPrefix` to ensure each payment is unique to the request context. The library verifies the prefix is bound to the server private key.  
   - You should ensure your wallet is robust to replay attacks, e.g., by only accepting each prefix once inside of `internalizeAction()`.
   - Don't accept the same transaction twice, even if it's still valid! Ensure your wallet throws an error if `internalizeAction()` is called with the same payment multiple times.

3. **Error Handling**  
   Non-compliant or missing `x-bsv-payment` data results in a `4xx` error (often `402 Payment Required` or `400 Bad Request`).

4. **Transaction Acceptance**  
   The final acceptance or rejection of a transaction is performed by your `wallet.internalizeAction()`. Ensure your wallet’s logic is secure and robust.

---

## Resources & References

- [BRC-103 Spec](https://github.com/bitcoin-sv/BRCs/blob/master/peer-to-peer/0103.md) – Mutual authentication & certificate exchange.  
- [BRC-104 Spec](https://github.com/bitcoin-sv/BRCs/blob/master/peer-to-peer/0104.md) – HTTP transport for BRC-103.  
- [@bsv/auth-express-middleware](https://npmjs.com/package/@bsv/auth-express-middleware) – The prerequisite middleware for authentication.  
- [BRC-29 key derivation protocol](https://github.com/bitcoin-sv/BRCs/blob/master/payments/0029.md) – The specification covering `derivationPrefix` and `derivationSuffix` as related to the exchange of BSV payments.  
- [402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) – The HTTP status code used to signal that payment is required.

---

## License

[Open BSV License](./LICENSE.txt)

---

**Happy Building!** If you have questions, run into issues, or want to contribute improvements, feel free to open issues or PRs in our repository.