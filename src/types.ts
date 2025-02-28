import { WalletInterface } from '@bsv/sdk'

export interface PaymentMiddlewareOptions {
  calculateRequestPrice?: (req: Request) => number | Promise<number>
  wallet: WalletInterface
}

export interface BSVPayment {
  derivationPrefix: string
  derivationSuffix: string
  transaction: unknown
}

export interface PaymentResult {
  accepted: boolean
}
