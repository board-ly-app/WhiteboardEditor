// === Misc. Utils =============================================================
//
// =============================================================================

interface ResultOk<OkType> {
  result: 'ok';
  data: OkType;
}

interface ResultErr<ErrType> {
  result: 'err';
  err: ErrType;
}

// === Result ==================================================================
//
// Mimics Result type in Rust.
//
// =============================================================================
export type Result<OkType, ErrType> = ResultOk<OkType> | ResultErr<ErrType>;

// === Set Inclusion Options ===================================================
//
// Way of defining inclusion in a set. There exist three variants:
// - All: include all fields within a set
// - Include: include only specified fields within a set
// - Exclude: include all fields except the specified fields
//
// =============================================================================

export type SetInclusionOptionType <FieldType> = 
  | { type: 'all'; }
  | { type: 'include'; included: FieldType[];  }
  | { type: 'exclude'; excluded: FieldType[];  }
;

// === escapeEncode ============================================================
//
// Encodes a string using HTML character references, in order to protect against
// XSS injection attacks.
//
// =============================================================================
export const escapeEncode = (s: string): string => {
  let out : string = '';

  for (let i = 0; i < s.length; ++i) {
    out += `&#${s.codePointAt(i)};`;
  }// -- end for i

  return out;
};// -- end escapeEncode
