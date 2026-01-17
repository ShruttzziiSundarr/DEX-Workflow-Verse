interface Window {
  solana?: {
    connect(): Promise<{ publicKey: { toString(): string } }>;
    disconnect(): Promise<void>;
    isPhantom?: boolean;
    on(event: string, callback: (args: any) => void): void;
    off(event: string, callback: (args: any) => void): void;
  };
}
