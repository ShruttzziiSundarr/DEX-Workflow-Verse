interface Window {
  solana?: {
    connect(): Promise<{ publicKey: { toString(): string } }>;
    disconnect(): Promise<void>;
    isPhantom?: boolean;
    signTransaction?: (transaction: any) => Promise<any>;
    signAllTransactions?: (transactions: any[]) => Promise<any[]>;
    on(event: string, callback: (args: any) => void): void;
    off(event: string, callback: (args: any) => void): void;
  };
}