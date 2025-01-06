# API

Links: [API](#api), [Interfaces](#interfaces), [Functions](#functions)

## Interfaces

| |
| --- |
| [BSVPayment](#interface-bsvpayment) |
| [PaymentMiddlewareOptions](#interface-paymentmiddlewareoptions) |
| [PaymentResult](#interface-paymentresult) |

Links: [API](#api), [Interfaces](#interfaces), [Functions](#functions)

---

### Interface: BSVPayment

```ts
export interface BSVPayment {
    derivationPrefix: string;
    derivationSuffix: string;
    transaction: unknown;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Functions](#functions)

---
### Interface: PaymentMiddlewareOptions

```ts
export interface PaymentMiddlewareOptions {
    calculateRequestPrice?: (req: Request) => number | Promise<number>;
    wallet: Wallet;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Functions](#functions)

---
### Interface: PaymentResult

```ts
export interface PaymentResult {
    accepted: boolean;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Functions](#functions)

---
## Functions

### Function: createPaymentMiddleware

Creates middleware that enforces BSV payment for HTTP requests.

NOTE: This middleware should run after the authentication middleware so that `req.auth` is available.

```ts
export function createPaymentMiddleware(options: PaymentMiddlewareOptions) 
```

See also: [PaymentMiddlewareOptions](#interface-paymentmiddlewareoptions)

<details>

<summary>Function createPaymentMiddleware Details</summary>

Returns

Express middleware that requires payment if `calculateRequestPrice` > 0.

Argument Details

+ **options**
  + Configuration for the payment middleware
+ **options.wallet**
  + A wallet instance capable of submitting direct transactions.
+ **options.calculateRequestPrice**
  + A function returning the price for the request in satoshis.

</details>

Links: [API](#api), [Interfaces](#interfaces), [Functions](#functions)

---
