// === emailService.tsx ========================================================
//
// JSX templates for misc. email bodies.
//
// =============================================================================

const {
  DOMAIN_NAME,
} = process.env;

if (! DOMAIN_NAME) throw new Error('Env var DOMAIN_NAME not provided');

// === AccountConfirmationTemplate =============================================
//
// =============================================================================
export interface AccountConfirmationTemplateProps {
  username: string;
  accountCreationToken: string;
  expirationSecs?: number;
  whiteboardToTransfer?: {
    whiteboardId: string;
    whiteboardConversionToken: string;
  };
}

export const AccountConfirmationTemplate = ({
  username,
  accountCreationToken,
  expirationSecs,
  whiteboardToTransfer,
}: AccountConfirmationTemplateProps) => {
  const formAction : string = `http://${DOMAIN_NAME}/confirm_account_creation`;
  const expirationNotif = (() => {
    if (! expirationSecs) return null;

    // Less than 2 minutes, describe time in number of seconds.
    // 2 minutes or more, describe the time in number of minutes, rounded down.
    const timeDesc = (expirationSecs < 120) ?
      `${expirationSecs} seconds`
      : `${Math.floor(expirationSecs / 60)} minutes`;

    return <p>You have <strong>{timeDesc}</strong> to confirm creation of your account.</p>;
  })();
  const out = (
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

      <table>
        <thead>
          <tr>
            <th
              scope="col"
              style={{ fontSize: 'large', fontWeight: 'bold', textAlign: 'left', }}
            >
              Token:
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ width: '20em', }}>
              {accountCreationToken}
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  );

  return out;
};// -- end mailTemplate
