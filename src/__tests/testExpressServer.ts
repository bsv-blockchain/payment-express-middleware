import express, { Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import { PrivateKey, VerifiableCertificate } from '@bsv/sdk'
import { MockWallet } from './MockWallet'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { createPaymentMiddleware } from '../index'

// Create Express app instance
export const app = express()

// Middleware setup
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.text())
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '500mb' }))

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

const privKey = new PrivateKey(1)
const mockWallet = new MockWallet(privKey)

// Define routes
app.post('/no-auth', (req: Request, res: Response) => {
  res.status(200).send({ message: 'Non auth endpoint!' })
})

const authMiddleware = createAuthMiddleware({
  allowUnauthenticated: false,
  wallet: mockWallet,
  onCertificatesReceived: (_senderPublicKey: string, certs: VerifiableCertificate[], req: Request, res: Response, next: NextFunction) => {
    console.log('Certificates received:', certs)
    next()
  }
})

// Add the mutual authentication middleware
app.use(authMiddleware)

app.use(createPaymentMiddleware({
  wallet: mockWallet,
  calculateRequestPrice: async (req: Request) => {
    return 10
  }
}))

app.get('/weather', async (req: Request, res: Response) => {
  const response = await fetch('https://openweathermap.org/data/2.5/weather?id=5746545&appid=439d4b804bc8187953eb36d2a8c26a02', { method: 'GET' })
  const weatherData = await response.json()
  res.json(weatherData)
})

// Fallback for 404 errors
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: 'The requested resource was not found on this server.'
  })
})
const port = 3000
// Export a function to start the server programmatically
export const startServer = (port = 3000): ReturnType<typeof app.listen> => {
  return app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
  })
}
// For testing independently of integration tests:
// startServer()