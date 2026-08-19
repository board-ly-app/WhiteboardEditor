// === emailService.tsx ========================================================
//
// JSX templates for misc. email bodies.
//
// =============================================================================

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
  const expirationNotif = (() => {
    if (! expirationSecs) return null;

    // Less than 2 minutes, describe time in number of seconds.
    // 2 minutes or more, describe the time in number of minutes, rounded down.
    const timeDesc = (expirationSecs < 120) ?
      `${expirationSecs} seconds`
      : `${Math.floor(expirationSecs / 60)} minutes`;

    return <p>You have <strong>{timeDesc}</strong> to confirm creation of your account.</p>;
  })();

  return (
    <main>
      <h1 safe>Welcome to Board-ly, {username}!</h1>

      <p>
        Either click the button below or copy and paste the
        following token into the previous window to confirm
        creation of your account, <strong safe>{username}</strong>.
      </p>

      {expirationNotif}

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

      <div style={{ marginTop: '2em', }}>
        <label for="account-creation-token" style={{
          fontSize: 'medium', fontWeight: 'bold', marginRight: '0.5em',
        }}>
          Token:
        </label>
        <input
          id="account-creation-token"
          type="password"
          value={accountCreationToken}
          size="20"
          readonly
        />
        <p>(Triple click or press ctrl+a to select the entire token)</p>
      </div>
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
