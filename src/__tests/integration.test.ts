import {
  PrivateKey,
  RequestedCertificateTypeIDAndFieldList,
  AuthFetch
} from '@bsv/sdk'
import { MockWallet } from './MockWallet'
import { Server } from 'http'
import { startServer } from './testExpressServer'

export interface RequestedCertificateSet {
  certifiers: string[]
  types: RequestedCertificateTypeIDAndFieldList
}

describe('AuthFetch and AuthExpress Integration Tests', () => {
  const privKey = PrivateKey.fromRandom()
  let server: Server
  beforeAll((done) => {
    // Start the Express server
    server = startServer(3000)
    server.on('listening', () => {
      done()
    })
  })

  afterAll((done) => {
    // Close the server after tests
    server.close(() => {
      console.log('Test server stopped')
      done()
    })
  })

  test('Weather test', async () => {
    const walletWithRequests = new MockWallet(privKey)
    const authClient = new AuthFetch(walletWithRequests)
    const result = await authClient.fetch(
      'http://localhost:3000/weather',
      {
        method: 'GET'
      }
    )
    expect(result.status).toBe(200)
    const jsonResponse = await result.json()
    console.log(jsonResponse)
    expect(Number(result.headers.get('x-bsv-payment-satoshis-paid'))).toEqual(10)
    expect(jsonResponse).toBeDefined()
  }, 150000)
})
