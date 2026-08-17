import {
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  Button,
} from "@/components/ui/button";
import {
  AppModal,
} from "@/components/ui/app-modal";

const FORM_ID = 'confirm-account-creation-form';
const ACCOUNT_CREATION_TOKEN_INPUT_ID = 'account-creation-token'

export interface ConfirmAccountCreationModalProps {
  open: boolean;
  onSubmitToken: (token: string) => void;
  onSkip: () => void;
  email?: string;
  variant: 'normal' | 'pending' | 'error';
}

const ConfirmAccountCreationModal = ({
  open,
  onSubmitToken,
  onSkip,
  email,
  variant,
}: ConfirmAccountCreationModalProps) => {
  const [token, setToken] = useState<string>('');
  const labelText : string = useMemo(
    () => {
      if (! email) {
        return "Copy and paste the account creation token received at your email address"
      } else {
        return `Copy and paste the account creation token received at ${email}`
      }
    },
    [email]
  );// -- end const labelText

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (token.trim()) {
        onSubmitToken(token.trim());
      }
    },
    [onSubmitToken, token]
  );

  return (
    <AppModal
      open={open}
      // -- dismissing the modal (backdrop / esc / close button) skips the rename
      onOpenChange={(nextOpen) => { if (! nextOpen) onSkip(); }}
      title="Confirm creation of your account"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            status={variant === 'pending' && 'disabled' || 'enabled'}
            onClick={onSkip}
          >
            I'll do it later
          </Button>
          <Button 
            form={FORM_ID} 
            type="submit"
            className="border bg-card-background"
            disabled={token.trim().length <= 0}
            status={variant === 'pending' && 'pending' || 'enabled'}
          >
            Confirm account creation
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={handleFormSubmit}
        className="flex flex-col"
      >
        <label htmlFor={ACCOUNT_CREATION_TOKEN_INPUT_ID}>{labelText}</label>
        <textarea
          id={ACCOUNT_CREATION_TOKEN_INPUT_ID}
          placeholder="Account creation token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={10}
          cols={10}
          className={`border ${(variant === 'error') && 'border-red-600' || ''} p-2 w-full my-2 rounded-md`}
          autoFocus
          required
        />
      </form>
    </AppModal>
  );
};// -- end ConfirmAccountCreationModal

export default ConfirmAccountCreationModal;
