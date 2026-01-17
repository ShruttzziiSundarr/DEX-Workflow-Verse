import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WalletConnectModal } from "@/components/ui/wallet-connect-modal";
import { useWallet } from "@/hooks/use-wallet";

export function WalletConnector() {
  const [showModal, setShowModal] = useState(false);
  const { wallet, connectWallet, disconnectWallet } = useWallet();

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleConnect = async (address: string, privateKey?: string) => {
    const success = await connectWallet(address, privateKey);
    if (success) {
      setShowModal(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
  };

  return (
    <div>
      {wallet ? (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs bg-primary/20 border-primary text-primary hover:bg-primary/30"
          >
            {shortenAddress(wallet.address)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="text-xs"
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <Button onClick={handleOpenModal} className="flex items-center gap-2">
          <span className="material-icons text-sm">account_balance_wallet</span>
          <span>Connect Wallet</span>
        </Button>
      )}

      <WalletConnectModal 
        isOpen={showModal}
        onClose={handleCloseModal}
        onConnect={handleConnect}
      />
    </div>
  );
}

function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
