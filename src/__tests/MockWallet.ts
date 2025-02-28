import {
  MasterCertificate,
  OriginatorDomainNameStringUnder250Bytes,
  ListCertificatesArgs,
  ListCertificatesResult,
  CreateActionArgs,
  CreateActionResult,
  InternalizeActionArgs,
  InternalizeActionResult,
  ProveCertificateArgs,
  ProveCertificateResult,
  KeyDeriverApi,
  PrivateKey,
  CompletedProtoWallet,
  KeyDeriver
} from '@bsv/sdk'

/**
 * MockWallet extends CompletedProtoWallet and provides concrete
 * implementations for select methods used for testing.
 */
export class MockWallet extends CompletedProtoWallet {
  keyDeriver: KeyDeriver
  constructor(rootKeyOrKeyDeriver: PrivateKey | 'anyone' | KeyDeriverApi) {
    super(rootKeyOrKeyDeriver)

    if (rootKeyOrKeyDeriver instanceof KeyDeriver) {
      this.keyDeriver = rootKeyOrKeyDeriver
    } else if (
      typeof rootKeyOrKeyDeriver === 'string' ||
      rootKeyOrKeyDeriver instanceof PrivateKey
    ) {
      this.keyDeriver = new KeyDeriver(rootKeyOrKeyDeriver)
    } else {
      throw new Error('Invalid key deriver provided')
    }
  }

  private readonly storedCertificates: MasterCertificate[] = []

  /**
   * Add a master certificate to the wallet for testing purposes.
   */
  addMasterCertificate(masterCertificate: MasterCertificate): void {
    this.storedCertificates.push(masterCertificate)
  }

  async createAction(
    args?: CreateActionArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes
  ): Promise<CreateActionResult> {
    // Mock response based on provided arguments
    const mockResponse = {
      txid: args?.options?.returnTXIDOnly ? 'mocked_txid_12345' : undefined,
      tx: args?.options?.noSend ? undefined : [0xBE, 0xEF]
    }
    return mockResponse
  }

  /**
   * Given a certificate and fields to reveal, this method creates a keyring
   * for the verifier by leveraging the masterCertificate’s capabilities.
   */
  async proveCertificate(args?: ProveCertificateArgs, originator?: OriginatorDomainNameStringUnder250Bytes): Promise<ProveCertificateResult> {
    if (args === undefined) {
      throw new Error('Must provide args for test')
    }
    const storedCert = this.storedCertificates.find(sc =>
      sc.type === args.certificate.type &&
      sc.subject === args.certificate.subject &&
      sc.serialNumber === args.certificate.serialNumber &&
      sc.certifier === args.certificate.certifier
    )

    if (storedCert === undefined) {
      throw new Error('Certificate not found in MockWallet.')
    }

    // Create the keyring for the verifier (using the masterCertificate's method)
    const keyringForVerifier = await MasterCertificate.createKeyringForVerifier(
      this,
      storedCert.certifier,
      args.verifier,
      storedCert.fields,
      args.fieldsToReveal,
      storedCert.masterKeyring,
      storedCert.serialNumber
    )

    return { keyringForVerifier }
  }

  /**
   * Mock implementation of internalizeAction.
   * Logs the provided action details and returns a successful response.
   */
  async internalizeAction(args?: InternalizeActionArgs, originator?: OriginatorDomainNameStringUnder250Bytes): Promise<InternalizeActionResult> {
    console.log('Mock internalizeAction called with:', { args, originator })
    return await Promise.resolve({ accepted: true })
  }

  /**
   * Returns any certificates whose certifier and type match the requested sets.
   */
  async listCertificates(args?: ListCertificatesArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes): Promise<ListCertificatesResult> {
    // Filter certificates by requested certifiers and types
    const filtered = this.storedCertificates.filter(cert => {
      return args?.certifiers.includes(cert.certifier) && args?.types.includes(cert.type)
    })

    // For testing, limit and offset can be ignored or handled trivially
    const totalCertificates = filtered.length

    return {
      totalCertificates,
      certificates: filtered.map(cert => ({
        type: cert.type,
        subject: cert.subject,
        serialNumber: cert.serialNumber,
        certifier: cert.certifier,
        revocationOutpoint: cert.revocationOutpoint,
        signature: cert.signature ?? '',
        fields: cert.fields
      }))
    }
  }
}
