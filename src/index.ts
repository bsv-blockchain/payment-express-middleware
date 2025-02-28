import { Request, Response, NextFunction } from 'express'
import { AtomicBEEF, createNonce, Utils, verifyNonce } from '@bsv/sdk'
import { BSVPayment, PaymentMiddlewareOptions, PaymentResult } from './types.js'

const PAYMENT_VERSION = '1.0'

/**
 * Creates middleware that enforces BSV payment for HTTP requests.
 *
 * NOTE: This middleware should run after the authentication middleware so that `req.auth` is available.
 *
 * @param options - Configuration for the payment middleware
 * @param options.wallet - A wallet instance capable of submitting direct transactions.
 * @param options.calculateRequestPrice - A function returning the price for the request in satoshis.
 *
 * @returns Express middleware that requires payment if `calculateRequestPrice` > 0.
 */
export function createPaymentMiddleware(options: PaymentMiddlewareOptions): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const {
    calculateRequestPrice = () => 100, // Default to 100 satoshis if no price calculator is provided
    wallet
  } = options

  if (typeof calculateRequestPrice !== 'function') {
    throw new Error('The calculateRequestPrice option must be a function.')
  }

  if (wallet === undefined || typeof wallet !== 'object') {
    throw new Error('A valid wallet instance must be supplied to the payment middleware.')
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth === undefined || typeof req.auth.identityKey !== 'string') {
      return res.status(500).json({
        status: 'error',
        code: 'ERR_SERVER_MISCONFIGURED',
        description: 'The payment middleware must be executed after the Auth middleware.'
      })
    }

    let requestPrice: number
    try {
      requestPrice = await calculateRequestPrice(req)
    } catch (err) {
      console.error(err)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_PAYMENT_INTERNAL',
        description: 'An internal error occurred while determining the payment required for this request.'
      })
    }

    // If no payment is required, proceed immediately.
    if (requestPrice === 0) {
      req.payment = { satoshisPaid: 0 }
      return next()
    }

    const bsvPaymentHeader = req.headers['x-bsv-payment']
    if (bsvPaymentHeader === undefined) {
      const derivationPrefix = await createNonce(wallet)
      return res.status(402)
        .set({
          'x-bsv-payment-version': PAYMENT_VERSION,
          'x-bsv-payment-satoshis-required': String(requestPrice),
          'x-bsv-payment-derivation-prefix': derivationPrefix
        })
        .json({
          status: 'error',
          code: 'ERR_PAYMENT_REQUIRED',
          satoshisRequired: requestPrice,
          description: 'A BSV payment is required to complete this request. Provide the X-BSV-Payment header.'
        })
    }

    let paymentData: BSVPayment
    try {
      paymentData = JSON.parse(String(bsvPaymentHeader))
      try {
        const valid = await verifyNonce(paymentData.derivationPrefix, wallet);
        if (!valid) {
          throw new Error('ERR_INVALID_DERIVATION_PREFIX');
        }
      } catch {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_DERIVATION_PREFIX',
          description: 'The X-BSV-Payment-Derivation-Prefix header is not valid.',
        })
      }
    } catch (err) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_MALFORMED_PAYMENT',
        description: 'The X-BSV-Payment header is not valid JSON.'
      })
    }

    try {
      const { accepted }: PaymentResult = await wallet.internalizeAction({
        tx: Utils.toArray(paymentData.transaction, 'base64') as AtomicBEEF,
        outputs: [{
          paymentRemittance: {
            derivationPrefix: paymentData.derivationPrefix,
            derivationSuffix: paymentData.derivationSuffix,
            senderIdentityKey: req.auth.identityKey
          },
          outputIndex: 0,
          protocol: 'wallet payment'
        }],
        description: 'Payment for request'
      })

      req.payment = {
        satoshisPaid: requestPrice,
        accepted,
        tx: paymentData.transaction
      }

      res.set({
        'x-bsv-payment-satoshis-paid': String(requestPrice)
      })

      next()
    } catch (err: any) {
      return res.status(400).json({
        status: 'error',
        code: err.code ?? 'ERR_PAYMENT_FAILED',
        description: err.message ?? 'Payment failed.'
      })
    }
  }
}
