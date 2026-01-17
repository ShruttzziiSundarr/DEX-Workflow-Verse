import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { ChevronDown, Search } from 'lucide-react';
import { getValidators, ValidatorInfo } from '../lib/solana/solanaStaking';

interface ValidatorSelectorProps {
  selectedValidator?: string;
  onValidatorSelect: (validatorPubkey: string) => void;
  placeholder?: string;
}

export function ValidatorSelector({ selectedValidator, onValidatorSelect, placeholder = "Select Validator" }: ValidatorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadValidators() {
      try {
        const validatorList = await getValidators();
        setValidators(validatorList);
      } catch (error) {
        console.error('Failed to load validators:', error);
      } finally {
        setLoading(false);
      }
    }
    loadValidators();
  }, []);

  const filteredValidators = validators.filter(validator =>
    validator.votePubkey.toLowerCase().includes(searchQuery.toLowerCase()) ||
    validator.nodePubkey.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleValidatorSelect = (validator: ValidatorInfo) => {
    onValidatorSelect(validator.votePubkey);
    setIsOpen(false);
    setSearchQuery('');
  };

  const selectedValidatorInfo = validators.find(v => v.votePubkey === selectedValidator);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-background border-border"
        >
          <span className="truncate">
            {selectedValidatorInfo ? (
              <div className="text-left">
                <div className="font-medium">Validator</div>
                <div className="text-xs text-muted-foreground truncate">
                  {selectedValidatorInfo.votePubkey.slice(0, 8)}...{selectedValidatorInfo.votePubkey.slice(-8)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Commission: {selectedValidatorInfo.commission}% | Stake: {(selectedValidatorInfo.activatedStake / 1e9).toFixed(2)} SOL
                </div>
              </div>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Validator</DialogTitle>
          <DialogDescription>
            Choose a validator to stake your SOL with. Validators with lower commission rates are generally preferred.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search validators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <ScrollArea className="h-64">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading validators...</div>
              </div>
            ) : filteredValidators.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">No validators found</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredValidators.map((validator) => (
                  <Button
                    key={validator.votePubkey}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleValidatorSelect(validator)}
                  >
                    <div className="text-left">
                      <div className="font-medium text-sm">Validator</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {validator.votePubkey}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Commission: {validator.commission}% | Stake: {(validator.activatedStake / 1e9).toFixed(2)} SOL
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
