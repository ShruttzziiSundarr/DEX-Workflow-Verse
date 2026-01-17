import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { ChevronDown, Search } from 'lucide-react';
import { fetchDevnetTokens, Token } from '../lib/solana/tokenList';

interface TokenSelectorProps {
  selectedToken?: Token;
  onTokenSelect: (token: Token) => void;
  placeholder?: string;
}

export function TokenSelector({ selectedToken, onTokenSelect, placeholder = "Select Token" }: TokenSelectorProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTokens() {
      try {
        const devnetTokens = await fetchDevnetTokens();
        setTokens(devnetTokens);
      } catch (error) {
        console.error('Failed to load tokens:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTokens();
  }, []);

  const filteredTokens = tokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTokenSelect = (token: Token) => {
    onTokenSelect(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={loading}
        >
          <div className="flex items-center gap-2">
            {selectedToken ? (
              <>
                {selectedToken.logoURI && (
                  <img
                    src={selectedToken.logoURI}
                    alt={selectedToken.symbol}
                    className="w-5 h-5 rounded-full"
                  />
                )}
                <span className="font-medium">{selectedToken.symbol}</span>
                <span className="text-muted-foreground text-sm">
                  {selectedToken.name}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {loading ? "Loading tokens..." : placeholder}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading tokens...
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No tokens found
                </div>
              ) : (
                filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleTokenSelect(token)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    {token.logoURI && (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-sm text-muted-foreground">
                        {token.name}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Devnet
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
