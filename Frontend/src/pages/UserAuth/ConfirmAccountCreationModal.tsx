import {
  useState,
  useCallback,
  useMemo,
} from "react";

import {
  toast,
} from 'react-toastify';

import {
  type ButtonStatus,
  Button,
} from "@/components/ui/button";
import {
  Input,
} from '@/components/ui/input';
import {
  Label,
} from '@/components/ui/label';
import {
  AppModal,
} from "@/components/ui/app-modal";

import {
  type ConfirmAccountReqBody,
} from '@/types/APIProtocol';

const FORM_ID = 'confirm-account-creation-form';
const TOKEN_INPUT_ID = 'account-creation-token'
const PASSWORD_INPUT_ID = 'account-creation-password';
const CONFIRM_PASSWORD_INPUT_ID = 'account-creation-confirm-password';

export interface ConfirmAccountCreationModalProps {
  open: boolean;
  onSubmit: (req: ConfirmAccountReqBody) => void;
  onSkip: () => void;
  email?: string;
  initToken?: string;
  variant: 'normal' | 'pending' | 'error';
}

const ConfirmAccountCreationModal = ({
  open,
  onSubmit,
  onSkip,
  email,
  initToken,
  variant,
}: ConfirmAccountCreationModalProps) => {
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
  const textareaClassname : string = useMemo(
    () => {
      switch (variant) {
        case 'error':
          return "border border-red-600 p-2 w-full rounded-md"
        default:
          return "border p-2 w-full rounded-md"
      }// -- end 
    },
    [variant]
  );
  const [token, setToken] = useState<string>(initToken || '');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const submitButtonStatus : ButtonStatus = useMemo(
    () => {
      if (variant === 'pending') return 'pending';
      if (! token.trim()) return 'disabled';
      if (! password.trim()) return 'disabled';
      if (password !== confirmPassword) return 'disabled';

      return 'enabled';
    },
    [variant, token, password, confirmPassword]
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      const exitFailure = (reason: string): void => {
        console.error(reason);
        toast.error(reason);
      };

      e.preventDefault();

      if (! token.trim()) return exitFailure("Missing account creation token");
      if (! password.trim()) return exitFailure("Missing password");
      if (password !== confirmPassword) return exitFailure("Passwords don't match");

      onSubmit({ token, password, });
    },
    [onSubmit, token, password, confirmPassword]
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
            status={submitButtonStatus}
          >
            Confirm account creation
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={handleFormSubmit}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={TOKEN_INPUT_ID}>{labelText}</Label>
          <textarea
            id={TOKEN_INPUT_ID}
            placeholder="Account creation token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={10}
            cols={10}
            className={textareaClassname}
            autoFocus
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={PASSWORD_INPUT_ID}>Password</Label>
          <Input
            id={PASSWORD_INPUT_ID}
            name="password"
            value={password}
            type="password"
            placeholder="********"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={CONFIRM_PASSWORD_INPUT_ID}>Confirm Password</Label>
          <Input
            id={CONFIRM_PASSWORD_INPUT_ID}
            name="confirm_password"
            value={confirmPassword}
            type="password"
            placeholder="********"
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
      </form>
    </AppModal>
  );
};// -- end ConfirmAccountCreationModal

export default ConfirmAccountCreationModal;
