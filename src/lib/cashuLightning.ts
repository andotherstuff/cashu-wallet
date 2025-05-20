import { CashuMint, CashuWallet, MintQuoteState, Proof } from '@cashu/cashu-ts';

/**
 * Create a Lightning invoice to receive funds
 * @param mintUrl The URL of the mint to use
 * @param amount Amount in satoshis
 * @returns Object containing the invoice and information needed to process it
 */
export async function createLightningInvoice(mintUrl: string, amount: number) {
  try {
    const mint = new CashuMint(mintUrl);
    const wallet = new CashuWallet(mint);

    // Load mint keysets
    await wallet.loadMint();

    // Create a mint quote
    const mintQuote = await wallet.createMintQuote(amount);

    // Return the invoice and quote information
    return {
      paymentRequest: mintQuote.request,
      paymentHash: mintQuote.quote,
      amount,
      mintUrl,
      quote: mintQuote,
    };
  } catch (error) {
    console.error('Error creating Lightning invoice:', error);
    throw error;
  }
}

/**
 * Mint tokens after a Lightning invoice has been paid
 * @param mintUrl The URL of the mint to use
 * @param quoteId The quote ID from the invoice
 * @param amount Amount in satoshis
 * @returns The minted proofs
 */
export async function mintTokensFromPaidInvoice(mintUrl: string, quoteId: string, amount: number): Promise<Proof[]> {
  try {
    const mint = new CashuMint(mintUrl);
    const wallet = new CashuWallet(mint);

    // Load mint keysets
    await wallet.loadMint();

    // Check the status of the quote
    const mintQuoteChecked = await wallet.checkMintQuote(quoteId);

    if (mintQuoteChecked.state !== MintQuoteState.PAID) {
      throw new Error('Lightning invoice has not been paid yet');
    }

    // Mint proofs using the paid quote
    const proofs = await wallet.mintProofs(amount, quoteId);

    return proofs;
  } catch (error) {
    console.error('Error minting tokens from paid invoice:', error);
    throw error;
  }
}

/**
 * Pay a Lightning invoice by melting tokens
 * @param mintUrl The URL of the mint to use
 * @param paymentRequest The Lightning invoice to pay
 * @param proofs The proofs to spend
 * @returns The fee and change proofs
 */
export async function payLightningInvoice(mintUrl: string, paymentRequest: string, proofs: Proof[]) {
  try {
    const mint = new CashuMint(mintUrl);
    const wallet = new CashuWallet(mint);

    // Load mint keysets
    await wallet.loadMint();

    // Create a melt quote for the Lightning invoice
    const meltQuote = await wallet.createMeltQuote(paymentRequest);

    // Calculate total amount needed, including fee
    const amountToSend = meltQuote.amount + meltQuote.fee_reserve;

    // Perform coin selection
    const { keep, send } = await wallet.send(amountToSend, proofs, {
      includeFees: true
    });

    // Melt the selected proofs to pay the Lightning invoice
    const meltResponse = await wallet.meltProofs(meltQuote, send);

    return {
      fee: meltQuote.fee_reserve || 0,
      change: meltResponse.change || [],
      keep,
      success: true
    };
  } catch (error) {
    console.error('Error paying Lightning invoice:', error);
    throw error;
  }
}

/**
 * Calculate total amount in a list of proofs
 * @param proofs List of proofs
 * @returns Total amount
 */
export function getProofsAmount(proofs: Proof[]): number {
  return proofs.reduce((total, proof) => total + proof.amount, 0);
}

/**
 * Parse a Lightning invoice to extract the amount
 * @param paymentRequest The Lightning invoice to parse
 * @returns The amount in satoshis or null if not found
 */
export function parseInvoiceAmount(paymentRequest: string): number | null {
  try {
    // Simple regex to extract amount from BOLT11 invoice
    // This is a basic implementation - a proper decoder would be better
    const match = paymentRequest.match(/lnbc(\d+)([munp])/i);

    if (!match) return null;

    let amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    // Convert to satoshis based on unit
    switch (unit) {
      case 'p': // pico
        amount = Math.floor(amount / 10); // 1 pico-btc = 0.1 satoshi
        break;
      case 'n': // nano
        amount = Math.floor(amount); // 1 nano-btc = 1 satoshi
        break;
      case 'u': // micro
        amount = amount * 100; // 1 micro-btc = 100 satoshis
        break;
      case 'm': // milli
        amount = amount * 100000; // 1 milli-btc = 100,000 satoshis
        break;
      default: // btc
        amount = amount * 100000000; // 1 btc = 100,000,000 satoshis
    }

    return amount;
  } catch (error) {
    console.error('Error parsing invoice amount:', error);
    return null;
  }
} 