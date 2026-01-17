// This file intentionally keeps a simple module export to avoid duplicate JSX parsing
// errors in the workspace. The real implementation resides in `use-wallet-fixed.tsx`.
// Re-export the TSX implementation to ensure module resolution finds the named exports
export { useWallet, WalletProvider } from './use-wallet-fixed.tsx';