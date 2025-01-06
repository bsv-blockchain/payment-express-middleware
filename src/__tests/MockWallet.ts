import { Base64String, BEEF, PositiveIntegerOrZero, PubKeyHex, MasterCertificate, ProtoWallet, BasketStringUnder300Bytes, OutputTagStringUnder300Bytes, DescriptionString5to50Bytes, OriginatorDomainNameStringUnder250Bytes, LabelStringUnder300Bytes, CreateActionArgs, CreateActionResult } from '@bsv/sdk'

type StoredCertificate = {
  type: string
  subject: string
  serialNumber: string
  certifier: string
  revocationOutpoint: string
  signature: string
  fields: Record<string, string>
  masterCertificate: MasterCertificate
}

/**
 * Helper MockWallet that extends ProtoWallet with mocked functionality as needed.
 */
export class MockWallet extends ProtoWallet {
  private storedCertificates: StoredCertificate[] = []

  /**
   * Add a master certificate to this wallet for testing.
   * @param {MasterCertificate} masterCertificate - The master certificate to store.
   */
  addMasterCertificate(masterCertificate: MasterCertificate) {
    const certData = {
      type: masterCertificate.type,
      subject: masterCertificate.subject,
      serialNumber: masterCertificate.serialNumber,
      certifier: masterCertificate.certifier,
      revocationOutpoint: masterCertificate.revocationOutpoint,
      signature: masterCertificate.signature || '',
      fields: masterCertificate.fields,
      masterCertificate
    }
    this.storedCertificates.push(certData)
  }

  /**
   * Mock implementation of listCertificates:
   * It returns any certificates whose certifier and type match the requested sets.
   */
  async listCertificates(
    args: {
      certifiers: string[]
      types: string[]
      limit?: number
      offset?: number
      privileged?: boolean
      privilegedReason?: string
    }
  ): Promise<{
    totalCertificates: number
    certificates: Array<{
      type: string
      subject: string
      serialNumber: string
      certifier: string
      revocationOutpoint: string
      signature: string
      fields: Record<string, string>
    }>
  }> {
    // Filter certificates by requested certifiers and types
    const filtered = this.storedCertificates.filter(cert => {
      return args.certifiers.includes(cert.certifier) && args.types.includes(cert.type)
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
        signature: cert.signature,
        fields: cert.fields
      }))
    }
  }

  /**
   * Mock implementation of proveCertificate:
   * Given a certificate and fieldsToReveal, it calls the masterCertificate to create
   * a keyring for the verifier, just as the real code would.
   */
  async proveCertificate(
    args: {
      certificate: {
        type: string
        subject: string
        serialNumber: string
        certifier: string
        revocationOutpoint: string
        signature: string
        fields: Record<string, string>
      }
      fieldsToReveal: string[]
      verifier: string
      privileged?: boolean
      privilegedReason?: string
    }
  ): Promise<{
    keyringForVerifier: Record<string, string>
  }> {
    if (args.privileged) {
      throw new Error(this.privilegedError)
    }

    // Find the stored certificate that matches the given certificate fields
    const storedCert = this.storedCertificates.find(sc =>
      sc.type === args.certificate.type &&
      sc.subject === args.certificate.subject &&
      sc.serialNumber === args.certificate.serialNumber &&
      sc.certifier === args.certificate.certifier
    )

    if (!storedCert) {
      throw new Error('Certificate not found in MockWallet.')
    }

    // Create the keyring for the verifier
    const keyringForVerifier = await storedCert.masterCertificate.createKeyringForVerifier(
      this,
      args.verifier,
      args.fieldsToReveal
    )

    return { keyringForVerifier }
  }

  /**
   * Mock implementation of internalizeAction
   *
   * @param args - The action to internalize
   * @param originator - Optional originator domain name
   * @returns 
   */
  async internalizeAction(
    args: {
      tx: BEEF;
      outputs: Array<{
        outputIndex: PositiveIntegerOrZero;
        protocol: 'wallet payment' | 'basket insertion';
        paymentRemittance?: {
          derivationPrefix: Base64String;
          derivationSuffix: Base64String;
          senderIdentityKey: PubKeyHex;
        };
        insertionRemittance?: {
          basket: BasketStringUnder300Bytes;
          customInstructions?: string;
          tags?: OutputTagStringUnder300Bytes[];
        };
      }>;
      description: DescriptionString5to50Bytes;
      labels?: LabelStringUnder300Bytes[];
    },
    originator?: OriginatorDomainNameStringUnder250Bytes
  ): Promise<{ accepted: true }> {
    // Mock implementation: logs the input and returns a mocked response
    console.log("Mock internalizeAction called with:", { args, originator });

    // Simulate successful action with mocked response
    return Promise.resolve({ accepted: true });
  }

  async createAction(
    args: CreateActionArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes
  ): Promise<CreateActionResult> {
    // Mock response based on provided arguments
    const mockResponse = {
      txid: args.options?.returnTXIDOnly ? "mocked_txid_12345" : undefined,
      tx: args.options?.noSend ? undefined : [0xBE, 0xEF]
    }

    return Promise.resolve(mockResponse)
  }

  // If needed, you can also provide mock implementations of acquireCertificate, relinquishCertificate, etc.
}
