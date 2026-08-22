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
  type PatchPermanentUserConfirmReqBody,
} from '@/types/APIProtocol';

const FORM_ID = 'confirm-update-form';
const TOKEN_INPUT_ID = 'confirm-update-token'

export type ConfirmUpdateModalPayload = Omit<PatchPermanentUserConfirmReqBody, 'kind'>;

export interface ConfirmUpdateModalProps {
  open: boolean;
  onSubmit: (req: ConfirmUpdateModalPayload) => void;
  onSkip: () => void;
  email?: string;
  initToken?: string;
  variant: 'normal' | 'pending' | 'error';
}

const ConfirmUpdateModal = ({
  open,
  onSubmit,
  onSkip,
  email,
  initToken,
  variant,
}: ConfirmUpdateModalProps) => {
  const labelText : string = useMemo(
    () => {
      if (! email) {
        return "Copy and paste the update confirmation token received at your email address"
      } else {
        return `Copy and paste the update confirmation token received at ${email}`
      }
    },
    [email]
  );// -- end const labelText
  const tokenInputClassname : string = useMemo(
    () => {
      switch (variant) {
        case 'error':
          return "border-red-600"
        default:
          return "";
      }// -- end 
    },
    [variant]
  );
  const [token, setToken] = useState<string>(initToken || '');
  const submitButtonStatus : ButtonStatus = useMemo(
    () => {
      switch (variant) {
        case 'pending':
          return 'pending';
        case 'normal':
        case 'error':
        {
          if (! token.trim()) return 'disabled';

          return 'enabled';
        }
      }// -- end switch (variant)
    },
    [variant, token]
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      const exitFailure = (reason: string): void => {
        console.error(reason);
        toast.error(reason);
      };

      e.preventDefault();

      if (! token.trim()) return exitFailure("Missing account creation token");

      onSubmit({ payload: token.trim(), });
    },
    [onSubmit, token]
  );

  return (
    <AppModal
      open={open}
      // -- dismissing the modal (backdrop / esc / close button) skips the rename
      onOpenChange={(nextOpen) => { if (! nextOpen) onSkip(); }}
      title="Confirm account update"
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
            Confirm account update
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
          <Input
            id={TOKEN_INPUT_ID}
            type="password"
            placeholder="Update confirmation token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={tokenInputClassname}
            autoFocus
            required
          />
        </div>
      </form>
    </AppModal>
  );
};// -- end ConfirmUpdateModal

export default ConfirmUpdateModal;
