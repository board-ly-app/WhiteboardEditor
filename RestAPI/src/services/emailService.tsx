// === emailService.tsx ========================================================
//
// JSX templates for misc. email bodies.
//
// =============================================================================

import {
  type PatchPermanentUserReqPayloadInitial,
} from '../models/User';

// === Misc. utils =============================================================
interface TokenDisplayProps {
  inputId: string;
  token: string;
}

const TokenDisplay = ({
  inputId,
  token,
}: TokenDisplayProps) => {
  return (
    <div style={{ marginTop: '2em', }}>
      <label for={inputId} style={{
        fontSize: 'medium', fontWeight: 'bold', marginRight: '0.5em',
      }}>
        Token:
      </label>
      <input
        id={inputId}
        type="password"
        value={token}
        size="20"
        readonly
      />
      <p>(Triple click or press ctrl+a to select the entire token)</p>
    </div>
  );
};// -- end TokenDisplay

interface ExpirationNotifProps {
  expirationSecs: number;
  actionDesc: string;
}

const ExpirationNotif = ({
  expirationSecs,
  actionDesc,
}: ExpirationNotifProps) => {
  const timeDesc = (expirationSecs < 120) ?
    `${expirationSecs} seconds`
    : `${Math.floor(expirationSecs / 60)} minutes`;

  return (
    <p>You have <strong>{timeDesc}</strong> to {actionDesc}.</p>
  );
};// -- end ExpirationNotif

// === AccountConfirmationTemplate =============================================
//
// =============================================================================
export interface AccountConfirmationTemplateProps {
  domainName: string;
  username: string;
  accountCreationToken: string;
  expirationSecs?: number;
  whiteboardToTransfer?: {
    whiteboardId: string;
    whiteboardConversionToken: string;
  };
}

export const AccountConfirmationTemplate = ({
  domainName,
  username,
  accountCreationToken,
  expirationSecs,
  whiteboardToTransfer,
}: AccountConfirmationTemplateProps) => {
  const formAction : string = `http://${domainName}/confirm_account_creation`;

  return (
    <main>
      <h1 safe>Welcome to Board-ly, {username}!</h1>

      <p>
        Either click the button below or copy and paste the
        following token into the previous window to confirm
        creation of your account, <strong safe>{username}</strong>.
      </p>

      {expirationSecs && (
        <ExpirationNotif
          expirationSecs={expirationSecs}
          actionDesc="confirm creation of your account"
        />
      )}

      <form method="GET" action={formAction}>
        <input name="token" value={encodeURIComponent(accountCreationToken)} type="hidden" />
        {whiteboardToTransfer && (
          <>
            <input
              name="wb_conversion_id"
              value={encodeURIComponent(whiteboardToTransfer.whiteboardId)}
              type="hidden"
            />
            <input
              name="wb_conversion_req"
              value={encodeURIComponent(whiteboardToTransfer.whiteboardConversionToken)}
              type="hidden"
            />`
          </>
        ) || null}
        <button type="submit">Create Account</button>
      </form>

      <TokenDisplay inputId="account-creation-token" token={accountCreationToken} />
    </main>
  );
};// -- end AccountConfirmationTemplate

export interface AccountConfirmationDuplicateEmailTemplateProps {
  domainName: string;
  username: string;
}

export const AccountConfirmationDuplicateEmailTemplate = ({
  domainName,
  username,
}: AccountConfirmationDuplicateEmailTemplateProps) => {
  return (
    <main>
      <h1 safe>Hello {username},</h1>

      <p>
        You are receiving this email because someone tried to
        create a new account at {domainName} with this email address.
      </p>
      <p>
        If you want to access the account you already created, please go
        to {domainName} to request a new password.
        Otherwise, you can disregard this email.
      </p>
    </main>
  );
};

export interface PatchAccountEmailTemplateProps {
  domainName: string;
  username: string;
  payloadInitial: PatchPermanentUserReqPayloadInitial;
  payloadToken: string;
  expirationSecs: number;
}

export const PatchAccountEmailTemplate = ({
  domainName,
  username,
  payloadInitial,
  payloadToken,
  expirationSecs,
}: PatchAccountEmailTemplateProps) => {
  const accountPageUrl = `http://${domainName}/account`;
  const confirmPageUrl = `${accountPageUrl}?confirm_update=open`;

  return (
    <main>
      <h1>Please confirm your account update</h1>

      <h3 safe>Hello {username},</h3>

      <p>
        You are receiving this email because you recently requested an update to your account.
        Below are the details you requested to update.
      </p>

      <ul>
        {payloadInitial.username && <li>username: {payloadInitial.username}</li>}
        {payloadInitial.email && <li>email address: {payloadInitial.email}</li>}
        {payloadInitial.password && <li>password: ********</li>}
      </ul>

      <p>
        If you did not requests these changes, please contact the administrator
        at admin@{domainName}.
      </p>

      <p>
        Otherwise, you can confirm your account update by either clicking the button below
        or copying and pasting the token below into the form on
        <a href={confirmPageUrl}>your settings page</a>.
      </p>

      {expirationSecs && (
        <ExpirationNotif
          expirationSecs={expirationSecs}
          actionDesc="confirm your account update"
        />
      )}

      <form method="GET" action={accountPageUrl}>
        <input type="hidden" name="update_token" value={payloadToken} />
        <button type="submit">
          Confirm update
        </button>
      </form>

      <TokenDisplay inputId="update-token" token={payloadToken} />
    </main>
  );
};// -- end PatchAccountEmailTemplate
