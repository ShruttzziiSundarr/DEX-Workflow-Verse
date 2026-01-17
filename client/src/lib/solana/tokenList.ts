// Token list service for fetching devnet tokens
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

// Hardcoded devnet tokens that are known to work with Jupiter
export const DEVNET_TOKENS: Token[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Wrapped SOL",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    tags: ["devnet"]
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin (Devnet)",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    tags: ["devnet"]
  },
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD (Devnet)",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
    tags: ["devnet"]
  }
];

// Function to fetch devnet tokens from Jupiter's API (with fallback to hardcoded list)
export async function fetchDevnetTokens(): Promise<Token[]> {
  try {
    const response = await fetch('https://token.jup.ag/strict?tags=devnet');
    if (!response.ok) {
      console.warn('Failed to fetch devnet tokens from Jupiter, using fallback list');
      return DEVNET_TOKENS;
    }
    
    const tokens = await response.json();
    return tokens.filter((token: any) => token.tags?.includes('devnet')) || DEVNET_TOKENS;
  } catch (error) {
    console.warn('Error fetching devnet tokens:', error);
    return DEVNET_TOKENS;
  }
}

// Get token by address
export function getTokenByAddress(address: string): Token | undefined {
  return DEVNET_TOKENS.find(token => token.address === address);
}

// Get token by symbol
export function getTokenBySymbol(symbol: string): Token | undefined {
  return DEVNET_TOKENS.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
}
